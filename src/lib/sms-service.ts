/**
 * Twilio Real SMS OTP Dispatch Service for Ishyura
 *
 * Dedicated strictly to Twilio SMS and Twilio Verify Services.
 */

export interface SmsSendResult {
  success: boolean;
  provider: "twilio";
  messageId?: string;
  detail: string;
  error?: string;
  isTrialNotice?: boolean;
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
 * Sends a real SMS OTP directly to a physical device using Twilio
 */
export async function sendRealOtpSms(
  phoneNumber: string,
  otpCode: string,
  env: SmsEnvConfig = {},
): Promise<SmsSendResult> {
  const e164Phone = formatToE164(phoneNumber);
  const textMessage = `Your Ishyura verification code is: ${otpCode}. Valid for 10 minutes. (Ishyura Rwanda MoMo & QR)`;

  const twilioSid =
    env.TWILIO_ACCOUNT_SID ||
    (typeof process !== "undefined" ? process.env?.TWILIO_ACCOUNT_SID : "");
  const twilioToken =
    env.TWILIO_AUTH_TOKEN || (typeof process !== "undefined" ? process.env?.TWILIO_AUTH_TOKEN : "");
  const twilioPhone =
    env.TWILIO_PHONE_NUMBER ||
    (typeof process !== "undefined" ? process.env?.TWILIO_PHONE_NUMBER : "");
  const twilioVerifySid =
    env.TWILIO_VERIFY_SERVICE_SID ||
    (typeof process !== "undefined" ? process.env?.TWILIO_VERIFY_SERVICE_SID : "");

  if (!twilioSid || !twilioToken) {
    return {
      success: false,
      provider: "twilio",
      error: "Missing Twilio credentials",
      detail: "Twilio credentials are not set in the environment.",
    };
  }

  const authHeader = `Basic ${btoa(`${twilioSid.trim()}:${twilioToken.trim()}`)}`;

  // 1. First attempt: Twilio Messages API with standard sender phone number
  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append("To", e164Phone);
    bodyParams.append("Body", textMessage);
    if (twilioPhone) {
      bodyParams.append("From", twilioPhone.trim());
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid.trim()}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      },
    );

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.sid) {
      return {
        success: true,
        provider: "twilio",
        messageId: data.sid,
        detail: `SMS successfully sent via Twilio to physical device ${e164Phone} (SID: ${data.sid}).`,
      };
    }

    // Check if error is due to Twilio trial account restriction (unverified physical number)
    const isTrial =
      data.code === 21608 ||
      (typeof data.message === "string" && data.message.includes("Trial accounts"));

    // 2. If Messages API returned unverified error, check if Twilio Verify Service is configured
    if (twilioVerifySid && !isTrial) {
      try {
        const verifyParams = new URLSearchParams();
        verifyParams.append("To", e164Phone);
        verifyParams.append("Channel", "sms");

        const verifyRes = await fetch(
          `https://verify.twilio.com/v2/Services/${twilioVerifySid.trim()}/Verifications`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: verifyParams.toString(),
          },
        );

        const verifyData = await verifyRes.json().catch(() => ({}));
        if (verifyRes.ok && verifyData.sid) {
          return {
            success: true,
            provider: "twilio",
            messageId: verifyData.sid,
            detail: `SMS successfully sent via Twilio Verify to physical device ${e164Phone}.`,
          };
        }
      } catch (verifyErr) {
        console.warn("Twilio Verify fallback error:", verifyErr);
      }
    }

    return {
      success: false,
      provider: "twilio",
      error: data.message || `Twilio error status ${res.status}`,
      isTrialNotice: isTrial,
      detail: isTrial
        ? `Twilio Trial restriction: ${e164Phone} is not yet verified in your Twilio Console (twilio.com/user/account/phone-numbers/verified). To receive SMS on trial accounts, add the phone number to Twilio Verified Caller IDs or upgrade the Twilio project.`
        : `Twilio delivery failed: ${data.message || "Unknown error"}`,
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
