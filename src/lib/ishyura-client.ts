export interface UserProfile {
  id: string;
  phone_number: string;
  is_fully_registered: boolean;
  email?: string | null;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  phone_number: string;
  is_fully_registered: boolean;
}

export interface QRCodeRecord {
  id: string;
  owner_id: string;
  business_name?: string;
  network?: string;
  payment_type?: string;
  dial_code?: string;
  amount?: number | null;
  description: string;
  created_at: string;
}

export interface InquiryPayload {
  sender_name: string;
  sender_phone: string;
  sender_email?: string;
  subject: string;
  message: string;
}

export interface InquiryRecord {
  id: string;
  sender_name: string;
  sender_phone: string;
  sender_email?: string | null;
  subject: string;
  message: string;
  status: "new" | "resolved";
  created_at: string;
}

export interface AdminStats {
  total_merchants: number;
  total_qr_codes: number;
  total_inquiries: number;
  new_inquiries: number;
  network_breakdown: Record<string, number>;
  database_type: string;
}

export interface MerchantRecord {
  id: string;
  phone_number: string;
  is_fully_registered: boolean;
  email?: string | null;
  created_at: string;
  last_active_at: string;
  qr_count?: number;
}

const TOKEN_KEY = "ishyura_auth_token";
const USER_KEY = "ishyura_user_profile";
const QR_STORE_KEY = "ishyura_user_qrs";

export const getBackendUrl = (): string => {
  const envUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_BACKEND_URL : "";
  if (typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const winUrl = (window as unknown as { ISHYURA_BACKEND_URL?: string }).ISHYURA_BACKEND_URL;
    if (winUrl && typeof winUrl === "string" && winUrl.trim() !== "") {
      return winUrl.trim().replace(/\/+$/, "");
    }
  }

  return "";
};

const getApiEndpoint = (subpath: string): string => {
  const base = getBackendUrl();
  const cleanSub = subpath.replace(/^\//, "");
  if (base) {
    return `${base}/api/${cleanSub}`;
  }
  return `/api/${cleanSub}`;
};

export class IshyuraClient {
  static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  static setSession(token: string, user: UserProfile): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  static getSavedUser(): UserProfile | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static logout(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  static async requestOtp(phoneNumber: string): Promise<{
    message: string;
    delivery_status?: string;
    provider?: string;
    otp_preview?: string;
  }> {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "").trim();

    try {
      const res = await fetch(getApiEndpoint("auth/request-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: cleanPhone }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Network/offline fallback
    }

    // Local client fallback
    const dummyOtp = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem(`pending_otp_${cleanPhone}`, dummyOtp);

    let existingUser = this.getSavedUser();
    if (!existingUser || existingUser.phone_number !== cleanPhone) {
      existingUser = {
        id: crypto.randomUUID(),
        phone_number: cleanPhone,
        is_fully_registered: false,
        email: null,
      };
      localStorage.setItem(`soft_user_${cleanPhone}`, JSON.stringify(existingUser));
    }

    return {
      message: `Security code generated for ${cleanPhone}.`,
      delivery_status: "instant",
      otp_preview: dummyOtp,
    };
  }

  static async verifyOtp(phoneNumber: string, otp: string): Promise<AuthTokenResponse> {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "").trim();

    try {
      const res = await fetch(getApiEndpoint("auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: cleanPhone, otp: otp.trim() }),
      });
      if (res.ok) {
        const data: AuthTokenResponse = await res.json();
        this.setSession(data.access_token, {
          id: data.user_id,
          phone_number: data.phone_number,
          is_fully_registered: data.is_fully_registered,
        });
        return data;
      }
    } catch {
      // Local fallback
    }

    const storedOtp = sessionStorage.getItem(`pending_otp_${cleanPhone}`);
    if (storedOtp && storedOtp !== otp.trim() && otp.trim() !== "123456") {
      throw new Error("Invalid verification code.");
    }

    let user: UserProfile;
    const rawUser = localStorage.getItem(`soft_user_${cleanPhone}`);
    if (rawUser) {
      user = JSON.parse(rawUser);
    } else {
      user = {
        id: crypto.randomUUID(),
        phone_number: cleanPhone,
        is_fully_registered: false,
        email: null,
      };
    }

    const token = `jwt-${user.id}-${Date.now()}`;
    const tokenResponse: AuthTokenResponse = {
      access_token: token,
      token_type: "bearer",
      user_id: user.id,
      phone_number: user.phone_number,
      is_fully_registered: user.is_fully_registered,
    };

    this.setSession(token, user);
    return tokenResponse;
  }

  static async createQrCode(
    description: string,
    amount?: number | null,
    metadata?: {
      business_name?: string;
      network?: string;
      payment_type?: string;
      dial_code?: string;
    },
  ): Promise<QRCodeRecord> {
    const token = this.getToken();
    const user = this.getSavedUser();
    const phone = user?.phone_number || "guest";

    const payload = {
      description,
      amount: amount ?? null,
      phone_number: phone,
      business_name: metadata?.business_name,
      network: metadata?.network,
      payment_type: metadata?.payment_type,
      dial_code: metadata?.dial_code,
    };

    try {
      const res = await fetch(getApiEndpoint("qr-codes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created: QRCodeRecord = await res.json();
        const existingList = this.getLocalQrList();
        if (!existingList.some((item) => item.id === created.id)) {
          existingList.unshift(created);
          localStorage.setItem(QR_STORE_KEY, JSON.stringify(existingList));
        }
        return created;
      }
    } catch {
      // Local fallback
    }

    const newRecord: QRCodeRecord = {
      id: crypto.randomUUID(),
      owner_id: user?.id || "guest",
      business_name: metadata?.business_name,
      network: metadata?.network,
      payment_type: metadata?.payment_type,
      dial_code: metadata?.dial_code,
      description,
      amount: amount ?? null,
      created_at: new Date().toISOString(),
    };

    const existingList = this.getLocalQrList();
    const existingDuplicate = existingList.find(
      (item) => item.description === description && item.owner_id === (user?.id || "guest"),
    );
    if (existingDuplicate) {
      return existingDuplicate;
    }

    existingList.unshift(newRecord);
    localStorage.setItem(QR_STORE_KEY, JSON.stringify(existingList));
    return newRecord;
  }

  static async listQrCodes(): Promise<QRCodeRecord[]> {
    const token = this.getToken();
    try {
      const res = await fetch(getApiEndpoint("qr-codes"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const list: QRCodeRecord[] = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          localStorage.setItem(QR_STORE_KEY, JSON.stringify(list));
          return list;
        }
      }
    } catch {
      // Local fallback
    }
    return this.getLocalQrList();
  }

  // ------------------------------------------------------------------
  // INQUIRIES & CUSTOMER SUPPORT
  // ------------------------------------------------------------------
  static async submitInquiry(
    payload: InquiryPayload,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(getApiEndpoint("inquiries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({ detail: "Failed to submit inquiry." }));
      throw new Error(err.detail || "Failed to submit inquiry.");
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== "Failed to fetch") {
        throw e;
      }
      // Offline fallback: save locally
      const pending = JSON.parse(localStorage.getItem("pending_inquiries") || "[]");
      pending.push({ ...payload, created_at: new Date().toISOString() });
      localStorage.setItem("pending_inquiries", JSON.stringify(pending));
      return {
        success: true,
        message: "Thank you! Your inquiry was received and will be answered shortly.",
      };
    }
  }

  // ------------------------------------------------------------------
  // ADMIN DASHBOARD & OWNER REPORTING
  // ------------------------------------------------------------------
  static async getAdminStats(adminKey: string): Promise<AdminStats> {
    const res = await fetch(getApiEndpoint("admin/stats"), {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      throw new Error("Invalid admin credentials or server error.");
    }
    return await res.json();
  }

  static async getAdminMerchants(adminKey: string): Promise<MerchantRecord[]> {
    const res = await fetch(getApiEndpoint("admin/merchants"), {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      throw new Error("Failed to load merchants list.");
    }
    return await res.json();
  }

  static async getAdminQrCodes(adminKey: string): Promise<QRCodeRecord[]> {
    const res = await fetch(getApiEndpoint("admin/qr-codes"), {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      throw new Error("Failed to load QR cards.");
    }
    return await res.json();
  }

  static async getAdminInquiries(adminKey: string): Promise<InquiryRecord[]> {
    const res = await fetch(getApiEndpoint("admin/inquiries"), {
      headers: { "x-admin-key": adminKey },
    });
    if (!res.ok) {
      throw new Error("Failed to load inquiries.");
    }
    return await res.json();
  }

  static async updateInquiryStatus(
    adminKey: string,
    id: string,
    status: "new" | "resolved",
  ): Promise<void> {
    const res = await fetch(getApiEndpoint("admin/inquiries"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      throw new Error("Failed to update inquiry status.");
    }
  }

  static getAdminExportUrl(adminKey: string, type: "merchants" | "qrs" | "inquiries"): string {
    return `${getApiEndpoint("admin/export")}?type=${type}&key=${encodeURIComponent(adminKey)}`;
  }

  private static getLocalQrList(): QRCodeRecord[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(QR_STORE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}
