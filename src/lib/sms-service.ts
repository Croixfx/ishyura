/**
 * Twilio Real SMS OTP Dispatch Service for Ishyura
 *
 * Dedicated strictly to Twilio SMS and Twilio Verify Services.
 */

export interface SmsSendResult {
  success: boolean;
  provider: "twilio" | "twilio-verify";
  messageId?: string;
  detail: string;
  error?: string;
  isTrialNotice?: boolean;
  rawResponse?: unknown;
}

export interface SmsEnvConfig {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  TWILIO_VERIFY_SERVICE_SID?: string;
}

/**
 * Normalizes Rwandan and international phone numbers to E.164 standard (+25078XXXXXXX)
 */
export function formatToE164(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, "").trim();

  // If already starts with +
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // If starts with 00
  if (cleaned.startsWith("00")) {
    return `+${cleaned.slice(2)}`;
  }

  // Rwandan local format: e.g. 0788123456 -> +250788123456
  if (cleaned.startsWith("07") && cleaned.length === 10) {
    return `+250${cleaned.slice(1)}`;
  }

  // Rwandan without 0: e.g. 788123456 (9 digits) -> +250788123456
  if (cleaned.startsWith("7") && cleaned.length === 9) {
    return `+250${cleaned}`;
  }

  // Rwandan 250 prefix without +
  if (cleaned.startsWith("250") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // Default fallback
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

/**
 * Sends a real SMS OTP directly to a physical device using Twilio.
 * Prioritizes Twilio Verify Service if configured (ideal for free/trial accounts),
 * with seamless fallback to Twilio Programmable Messages API.
 */
export async function sendRealOtpSms(
  phoneNumber: string,
  otpCode: string,
  env: SmsEnvConfig = {},
): Promise<SmsSendResult> {
  const e164Phone = formatToE164(phoneNumber);
  const textMessage = `Your Ishyura verification code is ${otpCode}. It expires in 5 minutes.`;

  const twilioSid = (
    env.TWILIO_ACCOUNT_SID ||
    (typeof process !== "undefined" ? process.env?.TWILIO_ACCOUNT_SID : "") ||
    ""
  ).trim();
  const twilioToken = (
    env.TWILIO_AUTH_TOKEN ||
    (typeof process !== "undefined" ? process.env?.TWILIO_AUTH_TOKEN : "") ||
    ""
  ).trim();
  const twilioPhone = (
    env.TWILIO_PHONE_NUMBER ||
    (typeof process !== "undefined" ? process.env?.TWILIO_PHONE_NUMBER : "") ||
    ""
  ).trim();
  const twilioVerifySid = (
    env.TWILIO_VERIFY_SERVICE_SID ||
    (typeof process !== "undefined" ? process.env?.TWILIO_VERIFY_SERVICE_SID : "") ||
    ""
  ).trim();

  if (!twilioSid || !twilioToken) {
    return {
      success: false,
      provider: "twilio",
      error: "Missing Twilio credentials",
      detail:
        "Twilio credentials (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN) are not configured in your Cloudflare Pages environment variables or system settings.",
    };
  }

  if (!twilioPhone && !twilioVerifySid) {
    return {
      success: false,
      provider: "twilio",
      error: "Missing Twilio sender or verify service",
      detail:
        "Neither TWILIO_VERIFY_SERVICE_SID nor TWILIO_PHONE_NUMBER is configured. On free Twilio accounts, Twilio Verify Service is recommended.",
    };
  }

  const authHeader = `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`;

  // -----------------------------------------------------------------
  // 1. Preferred Method for Free/Trial Accounts: Twilio Verify Service
  // -----------------------------------------------------------------
  if (twilioVerifySid) {
    try {
      const verifyParams = new URLSearchParams();
      verifyParams.append("To", e164Phone);
      verifyParams.append("Channel", "sms");

      const verifyRes = await fetch(
        `https://verify.twilio.com/v2/Services/${twilioVerifySid}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: verifyParams.toString(),
        },
      );

      const verifyData = (await verifyRes.json().catch(() => ({}))) as {
        sid?: string;
        status?: string;
        code?: number;
        message?: string;
      };

      if (verifyRes.ok && verifyData.sid) {
        return {
          success: true,
          provider: "twilio-verify",
          messageId: verifyData.sid,
          detail: `SMS successfully sent via Twilio Verify to physical device ${e164Phone} (SID: ${verifyData.sid}).`,
          rawResponse: verifyData,
        };
      }

      console.warn("Twilio Verify API response not ok:", verifyData);

      // If Verify failed and no Programmable Phone Number is configured, report Verify error
      if (!twilioPhone) {
        const isTrial =
          verifyData.code === 21608 ||
          (typeof verifyData.message === "string" &&
            verifyData.message.toLowerCase().includes("trial"));
        return {
          success: false,
          provider: "twilio-verify",
          error: verifyData.message || `Twilio Verify error status ${verifyRes.status}`,
          isTrialNotice: isTrial,
          detail: isTrial
            ? `Twilio Trial restriction: ${e164Phone} must be added to Verified Caller IDs in your Twilio Console (twilio.com/console/phone-numbers/verified).`
            : `Twilio Verify failed: ${verifyData.message || "Unknown error"}`,
          rawResponse: verifyData,
        };
      }
      // If twilioPhone is also present, we proceed to fallback to Programmable SMS below
    } catch (verifyErr) {
      console.warn("Twilio Verify exception, trying Programmable SMS fallback:", verifyErr);
      if (!twilioPhone) {
        const errorMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        return {
          success: false,
          provider: "twilio-verify",
          error: errorMsg,
          detail: `Twilio Verify connection error: ${errorMsg}`,
        };
      }
    }
  }

  // -----------------------------------------------------------------
  // 2. Twilio Programmable Messages API (Standard SMS)
  // -----------------------------------------------------------------
  try {
    const cleanFrom = twilioPhone.startsWith("+") ? twilioPhone : `+${twilioPhone}`;
    const bodyParams = new URLSearchParams();
    bodyParams.append("To", e164Phone);
    bodyParams.append("Body", textMessage);
    bodyParams.append("From", cleanFrom);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      },
    );

    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      code?: number;
      message?: string;
      status?: string;
    };

    if (res.ok && data.sid) {
      return {
        success: true,
        provider: "twilio",
        messageId: data.sid,
        detail: `SMS successfully sent via Twilio to physical device ${e164Phone} (SID: ${data.sid}).`,
        rawResponse: data,
      };
    }

    const isTrial =
      data.code === 21608 ||
      (typeof data.message === "string" && data.message.includes("Trial accounts"));

    const isGeoPermission =
      data.code === 21408 ||
      (typeof data.message === "string" && data.message.toLowerCase().includes("permission"));

    let failureDetail = data.message || `Twilio error status ${res.status}`;
    if (isTrial) {
      failureDetail = `Twilio Trial restriction: ${e164Phone} is not yet verified in your Twilio Console (twilio.com/console/phone-numbers/verified). To receive SMS on trial accounts, add this phone number to Twilio Verified Caller IDs.`;
    } else if (isGeoPermission) {
      failureDetail = `Twilio Geo-Permission blocked: International SMS to Rwanda (+250) must be enabled in Twilio Console > Messaging > Settings > Geo-Permissions.`;
    }

    return {
      success: false,
      provider: "twilio",
      error: data.message || `Twilio error status ${res.status}`,
      isTrialNotice: isTrial,
      detail: failureDetail,
      rawResponse: data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider: "twilio",
      error: errorMsg,
      detail: `Twilio connection error: ${errorMsg}`,
    };
  }
}

/**
 * Checks a verification code with Twilio Verify Service API
 */
export async function checkTwilioVerifyCode(
  phoneNumber: string,
  code: string,
  env: SmsEnvConfig = {},
): Promise<{ success: boolean; approved: boolean; detail?: string; error?: string }> {
  const e164Phone = formatToE164(phoneNumber);
  const twilioSid = (
    env.TWILIO_ACCOUNT_SID ||
    (typeof process !== "undefined" ? process.env?.TWILIO_ACCOUNT_SID : "") ||
    ""
  ).trim();
  const twilioToken = (
    env.TWILIO_AUTH_TOKEN ||
    (typeof process !== "undefined" ? process.env?.TWILIO_AUTH_TOKEN : "") ||
    ""
  ).trim();
  const twilioVerifySid = (
    env.TWILIO_VERIFY_SERVICE_SID ||
    (typeof process !== "undefined" ? process.env?.TWILIO_VERIFY_SERVICE_SID : "") ||
    ""
  ).trim();

  if (!twilioSid || !twilioToken || !twilioVerifySid) {
    return { success: false, approved: false };
  }

  try {
    const authHeader = `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`;
    const checkParams = new URLSearchParams();
    checkParams.append("To", e164Phone);
    checkParams.append("Code", code.trim());

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${twilioVerifySid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: checkParams.toString(),
      },
    );

    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      valid?: boolean;
      message?: string;
    };

    if (res.ok && (data.status === "approved" || data.valid === true)) {
      return { success: true, approved: true, detail: "Approved by Twilio Verify." };
    }

    return {
      success: true,
      approved: false,
      detail: data.message || "Twilio Verify code does not match.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, approved: false, error: errorMsg };
  }
}
