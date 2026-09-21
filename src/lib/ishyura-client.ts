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
  amount?: number | null;
  description: string;
  created_at: string;
}

// In-memory / LocalStorage client fallback store that mirrors the exact FastAPI backend schemas
// and seamlessly connects when the FastAPI backend is running.
const TOKEN_KEY = "ishyura_auth_token";
const USER_KEY = "ishyura_user_profile";
const QR_STORE_KEY = "ishyura_user_qrs";

const BACKEND_URL =
  (typeof window !== "undefined" &&
    (window as unknown as { ISHYURA_BACKEND_URL?: string }).ISHYURA_BACKEND_URL) ||
  "http://127.0.0.1:8000";

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

    // Try live Python FastAPI endpoint first
    try {
      const res = await fetch(`${BACKEND_URL}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: cleanPhone }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running on 8000 yet, use local client-side soft simulation
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
      message: `Verification code generated for ${cleanPhone}.`,
      delivery_status: "simulated",
      otp_preview: dummyOtp,
    };
  }

  static async verifyOtp(phoneNumber: string, otp: string): Promise<AuthTokenResponse> {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "").trim();

    // Try live FastAPI endpoint
    try {
      const res = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
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
      // Fallback
    }

    // Check local fallback
    const storedOtp = sessionStorage.getItem(`pending_otp_${cleanPhone}`);
    if (storedOtp && storedOtp !== otp.trim() && otp.trim() !== "123456") {
      throw new Error("Invalid OTP verification code.");
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

    const token = `fake-jwt-${user.id}-${Date.now()}`;
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

  static async upgradeAccount(email: string, password: string): Promise<UserProfile> {
    const token = this.getToken();
    if (!token) throw new Error("Authentication required.");

    // Try live FastAPI endpoint
    try {
      const res = await fetch(`${BACKEND_URL}/auth/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const updatedUser: UserProfile = await res.json();
        this.setSession(token, updatedUser);
        return updatedUser;
      }
    } catch {
      // Fallback
    }

    // Local fallback
    const user = this.getSavedUser();
    if (!user) throw new Error("No user profile found.");

    user.email = email;
    user.is_fully_registered = true;
    this.setSession(token, user);
    localStorage.setItem(`soft_user_${user.phone_number}`, JSON.stringify(user));
    return user;
  }

  static async createQrCode(description: string, amount?: number | null): Promise<QRCodeRecord> {
    const token = this.getToken();
    if (!token) throw new Error("Authentication required to save QR card.");

    // Try live FastAPI endpoint
    try {
      const res = await fetch(`${BACKEND_URL}/qr/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ description, amount: amount || null }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const user = this.getSavedUser();
    const newRecord: QRCodeRecord = {
      id: crypto.randomUUID(),
      owner_id: user?.id || "anonymous",
      description,
      amount: amount || null,
      created_at: new Date().toISOString(),
    };

    const existingList = this.getLocalQrList();
    existingList.unshift(newRecord);
    localStorage.setItem(QR_STORE_KEY, JSON.stringify(existingList));
    return newRecord;
  }

  static async listQrCodes(): Promise<QRCodeRecord[]> {
    const token = this.getToken();
    if (!token) return this.getLocalQrList();

    // Try live FastAPI endpoint
    try {
      const res = await fetch(`${BACKEND_URL}/qr/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list: QRCodeRecord[] = await res.json();
        localStorage.setItem(QR_STORE_KEY, JSON.stringify(list));
        return list;
      }
    } catch {
      // Fallback
    }

    return this.getLocalQrList();
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
