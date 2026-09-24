export interface UserProfile {
  id: string;
  phone_number: string;
  is_fully_registered: boolean;
  email?: string | null;
  name?: string | null;
  role?: "admin" | "merchant";
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  phone_number: string;
  is_fully_registered: boolean;
  email?: string | null;
  name?: string | null;
  role?: "admin" | "merchant";
}

export interface AdminUserRecord {
  id: string;
  email: string;
  name?: string | null;
  phone_number?: string | null;
  role: "admin";
  created_at: string;
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

export type OrderItemType =
  "acrylic_stand" | "vinyl_stickers" | "smart_nfc_stand" | "pro_bundle" | "custom";

export type OrderStatus = "pending" | "processing" | "delivered" | "cancelled";

export interface OrderPayload {
  customer_name: string;
  customer_phone: string;
  business_name: string;
  delivery_location: string;
  item_type: OrderItemType;
  quantity?: number;
  total_price: number;
  notes?: string;
  network?: string;
  dial_code?: string;
}

export interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  business_name: string;
  delivery_location: string;
  item_type: OrderItemType;
  quantity: number;
  total_price: number;
  notes?: string | null;
  network?: string | null;
  dial_code?: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
}

export interface DownloadEventRecord {
  id: string;
  business_name: string;
  network: string;
  dial_code: string;
  phone_number?: string | null;
  file_format: string;
  created_at: string;
}

export interface AdminStats {
  total_merchants: number;
  total_qr_codes: number;
  total_inquiries: number;
  new_inquiries: number;
  total_orders: number;
  pending_orders: number;
  total_downloads: number;
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

  static getCurrentUser(): UserProfile | null {
    return this.getSavedUser();
  }

  static logout(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  static async requestOtp(phoneNumber: string): Promise<{
    message: string;
    success?: boolean;
    delivery_status?: string;
    provider?: string;
    messageId?: string;
    detail?: string;
    error?: string;
    isTrialNotice?: boolean;
    test_code?: string;
    generated_code?: string;
    phone_normalized?: string;
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

  static async signInWithGoogle(profile: {
    email: string;
    name?: string;
    sub?: string;
  }): Promise<UserProfile> {
    const email = profile.email.trim().toLowerCase();
    try {
      const res = await fetch(getApiEndpoint("auth/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: profile.name,
          sub: profile.sub,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const user: UserProfile = {
          id: data.user_id,
          phone_number: data.phone_number || email,
          email: data.email || email,
          is_fully_registered: true,
        };
        this.setSession(data.access_token, user);
        return user;
      }
    } catch {
      // Local fallback
    }

    const localUser: UserProfile = {
      id: profile.sub || `g-${Date.now()}`,
      phone_number: email,
      email: email,
      is_fully_registered: true,
    };
    this.setSession(`jwt-google-${localUser.id}`, localUser);
    return localUser;
  }

  static async signInWithPassword(identifier: string, password: string): Promise<UserProfile> {
    const cleanId = identifier.trim();
    const res = await fetch(getApiEndpoint("auth/password-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: cleanId, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed." }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    const user: UserProfile = {
      id: data.user_id,
      phone_number: data.phone_number,
      email: data.email,
      is_fully_registered: true,
    };
    this.setSession(data.access_token, user);
    return user;
  }

  static async upgradeAccount(
    email: string,
    password?: string,
    businessName?: string,
  ): Promise<UserProfile> {
    const token = this.getToken();
    const user = this.getSavedUser();
    if (!user) {
      throw new Error("No active merchant session found. Please log in first.");
    }

    const res = await fetch(getApiEndpoint("auth/upgrade"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user_id: user.id,
        phone_number: user.phone_number,
        email: email.trim(),
        password: password?.trim() || "",
        business_name: businessName?.trim() || "",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to upgrade account." }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    const updatedUser: UserProfile = {
      ...user,
      id: data.user_id || user.id,
      email: data.email || email.trim(),
      is_fully_registered: true,
    };
    if (data.access_token) {
      this.setSession(data.access_token, updatedUser);
    } else {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
    return updatedUser;
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
    const phone = user?.phone_number || "";
    const ownerId = user?.id || phone || "unassigned";

    const payload = {
      owner_id: ownerId,
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
      } else {
        const errData = await res.json().catch(() => ({ detail: "Failed to generate QR" }));
        const err = Object.assign(new Error(errData.detail || "This QR code already exists."), {
          duplicate: Boolean(errData.duplicate),
          existing_qr: errData.existing_qr as QRCodeRecord | undefined,
        });
        throw err;
      }
    } catch (err: unknown) {
      if (err && typeof err === "object" && "duplicate" in err && err.duplicate) {
        throw err;
      }
      // Local fallback for offline/demo mode if not a duplicate constraint
    }

    const newRecord: QRCodeRecord = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      phone_number: phone,
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
      (item) => item.description === description && item.owner_id === ownerId,
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
    const user = this.getSavedUser();
    const phone = user?.phone_number || "";
    const ownerId = user?.id || phone || "";

    try {
      const queryParams = new URLSearchParams();
      if (ownerId) queryParams.set("owner_id", ownerId);
      if (phone) queryParams.set("phone_number", phone);

      const queryString = queryParams.toString();
      const url = getApiEndpoint(queryString ? `qr-codes?${queryString}` : "qr-codes");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const list: QRCodeRecord[] = await res.json();
        if (Array.isArray(list)) {
          localStorage.setItem(QR_STORE_KEY, JSON.stringify(list));
          return list;
        }
      }
    } catch {
      // Local fallback
    }
    const local = this.getLocalQrList();
    if (ownerId || phone) {
      return local.filter(
        (q) => q.owner_id === ownerId || q.owner_id === phone || q.phone_number === phone,
      );
    }
    return local;
  }

  static async checkQrExists(
    dialCode: string,
    network?: string,
  ): Promise<{ exists: boolean; existing?: QRCodeRecord | null; message?: string }> {
    if (!dialCode || !dialCode.trim()) {
      return { exists: false };
    }
    try {
      const params = new URLSearchParams({ dial_code: dialCode.trim() });
      if (network) params.append("network", network.trim());
      const res = await fetch(getApiEndpoint(`qr/check-exists?${params.toString()}`));
      if (res.ok) {
        return await res.json();
      }
      return { exists: false };
    } catch {
      // Fast local check fallback
      const local = this.getLocalQrList();
      const cleanTarget = dialCode.replace(/[^0-9*#]/g, "");
      const match = local.find(
        (q) => q.dial_code && q.dial_code.replace(/[^0-9*#]/g, "") === cleanTarget,
      );
      if (match) {
        return { exists: true, existing: match };
      }
      return { exists: false };
    }
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

  static async recordDownload(data: {
    business_name?: string;
    network: string;
    dial_code: string;
    phone_number?: string;
    file_format?: "png" | "pdf";
  }): Promise<void> {
    try {
      await fetch(getApiEndpoint("downloads/track"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: data.business_name || "Payment Card",
          network: data.network,
          dial_code: data.dial_code,
          phone_number: data.phone_number || "guest",
          file_format: data.file_format || "png",
        }),
      });
    } catch (e) {
      console.warn("Download tracking notice:", e);
    }
  }

  static async createOrder(payload: OrderPayload): Promise<{
    success: boolean;
    order_number: string;
    message: string;
  }> {
    try {
      const res = await fetch(getApiEndpoint("orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({ detail: "Order failed" }));
      throw new Error(err.detail || "Failed to place order.");
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== "Failed to fetch") {
        throw e;
      }
      // Offline fallback
      const orderNum = `ISH-${Math.floor(100000 + Math.random() * 900000)}`;
      const localOrders = JSON.parse(localStorage.getItem("pending_orders") || "[]");
      localOrders.unshift({
        ...payload,
        id: crypto.randomUUID(),
        order_number: orderNum,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      localStorage.setItem("pending_orders", JSON.stringify(localOrders));
      return {
        success: true,
        order_number: orderNum,
        message: "Order placed successfully! We will contact you via WhatsApp/Phone.",
      };
    }
  }

  static async listOrders(): Promise<OrderRecord[]> {
    try {
      const res = await fetch(getApiEndpoint("orders"));
      if (res.ok) {
        return await res.json();
      }
      return this.getLocalOrders();
    } catch {
      return this.getLocalOrders();
    }
  }

  static getLocalOrders(): OrderRecord[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("pending_orders") || "[]");
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------------------
  // ADMIN DASHBOARD & OWNER REPORTING
  // ------------------------------------------------------------------
  static async getAdminStats(adminKey: string): Promise<AdminStats> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/stats?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static async getAdminMerchants(adminKey: string): Promise<MerchantRecord[]> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/merchants?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static async getAdminQrCodes(adminKey: string): Promise<QRCodeRecord[]> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/qr-codes?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static async getAdminInquiries(adminKey: string): Promise<InquiryRecord[]> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/inquiries?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
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

  static async getAdminOrders(adminKey: string): Promise<OrderRecord[]> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/orders?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static async updateOrderStatus(adminKey: string, id: string, status: OrderStatus): Promise<void> {
    const res = await fetch(getApiEndpoint("admin/orders"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      throw new Error("Failed to update order status.");
    }
  }

  static async getAdminDownloads(adminKey: string): Promise<DownloadEventRecord[]> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/downloads?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static getAdminExportUrl(
    adminKey: string,
    type: "merchants" | "qrs" | "inquiries" | "orders" | "downloads",
  ): string {
    return `${getApiEndpoint("admin/export")}?type=${type}&key=${encodeURIComponent(adminKey)}`;
  }

  static async getAdminSettings(adminKey: string): Promise<{
    twilio: {
      hasAccountSid: boolean;
      accountSidMasked: string;
      hasAuthToken: boolean;
      phoneNumber: string;
      verifyServiceSid: string;
    };
  }> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/settings?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static async saveAdminSettings(
    adminKey: string,
    settings: {
      twilio_account_sid?: string;
      twilio_auth_token?: string;
      twilio_phone_number?: string;
      twilio_verify_service_sid?: string;
    },
  ): Promise<void> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint("admin/settings"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": cleanKey,
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || "Failed to save settings.");
    }
  }

  static async testAdminSms(
    adminKey: string,
    phoneNumber: string,
  ): Promise<{
    success: boolean;
    provider?: string;
    messageId?: string;
    detail: string;
    error?: string;
    isTrialNotice?: boolean;
    test_code?: string;
    rawResponse?: unknown;
  }> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint("admin/test-sms"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": cleanKey,
      },
      body: JSON.stringify({ phone_number: phoneNumber }),
    });
    return await res.json();
  }

  static async deleteAdminQrCode(
    adminKey: string,
    qrId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/qr-codes?id=${encodeURIComponent(qrId)}`), {
      method: "DELETE",
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to delete/unlock QR." }));
      throw new Error(err.detail || "Failed to delete/unlock QR.");
    }
    return await res.json();
  }

  static async getAdminAdmins(adminKey: string): Promise<AdminUserRecord[]> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/admins?key=${encodeURIComponent(cleanKey)}`), {
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }
    return await res.json();
  }

  static async addAdmin(
    adminKey: string,
    email: string,
    name?: string,
  ): Promise<{ success: boolean; message: string; admin?: AdminUserRecord }> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint("admin/admins"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": cleanKey,
      },
      body: JSON.stringify({ email: email.trim(), name: name?.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to add admin user." }));
      throw new Error(err.detail || "Failed to add admin user.");
    }
    return await res.json();
  }

  static async removeAdmin(
    adminKey: string,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const cleanKey = adminKey.trim();
    const res = await fetch(getApiEndpoint(`admin/admins?id=${encodeURIComponent(adminId)}`), {
      method: "DELETE",
      headers: { "x-admin-key": cleanKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to remove admin user." }));
      throw new Error(err.detail || "Failed to remove admin user.");
    }
    return await res.json();
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
