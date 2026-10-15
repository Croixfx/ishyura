// Serverless API Router supporting Cloudflare D1 and Local In-Memory Fallback

import {
  sendRealOtpSms,
  checkTwilioVerifyCode,
  formatToE164,
  type SmsEnvConfig,
} from "./sms-service";
import { handleEdgePayPage } from "./edge-pay-renderer";
import { extractMerchantOrAccountCode } from "./momo-formatters";
import { ensurePaymentDomainSchema } from "./payment/d1-bootstrap";
import { inferPaymentMode, publicIdFromInternalId } from "./payment/identity";
import { mapNetworkToProvider } from "./payment/ussd";
import { ORDER_UNIT_PRICES, MAX_ORDER_QUANTITY, isCatalogItem } from "./order-catalog";
import { canGenerateOffline, canDownloadPdf, isProActive, MONETIZATION_PRICES } from "./payment";

export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

export interface AppEnv extends SmsEnvConfig {
  DB?: D1Database;
  ADMIN_SECRET?: string;
  /** Comma-separated extra Google OAuth client IDs accepted when verifying Google sign-in. */
  GOOGLE_CLIENT_IDS?: string;
  /** Optional separate signing secret for sessions (defaults to ADMIN_SECRET). */
  SESSION_SECRET?: string;
  /** Set to "true" ONLY in local dev to accept OTP 123456 for non-admin phones. */
  ALLOW_TEST_OTP?: string;
}

// In-memory fallback stores when D1 is not attached (e.g. local dev / preview)
interface MemMerchant {
  id: string;
  phone_number: string;
  is_fully_registered: boolean;
  email: string | null;
  created_at: string;
  last_active_at: string;
}

interface MemQrCode {
  id: string;
  owner_id: string;
  phone_number: string;
  business_name: string;
  network: string;
  payment_type: string;
  dial_code: string;
  description: string;
  amount: number | null;
  item_name?: string | null;
  is_dynamic?: boolean | number;
  public_id?: string | null;
  destination_id?: string | null;
  payment_mode?: string | null;
  config_version?: number | null;
  status?: string | null;
  created_at: string;
}

interface MemInquiry {
  id: string;
  sender_name: string;
  sender_phone: string;
  sender_email: string | null;
  subject: string;
  message: string;
  status: "new" | "resolved";
  created_at: string;
}

interface MemOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  business_name: string;
  delivery_location: string;
  item_type: string;
  quantity: number;
  total_price: number;
  notes: string | null;
  network: string | null;
  dial_code: string | null;
  status: "pending" | "processing" | "delivered" | "cancelled";
  merchant_id?: string | null;
  qr_code_id?: string | null;
  qr_kind?: "online" | "offline" | null;
  qr_label?: string | null;
  merchant_deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface MemDownload {
  id: string;
  business_name: string;
  network: string;
  dial_code: string;
  phone_number: string | null;
  file_format: string;
  created_at: string;
}

interface MemAdmin {
  id: string;
  email: string;
  name: string;
  phone_number?: string | null;
  role: "admin";
  created_at: string;
}

const memAdmins: Map<string, MemAdmin> = new Map([
  [
    "jeanniyonkuru29@gmail.com",
    {
      id: "admin-owner",
      email: "jeanniyonkuru29@gmail.com",
      name: "Jeanni (Owner & Superadmin)",
      phone_number: "+250788000001",
      role: "admin",
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
  ],
  [
    "valensbikorimana70@gmail.com",
    {
      id: "admin-valens",
      email: "valensbikorimana70@gmail.com",
      name: "Valens (Admin)",
      phone_number: "+250788000002",
      role: "admin",
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
  ],
]);

const memMerchants: Map<string, MemMerchant> = new Map([
  [
    "0788123456",
    {
      id: "m-sample-1",
      phone_number: "0788123456",
      is_fully_registered: false,
      email: null,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      last_active_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  [
    "0791234567",
    {
      id: "m-sample-2",
      phone_number: "0791234567",
      is_fully_registered: true,
      email: "kigali.market@example.rw",
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      last_active_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
]);

interface MemEntitlement {
  granted_count: number;
  consumed_count: number;
  valid_until?: string | null;
}

const memEntitlements: Map<string, Map<string, MemEntitlement>> = new Map();

function getMemEntitlements(merchantId: string): Map<string, MemEntitlement> {
  let map = memEntitlements.get(merchantId);
  if (!map) {
    map = new Map<string, MemEntitlement>([
      ["offline_qr_generation", { granted_count: 1, consumed_count: 0 }],
      ["pdf_export", { granted_count: 1, consumed_count: 0 }],
      ["dynamic_pro_subscription", { granted_count: 0, consumed_count: 0, valid_until: null }],
    ]);
    memEntitlements.set(merchantId, map);
  }
  return map;
}

const memQrCodes: MemQrCode[] = [
  {
    id: "qr-1",
    owner_id: "m-sample-1",
    phone_number: "0788123456",
    business_name: "Kigali Fresh Mart",
    network: "MTN Mobile Money",
    payment_type: "momo_code",
    dial_code: "*182*8*1*123456#",
    description: "Kigali Fresh Mart (MTN Mobile Money - 123456)",
    amount: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "qr-2",
    owner_id: "m-sample-2",
    phone_number: "0791234567",
    business_name: "Remera Auto Spares",
    network: "Equity Bank (eKash)",
    payment_type: "momo_code",
    dial_code: "*555#",
    description: "Remera Auto Spares (Equity Bank (eKash) - 0788000111)",
    amount: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const memInquiries: MemInquiry[] = [
  {
    id: "inq-1",
    sender_name: "Jean Paul Habimana",
    sender_phone: "0788456789",
    sender_email: "jp.habimana@gmail.com",
    subject: "Bulk Merchant Stands for Market",
    message:
      "Hello Ishyura team, we have 15 cooperative vendors in Kimironko Market and would like customized acrylic QR tent stands. How can we proceed?",
    status: "new",
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

const memOrders: MemOrder[] = [
  {
    id: "ord-1",
    order_number: "ISH-782190",
    customer_name: "Aline Uwase",
    customer_phone: "0788223344",
    business_name: "Chez Aline Boutique",
    delivery_location: "Kimironko Market, Stall 42B",
    item_type: "acrylic_stand",
    quantity: 1,
    total_price: 5000,
    notes: "Please call when moto arrives at the gate",
    network: "MTN MoMo",
    dial_code: "*182*8*1*234567#",
    status: "pending",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const memDownloads: MemDownload[] = [
  {
    id: "dl-1",
    business_name: "Kigali Fresh Mart",
    network: "MTN MoMo",
    dial_code: "*182*8*1*123456#",
    phone_number: "0788123456",
    file_format: "png",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

/** What the merchant had typed in when they were asked to pay first; the QR is created from it once approved. */
interface QrDraft {
  business_name: string;
  network: string;
  payment_type: string;
  dial_code: string;
  amount: number | null;
  item_name: string | null;
  is_dynamic: boolean;
}

function sanitizeDraft(input: unknown): QrDraft | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const businessName = str(d.business_name, 120);
  const dialCode = str(d.dial_code, 64);
  if (!businessName || !dialCode) return null;
  const amount =
    typeof d.amount === "number" && Number.isSafeInteger(d.amount) && d.amount > 0
      ? d.amount
      : null;
  return {
    business_name: businessName,
    network: str(d.network, 40) || "MTN MoMo",
    payment_type: str(d.payment_type, 30) || "momo_code",
    dial_code: dialCode,
    amount,
    item_name: str(d.item_name, 120) || null,
    is_dynamic: Boolean(d.is_dynamic),
  };
}

function parseDraftJson(raw: unknown): QrDraft | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return sanitizeDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

interface MemPaymentRequest {
  id: string;
  merchant_id: string;
  merchant_phone: string;
  // Includes legacy/DB aliases (migration 0003 uses offline_generation / pro_subscription).
  requested_entitlement:
    | "offline_qr_generation"
    | "offline_generation"
    | "pdf_download"
    | "pdf_export"
    | "pro_monthly"
    | "pro_subscription"
    | "dynamic_pro_subscription";
  amount: number;
  currency: string;
  reference_code: string;
  status: "pending" | "approved" | "rejected";
  draft?: QrDraft | null;
  fulfilled_qr_id?: string | null;
  evidence_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

const memPaymentRequests: MemPaymentRequest[] = [
  {
    id: "payreq-sample-1",
    merchant_id: "m-sample-1",
    merchant_phone: "0788123456",
    requested_entitlement: "offline_qr_generation",
    amount: 2000,
    currency: "RWF",
    reference_code: "PAY-839201",
    status: "pending",
    evidence_notes: "Paid via MTN MoMo to Ishyura Merchant",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

const memOtps: Map<string, string> = new Map();

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-device-id",
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

// ----------------------------------------------------
// SESSIONS & ADMIN AUTH
// Sessions are stateless HMAC-signed tokens (valid across Worker isolates), issued only after the
// caller proves their identity at login (OTP, verified Google token, or password). Every
// merchant/admin endpoint derives identity from the verified token, never from request fields.
// ADMIN_SECRET (or SESSION_SECRET) must be set as a Worker secret; there is no built-in default.
// ----------------------------------------------------
const SESSION_PREFIX = "ishyura-session";
const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;
const MERCHANT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 16;
const DEFAULT_GOOGLE_CLIENT_ID =
  "502837741120-e83vucg1fvlv3upm4jnfpm0r8hr1bp47.apps.googleusercontent.com";

interface Session {
  sub: string;
  role: "admin" | "merchant";
  phone: string | null;
  email: string | null;
}

/** Break-glass admin key: compared directly, never used to sign. */
function getAdminSecret(env?: AppEnv): string | null {
  const secret = (env?.ADMIN_SECRET || "").trim();
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function getSessionSecret(env?: AppEnv): string | null {
  const secret = (env?.SESSION_SECRET || env?.ADMIN_SECRET || "").trim();
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Length-independent, constant-time string comparison. */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function getSessionKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${SESSION_PREFIX}-key:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function issueSessionToken(
  env: AppEnv,
  claims: { sub: string; role: "admin" | "merchant"; phone?: string | null; email?: string | null },
): Promise<string | null> {
  const secret = getSessionSecret(env);
  if (!secret) return null;
  const ttl = claims.role === "admin" ? ADMIN_SESSION_TTL_SECONDS : MERCHANT_SESSION_TTL_SECONDS;
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        sub: claims.sub,
        role: claims.role,
        phone: claims.phone || null,
        email: claims.email || null,
        exp: Math.floor(Date.now() / 1000) + ttl,
      }),
    ),
  );
  const key = await getSessionKey(secret, "sign");
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${SESSION_PREFIX}.${payload}`),
  );
  return `${SESSION_PREFIX}.${payload}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

function issueAdminSessionToken(
  env: AppEnv,
  subject: string,
  email?: string | null,
): Promise<string | null> {
  return issueSessionToken(env, { sub: subject, role: "admin", email });
}

async function readSessionToken(token: string, secret: string): Promise<Session | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_PREFIX) return null;
  const [, payload, signature] = parts as [string, string, string];
  const sigBytes = base64UrlToBytes(signature);
  const payloadBytes = base64UrlToBytes(payload);
  if (!sigBytes || !payloadBytes) return null;
  const key = await getSessionKey(secret, "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(`${SESSION_PREFIX}.${payload}`),
  );
  if (!valid) return null;
  try {
    const c = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      sub?: string;
      role?: string;
      phone?: string | null;
      email?: string | null;
      exp?: number;
    };
    if (typeof c.exp !== "number" || c.exp <= Date.now() / 1000) return null;
    if (!c.sub || (c.role !== "admin" && c.role !== "merchant")) return null;
    return { sub: c.sub, role: c.role, phone: c.phone || null, email: c.email || null };
  } catch {
    return null;
  }
}

/** Verified session from `Authorization: Bearer` (or `x-admin-key`); null if absent or invalid. */
async function getSession(request: Request, env?: AppEnv): Promise<Session | null> {
  const secret = getSessionSecret(env);
  if (!secret) return null;
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const header = (request.headers.get("x-admin-key") || "").trim();
  for (const val of [bearer, header]) {
    if (!val.startsWith(`${SESSION_PREFIX}.`)) continue;
    const session = await readSessionToken(val, secret);
    if (session) return session;
  }
  return null;
}

/** Every identifier the caller is known by, in the forms legacy rows store them. */
function sessionIdentities(session: Session): Set<string> {
  const ids = new Set<string>([session.sub]);
  if (session.phone) {
    const p = session.phone.trim();
    ids.add(p);
    ids.add(p.replace(/^\+/, ""));
    ids.add(p.replace(/^\+?250/, "0"));
  }
  if (session.email) ids.add(session.email.toLowerCase());
  return ids;
}

function ownsRecord(
  session: Session,
  row: { owner_id?: string | null; phone_number?: string | null; merchant_id?: string | null },
): boolean {
  const ids = sessionIdentities(session);
  return [row.owner_id, row.phone_number, row.merchant_id].some((v) => Boolean(v) && ids.has(v!));
}

/**
 * Accepts either a signed admin session token or the ADMIN_SECRET itself (break-glass),
 * via `x-admin-key` or `Authorization: Bearer`. `allowQueryToken` additionally accepts a signed
 * session token (never the raw secret) in `?key=` for plain browser downloads that cannot set headers.
 */
async function verifyAdminAuth(
  request: Request,
  env?: AppEnv,
  opts: { allowQueryToken?: boolean } = {},
): Promise<boolean> {
  const adminSecret = getAdminSecret(env);
  const sessionSecret = getSessionSecret(env);
  if (!adminSecret && !sessionSecret) return false;

  const header = (request.headers.get("x-admin-key") || "").trim();
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const query = opts.allowQueryToken
    ? (new URL(request.url).searchParams.get("key") || "").trim()
    : "";

  const isAdminToken = async (val: string) => {
    if (!sessionSecret) return false;
    return (await readSessionToken(val, sessionSecret))?.role === "admin";
  };

  for (const val of [header, bearer]) {
    if (!val) continue;
    if (adminSecret && constantTimeEqual(val, adminSecret)) return true;
    if (await isAdminToken(val)) return true;
  }
  return query ? isAdminToken(query) : false;
}

/** PBKDF2-SHA256 hash: `pbkdf2$<iterations>$<salt>$<hash>` (Workers cap iterations at 100k). */
const PBKDF2_ITERATIONS = 100_000;

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${hash}`;
}

async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iter, saltB64, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !saltB64 || !hash) return false;
  const salt = base64UrlToBytes(saltB64);
  const iterations = Number(iter);
  if (!salt || !Number.isInteger(iterations) || iterations < 1 || iterations > 100_000) {
    return false;
  }
  return constantTimeEqual(await derivePasswordHash(password, salt, iterations), hash);
}

let appColumnsChecked = false;
/**
 * Tables created by the original migrations lack columns the app relies on. Add whichever are
 * missing, once per Worker instance (merchants: password/business/role; orders: QR link and
 * merchant-side deletion).
 */
async function ensureAppColumns(db: D1Database): Promise<void> {
  if (appColumnsChecked) return;
  const columns: Array<[string, string, string]> = [
    ["merchants", "password_hash", "TEXT"],
    ["merchants", "business_name", "TEXT"],
    ["merchants", "role", "TEXT DEFAULT 'merchant'"],
    ["orders", "merchant_id", "TEXT"],
    ["orders", "qr_code_id", "TEXT"],
    ["orders", "qr_kind", "TEXT"],
    ["orders", "qr_label", "TEXT"],
    ["orders", "merchant_deleted_at", "TEXT"],
    ["payment_requests", "draft_json", "TEXT"],
    ["payment_requests", "fulfilled_qr_id", "TEXT"],
    ["merchants", "deactivated_at", "TEXT"],
    ["merchants", "deactivated_reason", "TEXT"],
  ];
  for (const [table, name, type] of columns) {
    try {
      await db.prepare(`SELECT ${name} FROM ${table} LIMIT 1`).first();
    } catch {
      try {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      } catch {
        // column raced into existence, or the table is created later by ensureD1Tables
      }
    }
  }
  appColumnsChecked = true;
}

// ----------------------------------------------------
// RATE LIMITING (fixed window, D1-backed so it holds across Worker isolates)
// ----------------------------------------------------
const OTP_VERIFY_MAX_FAILURES = 5; // per phone, per window; the code is burned when reached
const OTP_VERIFY_IP_MAX_FAILURES = 20; // per IP, per window
const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_MAX = 5; // SMS sends per phone per window
const OTP_REQUEST_IP_MAX = 20; // SMS sends per IP per window
const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_LOGIN_MAX_FAILURES = 5; // per account identifier, per window
const PASSWORD_LOGIN_IP_MAX_FAILURES = 20; // per IP, per window
const PASSWORD_LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** What each purchasable entitlement costs. The server decides the amount; clients never do. */
const ENTITLEMENT_PRICES: Record<string, number> = {
  offline_qr_generation: MONETIZATION_PRICES.extra_offline_generation,
  pdf_download: MONETIZATION_PRICES.pdf_download,
  pro_monthly: MONETIZATION_PRICES.pro_monthly,
};
const MAX_PENDING_PAYMENT_REQUESTS = 5;
const ORDER_WINDOW_MS = 60 * 60 * 1000;
const ORDER_MAX_PER_PHONE = 5;
const ORDER_MAX_PER_IP = 20;

const memRateLimits = new Map<string, { count: number; start: number }>();
let rateLimitTableReady = false;

async function ensureRateLimitTable(db: D1Database): Promise<void> {
  if (rateLimitTableReady) return;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);",
  );
  rateLimitTableReady = true;
}

/** Current usage of a window; an expired window counts as empty. */
async function rateLimitPeek(
  env: AppEnv,
  key: string,
  windowMs: number,
): Promise<{ count: number; retryAfterSec: number }> {
  const now = Date.now();
  let row: { count: number; start: number } | null = null;
  if (env.DB) {
    await ensureRateLimitTable(env.DB);
    const r = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
      .bind(key)
      .first<{ count: number; window_start: number }>();
    if (r) row = { count: r.count, start: r.window_start };
  } else {
    row = memRateLimits.get(key) || null;
  }
  if (!row || now - row.start >= windowMs) return { count: 0, retryAfterSec: 0 };
  return {
    count: row.count,
    retryAfterSec: Math.max(1, Math.ceil((row.start + windowMs - now) / 1000)),
  };
}

/** Records one hit and returns the new count for the window. */
async function rateLimitHit(env: AppEnv, key: string, windowMs: number): Promise<number> {
  const now = Date.now();
  if (env.DB) {
    await ensureRateLimitTable(env.DB);
    await env.DB.prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) " +
        "ON CONFLICT(key) DO UPDATE SET " +
        "count = CASE WHEN ? - window_start >= ? THEN 1 ELSE count + 1 END, " +
        "window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END",
    )
      .bind(key, now, now, windowMs, now, windowMs, now)
      .run();
    const r = await env.DB.prepare("SELECT count FROM rate_limits WHERE key = ?")
      .bind(key)
      .first<{ count: number }>();
    return r?.count ?? 1;
  }
  const cur = memRateLimits.get(key);
  if (!cur || now - cur.start >= windowMs) {
    memRateLimits.set(key, { count: 1, start: now });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

async function rateLimitReset(env: AppEnv, key: string): Promise<void> {
  if (env.DB) {
    await ensureRateLimitTable(env.DB);
    await env.DB.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
  } else {
    memRateLimits.delete(key);
  }
}

function tooManyAttempts(retryAfterSec: number, detail: string): Response {
  const res = jsonResponse({ error: "RATE_LIMITED", detail, retry_after: retryAfterSec }, 429);
  res.headers.set("Retry-After", String(retryAfterSec));
  return res;
}

function clientIp(request: Request): string {
  return (request.headers.get("CF-Connecting-IP") || "").trim();
}

// ----------------------------------------------------
// ONE DEVICE, ONE MERCHANT ACCOUNT
// The browser keeps a random device id and sends it as `x-device-id` when signing in. The server
// remembers which merchant accounts have signed in from which device and refuses a second one.
// This is a deterrent for casual duplicate accounts, not a guarantee: clearing site data or using
// another browser gives a new device id. One account may use any number of devices. Admins are exempt.
// ----------------------------------------------------
const memDeviceLinks = new Map<string, Set<string>>();
let deviceTableReady = false;

function readDeviceId(request: Request): string | null {
  const v = (request.headers.get("x-device-id") || "").trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

async function ensureDeviceTable(db: D1Database): Promise<void> {
  if (deviceTableReady) return;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS device_accounts (device_id TEXT NOT NULL, merchant_id TEXT NOT NULL, first_seen_at TEXT DEFAULT (datetime('now')), last_seen_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (device_id, merchant_id));",
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_device_accounts_merchant ON device_accounts(merchant_id);",
  );
  deviceTableReady = true;
}

// ----------------------------------------------------
// ACCOUNT DEACTIVATION + AUDIT TRAIL
// ----------------------------------------------------
const DEACTIVATED_DETAIL =
  "This account has been deactivated by Ishyura. Please contact support if you think this is a mistake.";

function deactivatedResponse(): Response {
  return jsonResponse({ error: "ACCOUNT_DEACTIVATED", detail: DEACTIVATED_DETAIL }, 403);
}

/**
 * True when the merchant behind this identity has been deactivated by an admin. Admin accounts can
 * never be deactivated, so they are never reported here.
 */
async function isDeactivated(
  env: AppEnv,
  who: { id?: string | null; phone?: string | null; email?: string | null },
): Promise<boolean> {
  const id = (who.id || "").trim();
  const phone = (who.phone || "").trim();
  const email = (who.email || "").trim().toLowerCase();
  if (!id && !phone && !email) return false;
  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        "SELECT id FROM merchants WHERE deactivated_at IS NOT NULL AND COALESCE(role, 'merchant') != 'admin' " +
          "AND (id = ? OR phone_number = ? OR LOWER(COALESCE(email, '')) = ?) LIMIT 1",
      )
        .bind(id || "-", phone || "-", email || "-")
        .first();
      return Boolean(row);
    } catch {
      return false;
    }
  }
  return false;
}

type AuditEvent =
  "qr_created" | "qr_deleted" | "card_exported" | "account_deactivated" | "account_reactivated";

interface AuditInput {
  event: AuditEvent;
  /** "qr" = printed payment QR card, "nfc_stand" = smart stand (QR + NFC tag). */
  kind?: "qr" | "nfc_stand" | null;
  qrId?: string | null;
  /** The merchant that owns the card or account the event is about. */
  ownerId?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  label?: string | null;
  dialCode?: string | null;
  actor?: { id?: string | null; role: "admin" | "merchant" | "system" } | null;
  detail?: string | null;
}

interface AuditRow {
  id: string;
  event_type: string;
  kind: string | null;
  qr_id: string | null;
  owner_id: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_name: string | null;
  actor_id: string | null;
  actor_role: string | null;
  label: string | null;
  dial_code: string | null;
  detail: string | null;
  created_at: string;
}

const memAudit: AuditRow[] = [];
let auditTableReady = false;

async function ensureAuditTable(db: D1Database): Promise<void> {
  if (auditTableReady) return;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, kind TEXT, qr_id TEXT, owner_id TEXT, owner_phone TEXT, owner_email TEXT, owner_name TEXT, actor_id TEXT, actor_role TEXT, label TEXT, dial_code TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now')));",
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_audit_events_owner ON audit_events(owner_id);");
  auditTableReady = true;
}

/**
 * Append one audit entry that names the owner of the card or account. The owner is looked up at the
 * time of the event and stored on the row, so the record stays readable if the account changes later.
 * Auditing never fails the request it describes.
 */
async function recordAudit(env: AppEnv, a: AuditInput): Promise<void> {
  try {
    let ownerId = (a.ownerId || "").trim() || null;
    let ownerPhone = (a.ownerPhone || "").trim() || null;
    let ownerEmail: string | null = (a.ownerEmail || "").trim() || null;
    let ownerName: string | null = (a.ownerName || "").trim() || null;

    if (env.DB) {
      await ensureAuditTable(env.DB);
      if (ownerId || ownerPhone || ownerEmail) {
        const m = await env.DB.prepare(
          "SELECT id, phone_number, email, business_name FROM merchants WHERE id = ? OR phone_number = ? OR email = ? LIMIT 1",
        )
          .bind(ownerId || "-", ownerPhone || ownerId || "-", ownerEmail || ownerId || "-")
          .first<{
            id: string;
            phone_number: string | null;
            email: string | null;
            business_name: string | null;
          }>();
        if (m) {
          ownerId = m.id;
          ownerPhone = m.phone_number || ownerPhone;
          ownerEmail = m.email || ownerEmail;
          ownerName = m.business_name || ownerName;
        }
      }
    } else {
      const m = [...memMerchants.values()].find(
        (x) =>
          (ownerId && x.id === ownerId) ||
          (ownerPhone && x.phone_number === ownerPhone) ||
          (ownerEmail && x.email === ownerEmail) ||
          (ownerId && x.email === ownerId),
      );
      if (m) {
        ownerId = m.id;
        ownerPhone = m.phone_number || ownerPhone;
        ownerEmail = m.email || ownerEmail;
        ownerName = m.business_name || ownerName;
      }
    }

    if (!ownerName && a.label) {
      ownerName = a.label;
    }

    const row: AuditRow = {
      id: crypto.randomUUID(),
      event_type: a.event,
      kind: a.kind || null,
      qr_id: a.qrId || null,
      owner_id: ownerId,
      owner_phone: ownerPhone,
      owner_email: ownerEmail,
      owner_name: ownerName,
      actor_id: a.actor?.id || null,
      actor_role: a.actor?.role || null,
      label: a.label || null,
      dial_code: a.dialCode || null,
      detail: a.detail || null,
      created_at: new Date().toISOString(),
    };

    if (env.DB) {
      await env.DB.prepare(
        "INSERT INTO audit_events (id, event_type, kind, qr_id, owner_id, owner_phone, owner_email, owner_name, actor_id, actor_role, label, dial_code, detail) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          row.id,
          row.event_type,
          row.kind,
          row.qr_id,
          row.owner_id,
          row.owner_phone,
          row.owner_email,
          row.owner_name,
          row.actor_id,
          row.actor_role,
          row.label,
          row.dial_code,
          row.detail,
        )
        .run();
    } else {
      memAudit.unshift(row);
      if (memAudit.length > 500) memAudit.length = 500;
    }
  } catch (err) {
    console.warn("Audit entry could not be recorded:", err);
  }
}

function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 7
    ? `+${d.slice(0, 3)} ${d.slice(3, 5)}* *** ${d.slice(-3)}`
    : "your other account";
}

/**
 * A response refusing the sign-in if this device already belongs to a *different* merchant account,
 * otherwise null. `candidateMerchantId` is the account being signed in to ("" if it does not exist yet).
 */
async function deviceConflict(
  env: AppEnv,
  request: Request,
  candidateMerchantId: string,
  isAdmin: boolean,
): Promise<Response | null> {
  const deviceId = readDeviceId(request);
  if (!deviceId || isAdmin) return null;

  let other: { id: string; email: string | null; phone: string | null } | null = null;
  if (env.DB) {
    await ensureDeviceTable(env.DB);
    other = await env.DB.prepare(
      "SELECT m.id AS id, m.email AS email, m.phone_number AS phone FROM device_accounts d " +
        "JOIN merchants m ON m.id = d.merchant_id " +
        "WHERE d.device_id = ? AND d.merchant_id != ? AND COALESCE(m.role, 'merchant') != 'admin' LIMIT 1",
    )
      .bind(deviceId, candidateMerchantId)
      .first<{ id: string; email: string | null; phone: string | null }>();
  } else {
    const linked = [...(memDeviceLinks.get(deviceId) || [])].find(
      (id) => id !== candidateMerchantId,
    );
    if (linked) {
      const m = [...memMerchants.values()].find((x) => x.id === linked);
      other = { id: linked, email: m?.email ?? null, phone: m?.phone_number ?? null };
    }
  }
  if (!other) return null;

  const hint = other.email
    ? maskEmail(other.email)
    : other.phone && !other.phone.startsWith("g-")
      ? maskPhone(other.phone)
      : "your other account";
  return jsonResponse(
    {
      error: "DEVICE_HAS_ACCOUNT",
      detail: `This phone or browser is already used by another Ishyura account (${hint}). Each person can only own one account. Please sign in with that account instead.`,
      existing_account: hint,
    },
    409,
  );
}

/** Remember that this merchant account has signed in from this device. */
async function linkDevice(
  env: AppEnv,
  request: Request,
  merchantId: string,
  isAdmin: boolean,
): Promise<void> {
  const deviceId = readDeviceId(request);
  if (!deviceId || isAdmin || !merchantId) return;
  if (env.DB) {
    await ensureDeviceTable(env.DB);
    await env.DB.prepare(
      "INSERT INTO device_accounts (device_id, merchant_id) VALUES (?, ?) " +
        "ON CONFLICT(device_id, merchant_id) DO UPDATE SET last_seen_at = datetime('now')",
    )
      .bind(deviceId, merchantId)
      .run();
    return;
  }
  const set = memDeviceLinks.get(deviceId) || new Set<string>();
  set.add(merchantId);
  memDeviceLinks.set(deviceId, set);
}

/** Admin identity comes from the database when attached, otherwise the in-memory seed list. */
async function isAdminIdentity(
  env: AppEnv,
  who: { email?: string | null; phones?: string[] },
): Promise<boolean> {
  const email = (who.email || "").trim().toLowerCase();
  const phones = (who.phones || []).filter(Boolean);
  if (env.DB) {
    try {
      const conditions: string[] = [];
      const binds: string[] = [];
      if (email) {
        conditions.push("email = ?");
        binds.push(email);
      }
      for (const p of phones) {
        conditions.push("phone_number = ?");
        binds.push(p);
      }
      if (!conditions.length) return false;
      const row = await env.DB.prepare(
        `SELECT id FROM system_admins WHERE ${conditions.join(" OR ")} LIMIT 1`,
      )
        .bind(...binds)
        .first();
      return Boolean(row);
    } catch {
      // table unavailable: fall through to the in-memory list
    }
  }
  if (email && memAdmins.has(email)) return true;
  for (const a of memAdmins.values()) {
    if (a.phone_number && phones.includes(a.phone_number)) return true;
  }
  return false;
}

/** Confirms a Google identity server-side; the client-supplied email alone is never trusted. */
async function verifyGoogleIdentity(
  env: AppEnv,
  creds: { id_token?: string; access_token?: string },
): Promise<{ email: string; sub: string } | null> {
  const param = creds.id_token
    ? `id_token=${encodeURIComponent(creds.id_token)}`
    : creds.access_token
      ? `access_token=${encodeURIComponent(creds.access_token)}`
      : "";
  if (!param) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?${param}`);
    if (!res.ok) return null;
    const info = (await res.json()) as {
      aud?: string;
      azp?: string;
      email?: string;
      email_verified?: string | boolean;
      sub?: string;
      user_id?: string;
    };
    const allowed = [DEFAULT_GOOGLE_CLIENT_ID, ...(env.GOOGLE_CLIENT_IDS || "").split(",")]
      .map((s) => s.trim())
      .filter(Boolean);
    const aud = info.aud || info.azp || "";
    if (!allowed.includes(aud)) {
      console.warn(
        `Google token audience not allowed: ${aud}. Set GOOGLE_CLIENT_IDS to permit it.`,
      );
      return null;
    }
    const verified = info.email_verified === true || info.email_verified === "true";
    if (!info.email || !verified) return null;
    return { email: info.email.trim().toLowerCase(), sub: info.sub || info.user_id || "" };
  } catch {
    return null;
  }
}

function adminAuthUnavailable(): Response {
  return jsonResponse(
    {
      detail:
        "Sign-in is unavailable: ADMIN_SECRET (or SESSION_SECRET) is not configured (min 16 characters). Set it with `wrangler secret put ADMIN_SECRET`.",
    },
    503,
  );
}

let d1Initialized = false;

interface PaymentDestinationSyncInput {
  standId: string;
  merchantId: string;
  businessName: string;
  network: string;
  paymentType: string;
  dialCode: string;
  phoneNumber?: string | null;
  amount?: number | null;
  isDynamic?: boolean | number;
  configVersion?: number;
  status?: string | null;
}

async function syncPaymentDomainRecord(
  db: D1Database,
  input: PaymentDestinationSyncInput,
): Promise<{
  public_id: string;
  destination_id: string;
  config_version: number;
  payment_mode: string;
  status: string;
}> {
  const publicId = publicIdFromInternalId(input.standId);
  const destinationId = `dst_${input.standId}`;
  const currentStand = await db
    .prepare("SELECT config_version, status FROM payment_stands WHERE id = ?")
    .bind(input.standId)
    .first<{ config_version: number; status: string }>();
  const configVersion = input.configVersion ?? (currentStand?.config_version || 0) + 1;
  const standStatus = currentStand?.status || input.status || "active";
  const paymentMode = inferPaymentMode(input.amount);
  const recipientCode = extractMerchantOrAccountCode(input.dialCode, input.phoneNumber);
  const paymentMethod = input.paymentType === "phone" ? "phone" : "merchant_code";
  const destinationMerchantId = input.merchantId || input.phoneNumber || "unknown";
  const currentDestination = await db
    .prepare(
      "SELECT merchant_id, display_name, network, payment_method, recipient_code, version FROM payment_destinations WHERE id = ?",
    )
    .bind(destinationId)
    .first<{
      merchant_id: string;
      display_name: string | null;
      network: string;
      payment_method: string;
      recipient_code: string;
      version: number;
    }>();
  const destinationChanged =
    !currentDestination ||
    currentDestination.merchant_id !== destinationMerchantId ||
    currentDestination.display_name !== input.businessName ||
    currentDestination.network !== input.network ||
    currentDestination.payment_method !== paymentMethod ||
    currentDestination.recipient_code !== recipientCode;
  const destinationVersion = currentDestination
    ? (currentDestination.version || 1) + (destinationChanged ? 1 : 0)
    : 1;

  await db
    .prepare(
      "INSERT INTO payment_stands (id, merchant_id, payment_destination_id, public_id, stand_type, payment_mode, config_version, status, qr_encoding) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET merchant_id = excluded.merchant_id, payment_destination_id = excluded.payment_destination_id, public_id = excluded.public_id, stand_type = excluded.stand_type, payment_mode = excluded.payment_mode, config_version = excluded.config_version, qr_encoding = excluded.qr_encoding, updated_at = datetime('now')",
    )
    .bind(
      input.standId,
      input.merchantId || input.phoneNumber || "unknown",
      destinationId,
      publicId,
      input.isDynamic ? "pro" : "standard",
      paymentMode,
      configVersion,
      standStatus,
      input.isDynamic ? "https_pay" : "tel_ussd",
    )
    .run();

  await db
    .prepare(
      "INSERT INTO payment_destinations (id, merchant_id, display_name, network, payment_method, recipient_code, currency, status, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'RWF', 'active', ?) " +
        "ON CONFLICT(id) DO UPDATE SET merchant_id = excluded.merchant_id, display_name = excluded.display_name, network = excluded.network, payment_method = excluded.payment_method, recipient_code = excluded.recipient_code, version = excluded.version, updated_at = datetime('now')",
    )
    .bind(
      destinationId,
      destinationMerchantId,
      input.businessName,
      input.network,
      paymentMethod,
      recipientCode,
      destinationVersion,
    )
    .run();

  return {
    public_id: publicId,
    destination_id: destinationId,
    config_version: configVersion,
    payment_mode: paymentMode,
    status: standStatus,
  };
}

let d1InitInFlight: Promise<void> | null = null;

/** Initialises tables once per Worker instance; parallel first requests share a single run. */
export function ensureD1Tables(db: D1Database): Promise<void> {
  if (d1Initialized) return Promise.resolve();
  if (!d1InitInFlight) {
    d1InitInFlight = initD1Tables(db).finally(() => {
      d1InitInFlight = null;
    });
  }
  return d1InitInFlight;
}

async function initD1Tables(db: D1Database): Promise<void> {
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        is_fully_registered INTEGER DEFAULT 1,
        email TEXT,
        password_hash TEXT,
        business_name TEXT,
        role TEXT DEFAULT 'merchant',
        created_at TEXT DEFAULT (datetime('now')),
        last_active_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS qr_codes (
        id TEXT PRIMARY KEY,
        owner_id TEXT,
        phone_number TEXT,
        business_name TEXT NOT NULL,
        network TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        dial_code TEXT NOT NULL,
        description TEXT,
        amount REAL,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        sender_name TEXT NOT NULL,
        sender_phone TEXT NOT NULL,
        sender_email TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS otps (
        phone_number TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        business_name TEXT NOT NULL,
        delivery_location TEXT NOT NULL,
        item_type TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        total_price REAL NOT NULL,
        notes TEXT,
        network TEXT,
        dial_code TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS download_events (
        id TEXT PRIMARY KEY,
        business_name TEXT,
        network TEXT NOT NULL,
        dial_code TEXT NOT NULL,
        phone_number TEXT,
        file_format TEXT DEFAULT 'png',
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS system_admins (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        phone_number TEXT,
        name TEXT,
        role TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE INDEX IF NOT EXISTS idx_qr_codes_owner ON qr_codes(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_qr_codes_phone ON qr_codes(phone_number);`,
      `CREATE INDEX IF NOT EXISTS idx_qr_codes_dial ON qr_codes(dial_code);`,
      `CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);`,
      `CREATE INDEX IF NOT EXISTS idx_downloads_created ON download_events(created_at);`,
      `INSERT OR IGNORE INTO system_admins (id, email, name, role) VALUES ('admin-owner', 'jeanniyonkuru29@gmail.com', 'Jeanni (Owner & Superadmin)', 'admin');`,
      `INSERT OR IGNORE INTO system_admins (id, email, name, role) VALUES ('admin-valens', 'valensbikorimana70@gmail.com', 'Valens (Admin)', 'admin');`,
    ];

    if (typeof db.exec === "function") {
      try {
        await db.exec(statements.join("\n"));
        await ensurePaymentDomainSchema(db);
        d1Initialized = true;
        return;
      } catch (execErr) {
        console.warn("db.exec batch notice, trying prepare:", execErr);
      }
    }

    for (const sql of statements) {
      try {
        const cleanSql = sql.trim().replace(/;$/, "");
        if (typeof db.prepare === "function") {
          await db.prepare(cleanSql).run();
        } else if (typeof db.exec === "function") {
          await db.exec(sql);
        }
      } catch (e) {
        console.warn("Table creation statement warning:", e);
      }
    }
    // Safe column migrations for Dynamic QRs & Fixed Product Price
    if (typeof db.prepare === "function") {
      try {
        await db.prepare("ALTER TABLE qr_codes ADD COLUMN is_dynamic INTEGER DEFAULT 0").run();
      } catch (err) {
        // Column may already exist
        void err;
      }
      try {
        await db.prepare("ALTER TABLE qr_codes ADD COLUMN item_name TEXT").run();
      } catch (err) {
        // Column may already exist
        void err;
      }
    }

    await ensurePaymentDomainSchema(db);
    d1Initialized = true;
  } catch (err) {
    console.error("D1 table initialization failed:", err);
    throw err;
  }
}

async function loadMergedTwilioConfig(env: AppEnv): Promise<SmsEnvConfig> {
  const config: SmsEnvConfig = {
    TWILIO_ACCOUNT_SID: (
      env.TWILIO_ACCOUNT_SID ||
      (typeof process !== "undefined" ? process.env?.TWILIO_ACCOUNT_SID : "") ||
      ""
    ).trim(),
    TWILIO_AUTH_TOKEN: (
      env.TWILIO_AUTH_TOKEN ||
      (typeof process !== "undefined" ? process.env?.TWILIO_AUTH_TOKEN : "") ||
      ""
    ).trim(),
    TWILIO_PHONE_NUMBER: (
      env.TWILIO_PHONE_NUMBER ||
      (typeof process !== "undefined" ? process.env?.TWILIO_PHONE_NUMBER : "") ||
      ""
    ).trim(),
    TWILIO_VERIFY_SERVICE_SID: (
      env.TWILIO_VERIFY_SERVICE_SID ||
      (typeof process !== "undefined" ? process.env?.TWILIO_VERIFY_SERVICE_SID : "") ||
      ""
    ).trim(),
  };

  if (env.DB) {
    try {
      const rows = await env.DB.prepare(
        "SELECT key, value FROM system_settings WHERE key LIKE 'TWILIO_%'",
      ).all<{ key: string; value: string }>();

      if (rows?.results) {
        for (const row of rows.results) {
          const val = (row.value || "").trim();
          if (row.key === "TWILIO_ACCOUNT_SID" && !config.TWILIO_ACCOUNT_SID) {
            config.TWILIO_ACCOUNT_SID = val;
          } else if (row.key === "TWILIO_AUTH_TOKEN" && !config.TWILIO_AUTH_TOKEN) {
            config.TWILIO_AUTH_TOKEN = val;
          } else if (row.key === "TWILIO_PHONE_NUMBER" && !config.TWILIO_PHONE_NUMBER) {
            config.TWILIO_PHONE_NUMBER = val;
          } else if (row.key === "TWILIO_VERIFY_SERVICE_SID" && !config.TWILIO_VERIFY_SERVICE_SID) {
            config.TWILIO_VERIFY_SERVICE_SID = val;
          }
        }
      }
    } catch {
      // Table may not exist yet or offline
    }
  }

  return config;
}

export async function handleApiRequest(request: Request, rawEnv?: unknown): Promise<Response> {
  const env = (rawEnv || {}) as AppEnv;
  if (env.DB) {
    await ensureD1Tables(env.DB);
    await ensureAppColumns(env.DB);
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(), status: 204 });
  }

  // Edge Dynamic Payment Sheet for customer scans
  if (
    path.startsWith("/p/") ||
    path.startsWith("/pay/") ||
    url.pathname.startsWith("/p/") ||
    url.pathname.startsWith("/pay/")
  ) {
    return handleEdgePayPage(request, env);
  }

  // A deactivated merchant loses access at once, even with a session token that has not expired yet.
  // Sign-in and support messages stay reachable so the person sees why and can ask for help.
  if (
    env.DB &&
    !path.startsWith("/auth/") &&
    !path.startsWith("/admin/") &&
    path !== "/inquiries" &&
    path !== "/health"
  ) {
    const gateSession = await getSession(request, env);
    if (
      gateSession?.role === "merchant" &&
      (await isDeactivated(env, {
        id: gateSession.sub,
        phone: gateSession.phone,
        email: gateSession.email,
      }))
    ) {
      return deactivatedResponse();
    }
  }

  try {
    if (path === "/payment-events" && request.method === "POST") {
      if (!env.DB) {
        return jsonResponse(
          { detail: "Payment analytics are unavailable without the database." },
          503,
        );
      }

      let body: { stand_id?: unknown; amount?: unknown };
      try {
        body = (await request.json()) as { stand_id?: unknown; amount?: unknown };
      } catch {
        return jsonResponse({ detail: "A valid JSON event payload is required." }, 400);
      }

      const standId = typeof body.stand_id === "string" ? body.stand_id.trim() : "";
      if (!standId) {
        return jsonResponse({ detail: "Stand identifier is required." }, 400);
      }

      if (
        body.amount !== undefined &&
        (typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) || body.amount <= 0)
      ) {
        return jsonResponse({ detail: "Amount must be a positive whole number of RWF." }, 400);
      }

      const stand = await env.DB.prepare(
        "SELECT q.id, q.owner_id, s.public_id, q.amount, q.network, q.is_dynamic, s.config_version, s.status, d.status AS destination_status " +
          "FROM qr_codes q JOIN payment_stands s ON s.id = q.id " +
          "LEFT JOIN payment_destinations d ON d.id = s.payment_destination_id " +
          "WHERE q.id = ? OR s.public_id = ? LIMIT 1",
      )
        .bind(standId, standId)
        .first<{
          id: string;
          owner_id: string | null;
          public_id: string | null;
          amount: number | null;
          network: string;
          is_dynamic: number | boolean;
          config_version: number | null;
          status: string | null;
          destination_status: string | null;
        }>();

      if (!stand) {
        return jsonResponse({ detail: "Payment stand was not found." }, 404);
      }
      if (stand.status === "revoked" || stand.destination_status === "revoked") {
        return jsonResponse({ detail: "This payment destination is no longer active." }, 410);
      }
      if (!stand.is_dynamic) {
        return jsonResponse({ detail: "Online payment is not enabled for this stand." }, 409);
      }

      const fixedAmount =
        typeof stand.amount === "number" && stand.amount > 0 ? Math.round(stand.amount) : null;
      const amount = fixedAmount ?? body.amount;
      if (fixedAmount !== null && body.amount !== undefined && body.amount !== fixedAmount) {
        return jsonResponse({ detail: "Amount does not match this fixed-price stand." }, 400);
      }
      if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
        return jsonResponse({ detail: "Enter a valid amount before starting payment." }, 400);
      }

      const eventId = crypto.randomUUID();
      const userAgent = (request.headers.get("user-agent") || "").slice(0, 512);
      await env.DB.prepare(
        "INSERT INTO payment_events (id, stand_id, merchant_id, public_id, event_type, path, amount, provider, user_agent, config_version) " +
          "VALUES (?, ?, ?, ?, 'payment_initiation', 'online', ?, ?, ?, ?)",
      )
        .bind(
          eventId,
          stand.id,
          stand.owner_id,
          stand.public_id,
          amount,
          mapNetworkToProvider(stand.network),
          userAgent,
          stand.config_version || 1,
        )
        .run();

      return jsonResponse({ success: true, id: eventId }, 201);
    }

    // ----------------------------------------------------
    // 1. AUTH: Request OTP
    // ----------------------------------------------------
    if (path === "/auth/request-otp" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { phone_number?: string };
      const rawPhone = (body.phone_number || "").trim();
      const cleanDigits = rawPhone.replace(/[^0-9+]/g, "");

      if (!cleanDigits || cleanDigits.length < 8) {
        return jsonResponse({ detail: "Valid phone number required." }, 400);
      }

      const e164Phone = formatToE164(rawPhone);

      // Cap sends per phone and per IP: stops SMS-cost abuse and keeps guess windows short.
      const reqPhoneKey = `otp-request:${e164Phone}`;
      const reqIp = clientIp(request);
      const reqIpKey = reqIp ? `otp-request-ip:${reqIp}` : "";
      const reqPhoneCount = await rateLimitHit(env, reqPhoneKey, OTP_REQUEST_WINDOW_MS);
      const reqIpCount = reqIpKey ? await rateLimitHit(env, reqIpKey, OTP_REQUEST_WINDOW_MS) : 0;
      if (reqPhoneCount > OTP_REQUEST_MAX || reqIpCount > OTP_REQUEST_IP_MAX) {
        const wait = await rateLimitPeek(
          env,
          reqPhoneCount > OTP_REQUEST_MAX ? reqPhoneKey : reqIpKey,
          OTP_REQUEST_WINDOW_MS,
        );
        return tooManyAttempts(
          wait.retryAfterSec || 60,
          "Too many verification codes requested. Please wait before trying again.",
        );
      }

      // Refuse early (before spending an SMS) if this device already belongs to another account.
      {
        const knownId = env.DB
          ? (
              await env.DB.prepare(
                "SELECT id FROM merchants WHERE phone_number = ? OR phone_number = ? LIMIT 1",
              )
                .bind(e164Phone, cleanDigits)
                .first<{ id: string }>()
            )?.id
          : (memMerchants.get(e164Phone) || memMerchants.get(cleanDigits))?.id;
        const requestIsAdmin = await isAdminIdentity(env, { phones: [e164Phone, cleanDigits] });
        const conflict = await deviceConflict(env, request, knownId || "", requestIsAdmin);
        if (conflict) return conflict;
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      if (env.DB) {
        const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
        // Store both E.164 and clean input format to ensure match
        await env.DB.prepare(
          "INSERT OR REPLACE INTO otps (phone_number, code, expires_at) VALUES (?, ?, ?)",
        )
          .bind(e164Phone, otp, expiresAt)
          .run();

        if (cleanDigits !== e164Phone) {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO otps (phone_number, code, expires_at) VALUES (?, ?, ?)",
          )
            .bind(cleanDigits, otp, expiresAt)
            .run();
        }

        // Ensure merchant record exists in D1
        await env.DB.prepare(
          "INSERT INTO merchants (id, phone_number, is_fully_registered, last_active_at) " +
            "VALUES (?, ?, 0, datetime('now')) " +
            "ON CONFLICT(phone_number) DO UPDATE SET last_active_at = datetime('now')",
        )
          .bind(crypto.randomUUID(), e164Phone)
          .run();
      } else {
        memOtps.set(e164Phone, otp);
        memOtps.set(cleanDigits, otp);
        if (!memMerchants.has(e164Phone)) {
          memMerchants.set(e164Phone, {
            id: `m-${Date.now()}`,
            phone_number: e164Phone,
            is_fully_registered: false,
            email: null,
            created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          });
        } else {
          const m = memMerchants.get(e164Phone)!;
          m.last_active_at = new Date().toISOString();
        }
      }

      // Attempt real physical SMS delivery via configured provider
      const twilioConfig = await loadMergedTwilioConfig(env);
      const smsResult = await sendRealOtpSms(e164Phone, otp, twilioConfig);

      return jsonResponse({
        success: smsResult.success,
        message: smsResult.success
          ? `Security code successfully dispatched via SMS to ${e164Phone}.`
          : `Security code generated for ${e164Phone}. ${smsResult.detail}`,
        delivery_status: smsResult.success ? "sent" : "failed",
        provider: smsResult.provider,
        messageId: smsResult.messageId,
        detail: smsResult.detail,
        error: smsResult.error,
        isTrialNotice: smsResult.isTrialNotice,
        phone_normalized: e164Phone,
        // Dev only (ALLOW_TEST_OTP=true): expose the fixed test code and the generated code.
        ...(env.ALLOW_TEST_OTP === "true"
          ? { test_code: "123456", generated_code: !smsResult.success ? otp : undefined }
          : {}),
      });
    }

    // ----------------------------------------------------
    // 2. AUTH: Verify OTP
    // ----------------------------------------------------
    if (path === "/auth/verify-otp" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        phone_number?: string;
        otp?: string;
      };
      const rawPhone = (body.phone_number || "").trim();
      const cleanDigits = rawPhone.replace(/[^0-9+]/g, "");
      const e164Phone = formatToE164(rawPhone);
      const otp = (body.otp || "").trim();

      // Guess limiting: after OTP_VERIFY_MAX_FAILURES wrong codes the phone is locked for the
      // window and the pending code is destroyed, so it cannot be brute-forced across windows.
      const verPhoneKey = `otp-verify:${e164Phone}`;
      const verIp = clientIp(request);
      const verIpKey = verIp ? `otp-verify-ip:${verIp}` : "";
      const phoneUse = await rateLimitPeek(env, verPhoneKey, OTP_VERIFY_WINDOW_MS);
      const ipUse = verIpKey
        ? await rateLimitPeek(env, verIpKey, OTP_VERIFY_WINDOW_MS)
        : { count: 0, retryAfterSec: 0 };
      if (phoneUse.count >= OTP_VERIFY_MAX_FAILURES || ipUse.count >= OTP_VERIFY_IP_MAX_FAILURES) {
        return tooManyAttempts(
          Math.max(phoneUse.retryAfterSec, ipUse.retryAfterSec) || 60,
          "Too many incorrect codes. Please wait, then request a new code.",
        );
      }
      const rejectOtp = async (): Promise<Response> => {
        const phoneFailures = await rateLimitHit(env, verPhoneKey, OTP_VERIFY_WINDOW_MS);
        if (verIpKey) await rateLimitHit(env, verIpKey, OTP_VERIFY_WINDOW_MS);
        if (phoneFailures >= OTP_VERIFY_MAX_FAILURES) {
          if (env.DB) {
            await env.DB.prepare("DELETE FROM otps WHERE phone_number = ? OR phone_number = ?")
              .bind(e164Phone, cleanDigits)
              .run();
          }
          memOtps.delete(e164Phone);
          memOtps.delete(cleanDigits);
          return tooManyAttempts(
            OTP_VERIFY_WINDOW_MS / 1000,
            "Too many incorrect codes. Please request a new code.",
          );
        }
        return jsonResponse({ detail: "Invalid verification code." }, 401);
      };

      const otpIsAdmin = await isAdminIdentity(env, { phones: [e164Phone, cleanDigits] });
      // The fixed test OTP only exists when ALLOW_TEST_OTP=true (local dev), and never for admins.
      let valid = !otpIsAdmin && env.ALLOW_TEST_OTP === "true" && otp === "123456";

      if (env.DB) {
        const row = await env.DB.prepare(
          "SELECT code, expires_at FROM otps WHERE phone_number = ? OR phone_number = ? ORDER BY expires_at DESC",
        )
          .bind(e164Phone, cleanDigits)
          .first<{ code: string; expires_at?: string | null }>();

        const otpFresh = !row?.expires_at || new Date(row.expires_at).getTime() > Date.now();
        if (row && otpFresh && otp && constantTimeEqual(row.code, otp)) {
          valid = true;
          // Single use: a verified code cannot be replayed.
          await env.DB.prepare("DELETE FROM otps WHERE phone_number = ? OR phone_number = ?")
            .bind(e164Phone, cleanDigits)
            .run();
        }

        if (!valid) {
          const twilioConfig = await loadMergedTwilioConfig(env);
          if (twilioConfig.TWILIO_VERIFY_SERVICE_SID) {
            const verifyCheck = await checkTwilioVerifyCode(e164Phone, otp, twilioConfig);
            if (verifyCheck.approved) {
              valid = true;
            }
          }
        }

        if (!valid) {
          return rejectOtp();
        }

        await rateLimitReset(env, verPhoneKey);
        const merchant = await env.DB.prepare(
          "SELECT id, phone_number, is_fully_registered FROM merchants WHERE phone_number = ? OR phone_number = ?",
        )
          .bind(e164Phone, cleanDigits)
          .first<{ id: string; phone_number: string; is_fully_registered: number }>();

        const userId = merchant?.id || crypto.randomUUID();
        const role: "admin" | "merchant" = otpIsAdmin ? "admin" : "merchant";
        if (!otpIsAdmin && (await isDeactivated(env, { id: userId, phone: e164Phone }))) {
          return deactivatedResponse();
        }
        const deviceBlock = await deviceConflict(env, request, userId, otpIsAdmin);
        if (deviceBlock) return deviceBlock;
        await linkDevice(env, request, userId, otpIsAdmin);
        const token = await issueSessionToken(env, { sub: userId, role, phone: e164Phone });
        if (!token) return adminAuthUnavailable();

        return jsonResponse({
          access_token: token,
          token_type: "bearer",
          user_id: userId,
          phone_number: e164Phone,
          role,
          is_fully_registered: Boolean(merchant?.is_fully_registered),
        });
      }

      // Memory fallback
      const memOtp = memOtps.get(e164Phone) || memOtps.get(cleanDigits);
      if (memOtp && otp && constantTimeEqual(memOtp, otp)) {
        valid = true;
        memOtps.delete(e164Phone);
        memOtps.delete(cleanDigits);
      }

      if (!valid) {
        const twilioConfig = await loadMergedTwilioConfig(env);
        if (twilioConfig.TWILIO_VERIFY_SERVICE_SID) {
          const verifyCheck = await checkTwilioVerifyCode(e164Phone, otp, twilioConfig);
          if (verifyCheck.approved) {
            valid = true;
          }
        }
      }

      if (!valid) {
        return rejectOtp();
      }

      await rateLimitReset(env, verPhoneKey);
      const merchant = memMerchants.get(e164Phone) ||
        memMerchants.get(cleanDigits) || {
          id: `m-${Date.now()}`,
          phone_number: e164Phone,
          is_fully_registered: false,
          email: null,
          created_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        };
      const memDeviceBlock = await deviceConflict(env, request, merchant.id, otpIsAdmin);
      if (memDeviceBlock) return memDeviceBlock;
      memMerchants.set(e164Phone, merchant);
      await linkDevice(env, request, merchant.id, otpIsAdmin);

      const memRole: "admin" | "merchant" = otpIsAdmin ? "admin" : "merchant";
      const memToken = await issueSessionToken(env, {
        sub: merchant.id,
        role: memRole,
        phone: merchant.phone_number,
      });
      if (!memToken) return adminAuthUnavailable();

      return jsonResponse({
        access_token: memToken,
        token_type: "bearer",
        user_id: merchant.id,
        phone_number: merchant.phone_number,
        role: memRole,
        is_fully_registered: merchant.is_fully_registered,
      });
    }

    // ----------------------------------------------------
    // 2B. AUTH: Google Sign-In / OAuth Continuation
    // ----------------------------------------------------
    if (path === "/auth/google" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        name?: string;
        sub?: string;
        phone_number?: string;
        id_token?: string;
        access_token?: string;
      };

      // The email is only trusted once Google confirms it for a token issued to this app.
      const verified = await verifyGoogleIdentity(env, {
        id_token: body.id_token,
        access_token: body.access_token,
      });
      if (!verified) {
        return jsonResponse({ detail: "Google sign-in could not be verified." }, 401);
      }
      const email = verified.email;
      if (body.email && body.email.trim().toLowerCase() !== email) {
        return jsonResponse(
          { detail: "Google account does not match the verified identity." },
          401,
        );
      }

      const businessName = (body.name || email.split("@")[0] || "Merchant").trim();
      // A client-supplied phone number is never trusted here: it could point at someone else's account.
      const fallbackPhone = `g-${email}`;
      const now = new Date().toISOString();

      const isAdmin = await isAdminIdentity(env, { email });

      if (env.DB) {
        const merchant = await env.DB.prepare(
          "SELECT id, phone_number, email, business_name FROM merchants WHERE email = ? OR phone_number = ?",
        )
          .bind(email, fallbackPhone)
          .first<{ id: string; phone_number: string; email: string; business_name: string }>();

        const merchantId = merchant?.id || verified.sub || crypto.randomUUID();
        const phoneToUse = merchant?.phone_number || fallbackPhone;
        const role = isAdmin ? "admin" : "merchant";

        if (!isAdmin && (await isDeactivated(env, { id: merchantId, phone: phoneToUse, email }))) {
          return deactivatedResponse();
        }
        // Checked before the account row is created, so a refused second account leaves nothing behind.
        const deviceBlock = await deviceConflict(env, request, merchantId, isAdmin);
        if (deviceBlock) return deviceBlock;
        await linkDevice(env, request, merchantId, isAdmin);

        await env.DB.prepare(
          "INSERT INTO merchants (id, phone_number, email, business_name, role, is_fully_registered, last_active_at) " +
            "VALUES (?, ?, ?, ?, ?, 1, ?) " +
            "ON CONFLICT(phone_number) DO UPDATE SET " +
            "email = excluded.email, business_name = COALESCE(merchants.business_name, excluded.business_name), role = excluded.role, is_fully_registered = 1, last_active_at = excluded.last_active_at",
        )
          .bind(merchantId, phoneToUse, email, businessName, role, now)
          .run();

        const token = await issueSessionToken(env, {
          sub: merchantId,
          role,
          phone: phoneToUse,
          email,
        });
        if (!token) return adminAuthUnavailable();

        return jsonResponse({
          access_token: token,
          token_type: "bearer",
          user_id: merchantId,
          email: email,
          name: businessName,
          phone_number: phoneToUse,
          business_name: merchant?.business_name || businessName,
          role: isAdmin ? "admin" : "merchant",
          is_fully_registered: true,
        });
      }

      // Memory fallback
      const merchantId = verified.sub || `g-${Date.now()}`;
      const googleMemBlock = await deviceConflict(env, request, merchantId, isAdmin);
      if (googleMemBlock) return googleMemBlock;
      await linkDevice(env, request, merchantId, isAdmin);
      const merchant = {
        id: merchantId,
        phone_number: fallbackPhone,
        email: email,
        business_name: businessName,
        role: isAdmin ? "admin" : "merchant",
        is_fully_registered: true,
        created_at: now,
        last_active_at: now,
      };
      memMerchants.set(fallbackPhone, merchant);

      const memToken = await issueSessionToken(env, {
        sub: merchantId,
        role: isAdmin ? "admin" : "merchant",
        phone: merchant.phone_number,
        email,
      });
      if (!memToken) return adminAuthUnavailable();

      return jsonResponse({
        access_token: memToken,
        token_type: "bearer",
        user_id: merchant.id,
        email: email,
        name: businessName,
        phone_number: merchant.phone_number,
        business_name: businessName,
        role: isAdmin ? "admin" : "merchant",
        is_fully_registered: true,
      });
    }

    // ----------------------------------------------------
    // 2C. AUTH: Password Login (Alternative for existing accounts)
    // ----------------------------------------------------
    if (path === "/auth/password-login" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        identifier?: string;
        password?: string;
      };

      const identifier = (body.identifier || "").trim();
      const password = (body.password || "").trim();

      if (!identifier || !password) {
        return jsonResponse({ detail: "Please provide both phone/email and password." }, 400);
      }

      const cleanPhone = formatToE164(identifier);
      const cleanEmail = identifier.toLowerCase();

      // Guess limiting: failures (wrong password, unknown account, no password set) count against
      // the identifier and the client IP, and block further attempts until the window passes.
      const pwdKey = `pwd-login:${identifier.includes("@") ? cleanEmail : cleanPhone}`;
      const pwdIp = clientIp(request);
      const pwdIpKey = pwdIp ? `pwd-login-ip:${pwdIp}` : "";
      const pwdUse = await rateLimitPeek(env, pwdKey, PASSWORD_LOGIN_WINDOW_MS);
      const pwdIpUse = pwdIpKey
        ? await rateLimitPeek(env, pwdIpKey, PASSWORD_LOGIN_WINDOW_MS)
        : { count: 0, retryAfterSec: 0 };
      if (
        pwdUse.count >= PASSWORD_LOGIN_MAX_FAILURES ||
        pwdIpUse.count >= PASSWORD_LOGIN_IP_MAX_FAILURES
      ) {
        return tooManyAttempts(
          Math.max(pwdUse.retryAfterSec, pwdIpUse.retryAfterSec) || 60,
          "Too many failed sign-in attempts. Please wait a few minutes, or sign in with OTP or Google.",
        );
      }
      const rejectPassword = async (): Promise<Response> => {
        const failures = await rateLimitHit(env, pwdKey, PASSWORD_LOGIN_WINDOW_MS);
        if (pwdIpKey) await rateLimitHit(env, pwdIpKey, PASSWORD_LOGIN_WINDOW_MS);
        if (failures >= PASSWORD_LOGIN_MAX_FAILURES) {
          return tooManyAttempts(
            PASSWORD_LOGIN_WINDOW_MS / 1000,
            "Too many failed sign-in attempts. Please wait a few minutes, or sign in with OTP or Google.",
          );
        }
        // One generic answer for unknown account / wrong password / no password set,
        // so the endpoint cannot be used to find out which phones or emails are registered.
        return jsonResponse(
          {
            detail:
              "Incorrect phone/email or password. If you have not set a password, please sign in with OTP or Google.",
          },
          401,
        );
      };

      if (env.DB) {
        await ensureAppColumns(env.DB);
        const merchant = await env.DB.prepare(
          "SELECT id, phone_number, email, business_name, password_hash FROM merchants WHERE phone_number = ? OR phone_number = ? OR email = ?",
        )
          .bind(cleanPhone, identifier, cleanEmail)
          .first<{
            id: string;
            phone_number: string;
            email: string;
            business_name: string;
            password_hash: string | null;
          }>();

        if (!merchant) {
          // Spend the same hashing time as a real check so response time does not reveal the account.
          await derivePasswordHash(password, new Uint8Array(16), PBKDF2_ITERATIONS);
          return rejectPassword();
        }

        // An account with no password set cannot use password login (previously ANY password worked).
        if (!(await verifyPassword(password, merchant.password_hash))) {
          return rejectPassword();
        }
        await rateLimitReset(env, pwdKey);
        if (await isDeactivated(env, { id: merchant.id })) {
          return deactivatedResponse();
        }

        const pwdIsAdmin = await isAdminIdentity(env, {
          email: merchant.email,
          phones: [merchant.phone_number],
        });
        const pwdDeviceBlock = await deviceConflict(env, request, merchant.id, pwdIsAdmin);
        if (pwdDeviceBlock) return pwdDeviceBlock;
        await linkDevice(env, request, merchant.id, pwdIsAdmin);

        // Password login never yields an admin session: the email on a merchant row is
        // self-declared (unverified), so admins must sign in with OTP or Google.
        const token = await issueSessionToken(env, {
          sub: merchant.id,
          role: "merchant",
          phone: merchant.phone_number,
          email: merchant.email,
        });
        if (!token) return adminAuthUnavailable();

        return jsonResponse({
          access_token: token,
          token_type: "bearer",
          user_id: merchant.id,
          phone_number: merchant.phone_number,
          email: merchant.email,
          business_name: merchant.business_name,
          role: "merchant",
          is_fully_registered: true,
        });
      }

      // Memory fallback: the in-memory store keeps no passwords, so password login cannot succeed.
      return jsonResponse(
        { detail: "Password login is unavailable without the database. Please use OTP or Google." },
        401,
      );
    }

    // ----------------------------------------------------
    // 2D. AUTH: Upgrade or Update Profile
    // ----------------------------------------------------
    if (path === "/auth/upgrade" && request.method === "POST") {
      // Only the signed-in merchant can change their own account; identity comes from the session.
      const session = await getSession(request, env);
      if (!session) {
        return jsonResponse({ detail: "Please sign in to update your account." }, 401);
      }

      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        password?: string;
        business_name?: string;
      };

      const email = (body.email || "").trim().toLowerCase();
      const password = (body.password || "").trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return jsonResponse({ detail: "Please enter a valid email address." }, 400);
      }
      if (password && password.length < 8) {
        return jsonResponse({ detail: "Password must be at least 8 characters." }, 400);
      }
      const now = new Date().toISOString();

      if (env.DB) {
        await ensureAppColumns(env.DB);
        const merchant = await env.DB.prepare(
          "SELECT id, phone_number, email FROM merchants WHERE id = ?",
        )
          .bind(session.sub)
          .first<{ id: string; phone_number: string; email: string | null }>();
        if (!merchant) {
          return jsonResponse({ detail: "Account not found." }, 404);
        }

        if (email) {
          const taken = await env.DB.prepare("SELECT id FROM merchants WHERE email = ? AND id != ?")
            .bind(email, merchant.id)
            .first();
          if (taken) {
            return jsonResponse({ detail: "That email is already used by another account." }, 409);
          }
        }

        const passwordHash = password ? await hashPassword(password) : null;
        await env.DB.prepare(
          "UPDATE merchants SET email = COALESCE(?, email), password_hash = COALESCE(?, password_hash), " +
            "is_fully_registered = 1, last_active_at = ? WHERE id = ?",
        )
          .bind(email || null, passwordHash, now, merchant.id)
          .run();

        const finalEmail = email || merchant.email || null;
        const token = await issueSessionToken(env, {
          sub: merchant.id,
          role: session.role,
          phone: merchant.phone_number,
          email: finalEmail,
        });
        if (!token) return adminAuthUnavailable();
        return jsonResponse({
          success: true,
          access_token: token,
          token_type: "bearer",
          user_id: merchant.id,
          phone_number: merchant.phone_number,
          email: finalEmail,
          is_fully_registered: true,
        });
      }

      // Memory fallback
      const memMerchant = Array.from(memMerchants.values()).find((m) => m.id === session.sub);
      if (!memMerchant) {
        return jsonResponse({ detail: "Account not found." }, 404);
      }
      if (email) memMerchant.email = email;
      memMerchant.is_fully_registered = true;
      memMerchant.last_active_at = now;

      const memToken = await issueSessionToken(env, {
        sub: memMerchant.id,
        role: session.role,
        phone: memMerchant.phone_number,
        email: memMerchant.email,
      });
      if (!memToken) return adminAuthUnavailable();
      return jsonResponse({
        success: true,
        access_token: memToken,
        token_type: "bearer",
        user_id: memMerchant.id,
        phone_number: memMerchant.phone_number,
        email: memMerchant.email,
        is_fully_registered: true,
      });
    }

    // ----------------------------------------------------
    // 2E. QR DEDUPLICATION & SINGLE GENERATION CHECK (O(1))
    // ----------------------------------------------------
    if (path === "/qr/check-exists" && request.method === "GET") {
      const existsSession = await getSession(request, env);
      const existsAdmin = await verifyAdminAuth(request, env);
      const shape = <T extends { owner_id?: string | null; phone_number?: string | null }>(
        row: T,
      ): Partial<T> =>
        existsAdmin || (existsSession && ownsRecord(existsSession, row))
          ? row
          : {
              ...row,
              owner_id: undefined,
              phone_number: undefined,
            };
      const dialCodeParam = (url.searchParams.get("dial_code") || "").trim();
      const cleanTarget = dialCodeParam.replace(/[^0-9*#]/g, "");

      if (!cleanTarget) {
        return jsonResponse({ exists: false });
      }

      if (env.DB) {
        try {
          const row = await env.DB.prepare(
            "SELECT * FROM qr_codes WHERE dial_code = ? OR REPLACE(REPLACE(dial_code, ' ', ''), '-', '') = ? LIMIT 1",
          )
            .bind(dialCodeParam, cleanTarget)
            .first<MemQrCode>();

          if (row) {
            return jsonResponse({
              exists: true,
              existing: shape(row),
              message: `Payment QR already registered for ${row.business_name} (${row.network}).`,
            });
          }
          return jsonResponse({ exists: false });
        } catch {
          // Fallback if some newer columns do not exist yet in D1 table
          try {
            const row = await env.DB.prepare(
              "SELECT id, owner_id, phone_number, business_name, network, payment_type, dial_code, created_at FROM qr_codes WHERE dial_code = ? OR REPLACE(REPLACE(dial_code, ' ', ''), '-', '') = ? LIMIT 1",
            )
              .bind(dialCodeParam, cleanTarget)
              .first<MemQrCode>();

            if (row) {
              return jsonResponse({
                exists: true,
                existing: shape(row),
                message: `Payment QR already registered for ${row.business_name} (${row.network}).`,
              });
            }
          } catch {
            // ignore
          }
          return jsonResponse({ exists: false });
        }
      }

      const match = memQrCodes.find(
        (q) =>
          q.dial_code === dialCodeParam ||
          (q.dial_code && q.dial_code.replace(/[^0-9*#]/g, "") === cleanTarget),
      );

      if (match) {
        return jsonResponse({
          exists: true,
          existing: shape(match),
          message: `Payment QR already registered for ${match.business_name} (${match.network}).`,
        });
      }
      return jsonResponse({ exists: false });
    }

    // ----------------------------------------------------
    // 2F. MERCHANT ENTITLEMENTS (Offline Gen, PDF, Pro)
    // ----------------------------------------------------
    if (
      (path === "/merchants/entitlements" || path === "/api/merchants/entitlements") &&
      request.method === "GET"
    ) {
      // Identity comes from the session; only an admin may look up another merchant.
      const session = await getSession(request, env);
      const adminReq = await verifyAdminAuth(request, env);
      const merchantIdParam = (url.searchParams.get("merchant_id") || "").trim();
      let merchantId = "unassigned";
      if (adminReq) merchantId = merchantIdParam || session?.sub || "unassigned";
      else if (session) merchantId = session.sub;

      if (!merchantId || merchantId === "unassigned") {
        return jsonResponse(
          {
            merchant_id: "",
            offline_generations: { granted: 1, consumed: 0, available: 1 },
            pdf_downloads: { granted: 1, consumed: 0, available: 1 },
            is_pro: false,
            pro_expires_at: null,
          },
          200,
        );
      }

      if (env.DB) {
        try {
          await ensurePaymentDomainSchema(env.DB);
          const phoneParam = adminReq
            ? (url.searchParams.get("phone") || url.searchParams.get("phone_number") || "").trim()
            : session?.phone || "";
          const cleanPhone =
            phoneParam || (merchantId.replace(/[^0-9+]/g, "").length >= 8 ? merchantId : "");
          const e164 = cleanPhone ? formatToE164(cleanPhone) : "";

          const rows = await env.DB.prepare(
            "SELECT * FROM merchant_entitlements WHERE merchant_id = ? OR merchant_id = ? OR merchant_id = ?",
          )
            .bind(merchantId, cleanPhone || merchantId, e164 || merchantId)
            .all<{
              id: string;
              entitlement_type?: string;
              entitlement_key?: string;
              granted_count: number;
              consumed_count: number;
              expires_at?: string | null;
              valid_until?: string | null;
            }>();

          let offlineGranted = 1;
          let offlineConsumed = 0;
          let pdfGranted = 1;
          let pdfConsumed = 0;
          let isPro = false;
          let proExpiresAt: string | null = null;

          if (rows.results && rows.results.length > 0) {
            for (const r of rows.results) {
              const typeKey = (r.entitlement_type || r.entitlement_key || "").trim();
              const expiry = r.expires_at || r.valid_until;
              if (typeKey === "offline_qr_generation" || typeKey === "offline_generation") {
                offlineGranted = Math.max(offlineGranted, r.granted_count);
                offlineConsumed = Math.max(offlineConsumed, r.consumed_count);
              } else if (typeKey === "pdf_export" || typeKey === "pdf_download") {
                pdfGranted = Math.max(pdfGranted, r.granted_count);
                pdfConsumed = Math.max(pdfConsumed, r.consumed_count);
              } else if (typeKey === "dynamic_pro_subscription" || typeKey === "pro_subscription") {
                if (expiry && new Date(expiry).getTime() > Date.now()) {
                  isPro = true;
                  proExpiresAt = expiry;
                }
              }
            }
          }

          // Count actual existing QR codes in D1 across all modes (offline + dynamic)
          const pastCountRow = await env.DB.prepare(
            "SELECT count(*) as count FROM qr_codes WHERE (owner_id = ? OR owner_id = ? OR phone_number = ? OR phone_number = ? OR phone_number = ?)",
          )
            .bind(
              merchantId,
              cleanPhone || merchantId,
              merchantId,
              cleanPhone || merchantId,
              e164 || merchantId,
            )
            .first<{ count: number }>();
          const actualCardCount = pastCountRow?.count || 0;

          // Count historical creations from audit log so deleting a card never restores the free slot
          let pastAuditCount = 0;
          try {
            await ensureAuditTable(env.DB);
            const auditRow = await env.DB.prepare(
              "SELECT count(*) as count FROM audit_events WHERE (owner_id = ? OR owner_id = ? OR owner_phone = ? OR owner_phone = ?) AND event_type = 'qr_created'",
            )
              .bind(merchantId, cleanPhone || merchantId, cleanPhone || merchantId, e164 || merchantId)
              .first<{ count: number }>();
            pastAuditCount = auditRow?.count || 0;
          } catch {
            // ignore if audit table not ready
          }

          offlineConsumed = Math.max(offlineConsumed, actualCardCount, pastAuditCount);

          return jsonResponse({
            merchant_id: merchantId,
            offline_generations: {
              granted: offlineGranted,
              consumed: offlineConsumed,
              available: Math.max(0, offlineGranted - offlineConsumed),
            },
            pdf_downloads: {
              granted: pdfGranted,
              consumed: pdfConsumed,
              available: Math.max(0, pdfGranted - pdfConsumed),
            },
            is_pro: isPro,
            pro_expires_at: proExpiresAt,
          });
        } catch (dbErr) {
          console.warn("D1 entitlements query error:", dbErr);
        }
      }

      // In-memory fallback
      const mEnts = getMemEntitlements(merchantId);
      const off = mEnts.get("offline_qr_generation") || { granted_count: 1, consumed_count: 0 };
      const pdf = mEnts.get("pdf_export") || { granted_count: 1, consumed_count: 0 };
      const pro = mEnts.get("dynamic_pro_subscription") || { granted_count: 0, consumed_count: 0 };
      const isPro = Boolean(pro.valid_until && new Date(pro.valid_until).getTime() > Date.now());

      const memExistingCount = memQrCodes.filter(
        (q) => q.owner_id === merchantId || q.phone_number === merchantId,
      ).length;
      const memAuditCount = memAudit.filter(
        (a) =>
          (a.owner_id === merchantId || a.owner_phone === merchantId) &&
          a.event_type === "qr_created",
      ).length;
      const effectiveOfflineConsumed = Math.max(off.consumed_count, memExistingCount, memAuditCount);
      off.consumed_count = effectiveOfflineConsumed;

      return jsonResponse({
        merchant_id: merchantId,
        offline_generations: {
          granted: off.granted_count,
          consumed: effectiveOfflineConsumed,
          available: Math.max(0, off.granted_count - effectiveOfflineConsumed),
        },
        pdf_downloads: {
          granted: pdf.granted_count,
          consumed: pdf.consumed_count,
          available: Math.max(0, pdf.granted_count - pdf.consumed_count),
        },
        is_pro: isPro,
        pro_expires_at: pro.valid_until || null,
      });
    }

    // ----------------------------------------------------
    // 2G. PAYMENT REQUESTS (Merchant Submission & Listing)
    // ----------------------------------------------------
    if (
      (path === "/payment-requests" || path === "/api/payment-requests") &&
      request.method === "POST"
    ) {
      const body = (await request.json().catch(() => ({}))) as {
        merchant_id?: string;
        merchant_phone?: string;
        requested_entitlement?: "offline_qr_generation" | "pdf_download" | "pro_monthly";
        amount?: number;
        reference_code?: string;
        evidence_notes?: string;
        draft?: unknown;
      };

      // The submitting merchant is the signed-in session, never a body field.
      const session = await getSession(request, env);
      if (!session) {
        return jsonResponse({ detail: "Please sign in to submit a payment request." }, 401);
      }
      const merchantId = session.sub;
      const merchantPhone = session.phone || "";
      const requestedEntitlement = body.requested_entitlement;
      const referenceCode = (body.reference_code || "").trim().toUpperCase();
      const evidenceNotes = (body.evidence_notes || "").trim().slice(0, 500);

      if (!requestedEntitlement || !referenceCode) {
        return jsonResponse(
          { detail: "Requested entitlement and reference code are required." },
          400,
        );
      }
      if (!Object.prototype.hasOwnProperty.call(ENTITLEMENT_PRICES, requestedEntitlement)) {
        return jsonResponse({ detail: "Unknown product requested." }, 400);
      }
      if (!/^[A-Z0-9][A-Z0-9_\-./ ]{3,63}$/.test(referenceCode)) {
        return jsonResponse(
          { detail: "Reference code must be 4-64 letters, digits or - _ . /" },
          400,
        );
      }
      // The price is fixed server-side; any amount in the request is ignored.
      const amount = ENTITLEMENT_PRICES[requestedEntitlement]!;
      // The QR the merchant was trying to create, kept so it can be made for them once approved.
      const draftBase =
        requestedEntitlement === "offline_qr_generation" || requestedEntitlement === "pro_monthly"
          ? sanitizeDraft(body.draft)
          : null;
      const draft = draftBase
        ? { ...draftBase, is_dynamic: requestedEntitlement === "pro_monthly" }
        : null;

      const id = `payreq_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      if (env.DB) {
        try {
          await ensurePaymentDomainSchema(env.DB);
          const pendingRow = await env.DB.prepare(
            "SELECT count(*) AS count FROM payment_requests WHERE merchant_id = ? AND status = 'pending'",
          )
            .bind(merchantId)
            .first<{ count: number }>();
          if ((pendingRow?.count ?? 0) >= MAX_PENDING_PAYMENT_REQUESTS) {
            return jsonResponse(
              {
                detail: `You already have ${MAX_PENDING_PAYMENT_REQUESTS} requests awaiting review. Please wait for them to be processed.`,
              },
              429,
            );
          }
          const existing = await env.DB.prepare(
            "SELECT id FROM payment_requests WHERE reference_code = ? OR request_reference = ? OR submitted_reference = ? LIMIT 1",
          )
            .bind(referenceCode, referenceCode, referenceCode)
            .first<{ id: string }>();

          if (existing) {
            return jsonResponse(
              {
                error: "DUPLICATE_REFERENCE",
                detail: `A payment request with reference code ${referenceCode} was already submitted.`,
              },
              409,
            );
          }

          // Insert supporting both migration-0003 and dynamic D1 columns
          try {
            await env.DB.prepare(
              "INSERT INTO payment_requests (" +
                "id, request_reference, reference_code, submitted_reference, " +
                "merchant_id, merchant_phone, product_type, requested_entitlement, " +
                "amount, currency, payment_method, proof_notes, evidence_notes, " +
                "status, created_at, updated_at" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RWF', 'rwanda_momo', ?, ?, 'pending', ?, ?)",
            )
              .bind(
                id,
                referenceCode,
                referenceCode,
                referenceCode,
                merchantId,
                merchantPhone,
                requestedEntitlement,
                requestedEntitlement,
                amount,
                evidenceNotes || null,
                evidenceNotes || null,
                now,
                now,
              )
              .run();
          } catch {
            // Fallback for minimal column schema
            await env.DB.prepare(
              "INSERT INTO payment_requests (" +
                "id, merchant_id, merchant_phone, requested_entitlement, amount, currency, reference_code, status, evidence_notes, created_at, updated_at" +
                ") VALUES (?, ?, ?, ?, ?, 'RWF', ?, 'pending', ?, ?, ?)",
            )
              .bind(
                id,
                merchantId,
                merchantPhone,
                requestedEntitlement,
                amount,
                referenceCode,
                evidenceNotes || null,
                now,
                now,
              )
              .run();
          }

          if (draft) {
            await env.DB.prepare("UPDATE payment_requests SET draft_json = ? WHERE id = ?")
              .bind(JSON.stringify(draft), id)
              .run()
              .catch((e) => console.warn("draft_json not stored:", e));
          }

          const record: MemPaymentRequest = {
            id,
            merchant_id: merchantId,
            merchant_phone: merchantPhone,
            requested_entitlement: requestedEntitlement,
            amount,
            currency: "RWF",
            reference_code: referenceCode,
            status: "pending",
            draft,
            fulfilled_qr_id: null,
            evidence_notes: evidenceNotes || null,
            created_at: now,
            updated_at: now,
          };
          memPaymentRequests.unshift(record);

          return jsonResponse({
            success: true,
            payment_request: record,
          });
        } catch (dbErr) {
          console.warn("D1 payment_requests insert error:", dbErr);
        }
      }

      // In-memory fallback
      if (
        memPaymentRequests.filter((p) => p.merchant_id === merchantId && p.status === "pending")
          .length >= MAX_PENDING_PAYMENT_REQUESTS
      ) {
        return jsonResponse(
          {
            detail: `You already have ${MAX_PENDING_PAYMENT_REQUESTS} requests awaiting review. Please wait for them to be processed.`,
          },
          429,
        );
      }
      const dup = memPaymentRequests.find(
        (p) => p.reference_code.toUpperCase() === referenceCode.toUpperCase(),
      );
      if (dup) {
        return jsonResponse(
          {
            error: "DUPLICATE_REFERENCE",
            detail: `A payment request with reference code ${referenceCode} was already submitted.`,
          },
          409,
        );
      }

      const newRecord: MemPaymentRequest = {
        id,
        merchant_id: merchantId,
        merchant_phone: merchantPhone,
        requested_entitlement: requestedEntitlement,
        amount,
        currency: "RWF",
        reference_code: referenceCode,
        status: "pending",
        draft,
        fulfilled_qr_id: null,
        evidence_notes: evidenceNotes || null,
        created_at: now,
        updated_at: now,
      };
      memPaymentRequests.unshift(newRecord);
      return jsonResponse({ success: true, payment_request: newRecord });
    }

    if (
      (path === "/payment-requests" || path === "/api/payment-requests") &&
      request.method === "GET"
    ) {
      const session = await getSession(request, env);
      const adminReq = await verifyAdminAuth(request, env);
      if (!session && !adminReq) {
        return jsonResponse({ detail: "Please sign in to view payment requests." }, 401);
      }
      const merchantId = adminReq
        ? (url.searchParams.get("merchant_id") || "").trim()
        : session!.sub;
      const now = new Date().toISOString();
      if (env.DB) {
        try {
          await ensurePaymentDomainSchema(env.DB);
          const cleanPhone =
            (!adminReq && session?.phone) ||
            (merchantId.replace(/[^0-9+]/g, "").length >= 8 ? merchantId : "");
          const e164 = cleanPhone ? formatToE164(cleanPhone) : "";

          const query = merchantId
            ? "SELECT * FROM payment_requests WHERE merchant_id = ? OR merchant_phone = ? OR merchant_phone = ? ORDER BY created_at DESC"
            : "SELECT * FROM payment_requests ORDER BY created_at DESC";
          const stmt = merchantId
            ? env.DB.prepare(query).bind(merchantId, cleanPhone || merchantId, e164 || merchantId)
            : env.DB.prepare(query);
          const rows = await stmt.all<Record<string, unknown>>();
          const mapped = (rows.results || []).map((r) => ({
            id: String(r.id || ""),
            merchant_id: String(r.merchant_id || ""),
            merchant_phone: String(r.merchant_phone || ""),
            requested_entitlement: String(
              r.requested_entitlement || r.product_type || "offline_qr_generation",
            ),
            amount: Number(r.amount || 0),
            currency: String(r.currency || "RWF"),
            reference_code: String(
              r.reference_code || r.request_reference || r.submitted_reference || "",
            ),
            status: String(r.status || "pending").toLowerCase() as
              "pending" | "approved" | "rejected",
            evidence_notes: r.evidence_notes
              ? String(r.evidence_notes)
              : r.proof_notes
                ? String(r.proof_notes)
                : null,
            admin_notes: r.admin_notes ? String(r.admin_notes) : null,
            reviewed_by: r.reviewed_by ? String(r.reviewed_by) : null,
            reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
            rejection_reason: r.admin_notes
              ? String(r.admin_notes)
              : r.rejection_reason
                ? String(r.rejection_reason)
                : null,
            draft: parseDraftJson(r.draft_json),
            fulfilled_qr_id: r.fulfilled_qr_id ? String(r.fulfilled_qr_id) : null,
            created_at: String(r.created_at || now),
            updated_at: String(r.updated_at || now),
          }));
          return jsonResponse(mapped);
        } catch (dbErr) {
          console.warn("D1 payment_requests list error:", dbErr);
        }
      }

      const digits = merchantId.replace(/[^0-9]/g, "");
      const list = merchantId
        ? memPaymentRequests.filter(
            (p) =>
              p.merchant_id === merchantId ||
              p.merchant_phone === merchantId ||
              (digits.length >= 8 && p.merchant_phone?.replace(/[^0-9]/g, "").includes(digits)),
          )
        : memPaymentRequests;
      return jsonResponse(list);
    }

    // The merchant's app creates the QR from the stored draft once a request is approved, then
    // records here which QR fulfilled it, so it is not created twice and the history can link to it.
    if (
      (path === "/payment-requests/fulfill" || path === "/api/payment-requests/fulfill") &&
      request.method === "POST"
    ) {
      const fulfilSession = await getSession(request, env);
      if (!fulfilSession) {
        return jsonResponse({ detail: "Please sign in." }, 401);
      }
      const fulfilBody = (await request.json().catch(() => ({}))) as {
        request_id?: string;
        qr_code_id?: string;
      };
      const fulfilRequestId = (fulfilBody.request_id || "").trim();
      const fulfilQrId = (fulfilBody.qr_code_id || "").trim();
      if (!fulfilRequestId || !fulfilQrId) {
        return jsonResponse({ detail: "request_id and qr_code_id are required." }, 400);
      }

      type FulfilRow = {
        id: string;
        merchant_id: string;
        status: string;
        fulfilled_qr_id?: string | null;
      };
      const reqRow: FulfilRow | null = env.DB
        ? await env.DB.prepare(
            "SELECT id, merchant_id, status, fulfilled_qr_id FROM payment_requests WHERE id = ?",
          )
            .bind(fulfilRequestId)
            .first<FulfilRow>()
        : memPaymentRequests.find((r) => r.id === fulfilRequestId) || null;
      if (!reqRow || reqRow.merchant_id !== fulfilSession.sub) {
        return jsonResponse({ detail: "Payment request not found." }, 404);
      }
      if (reqRow.status !== "approved") {
        return jsonResponse({ detail: "Only approved payment requests can be fulfilled." }, 409);
      }
      if (reqRow.fulfilled_qr_id) {
        return jsonResponse({ success: true, fulfilled_qr_id: reqRow.fulfilled_qr_id });
      }

      const fulfilQr: Partial<MemQrCode> | null = env.DB
        ? await env.DB.prepare("SELECT id, owner_id, phone_number FROM qr_codes WHERE id = ?")
            .bind(fulfilQrId)
            .first<MemQrCode>()
        : memQrCodes.find((q) => q.id === fulfilQrId) || null;
      if (!fulfilQr || !ownsRecord(fulfilSession, fulfilQr)) {
        return jsonResponse({ detail: "That QR code was not found on your account." }, 404);
      }

      if (env.DB) {
        await env.DB.prepare(
          "UPDATE payment_requests SET fulfilled_qr_id = ? WHERE id = ? AND fulfilled_qr_id IS NULL",
        )
          .bind(fulfilQrId, fulfilRequestId)
          .run();
        const stored = await env.DB.prepare(
          "SELECT fulfilled_qr_id FROM payment_requests WHERE id = ?",
        )
          .bind(fulfilRequestId)
          .first<{ fulfilled_qr_id: string | null }>();
        return jsonResponse({
          success: true,
          fulfilled_qr_id: stored?.fulfilled_qr_id || fulfilQrId,
        });
      }
      (reqRow as MemPaymentRequest).fulfilled_qr_id = reqRow.fulfilled_qr_id || fulfilQrId;
      return jsonResponse({ success: true, fulfilled_qr_id: reqRow.fulfilled_qr_id });
    }

    // ----------------------------------------------------
    // 2H. ADMIN PAYMENT APPROVALS
    // ----------------------------------------------------
    if (
      (path === "/admin/payment-requests" || path === "/api/admin/payment-requests") &&
      request.method === "GET"
    ) {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Admin authorization required." }, 403);
      }

      const statusFilter = url.searchParams.get("status");
      const now = new Date().toISOString();
      if (env.DB) {
        try {
          await ensurePaymentDomainSchema(env.DB);
          const query = statusFilter
            ? "SELECT * FROM payment_requests WHERE status = ? ORDER BY created_at DESC"
            : "SELECT * FROM payment_requests ORDER BY created_at DESC";
          const stmt = statusFilter
            ? env.DB.prepare(query).bind(statusFilter)
            : env.DB.prepare(query);
          const rows = await stmt.all<Record<string, unknown>>();
          const mapped = (rows.results || []).map((r) => ({
            id: String(r.id || ""),
            merchant_id: String(r.merchant_id || ""),
            merchant_phone: String(r.merchant_phone || ""),
            requested_entitlement: String(
              r.requested_entitlement || r.product_type || "offline_qr_generation",
            ),
            amount: Number(r.amount || 0),
            currency: String(r.currency || "RWF"),
            reference_code: String(
              r.reference_code || r.request_reference || r.submitted_reference || "",
            ),
            status: String(r.status || "pending").toLowerCase() as
              "pending" | "approved" | "rejected",
            evidence_notes: r.evidence_notes
              ? String(r.evidence_notes)
              : r.proof_notes
                ? String(r.proof_notes)
                : null,
            admin_notes: r.admin_notes ? String(r.admin_notes) : null,
            reviewed_by: r.reviewed_by ? String(r.reviewed_by) : null,
            reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
            rejection_reason: r.admin_notes
              ? String(r.admin_notes)
              : r.rejection_reason
                ? String(r.rejection_reason)
                : null,
            draft: parseDraftJson(r.draft_json),
            fulfilled_qr_id: r.fulfilled_qr_id ? String(r.fulfilled_qr_id) : null,
            created_at: String(r.created_at || now),
            updated_at: String(r.updated_at || now),
          }));
          return jsonResponse(mapped);
        } catch (dbErr) {
          console.warn("D1 admin payment_requests list error:", dbErr);
        }
      }

      const list = statusFilter
        ? memPaymentRequests.filter((p) => p.status === statusFilter)
        : memPaymentRequests;
      return jsonResponse(list);
    }

    if (
      (path === "/admin/payment-requests/review" ||
        path === "/api/admin/payment-requests/review") &&
      request.method === "POST"
    ) {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Admin authorization required." }, 403);
      }

      const body = (await request.json().catch(() => ({}))) as {
        request_id?: string;
        action?: "approve" | "reject";
        rejection_reason?: string;
      };

      const requestId = (body.request_id || "").trim();
      const action = body.action;
      const rejectionReason = (body.rejection_reason || "").trim();

      if (!requestId || (action !== "approve" && action !== "reject")) {
        return jsonResponse(
          { detail: "Valid request_id and action (approve/reject) required." },
          400,
        );
      }

      const now = new Date().toISOString();
      // Record who reviewed without ever storing the credential itself (a session token or the admin key).
      const reviewSession = await getSession(request, env);
      const reviewer = reviewSession?.email || reviewSession?.sub || "admin-key";

      if (env.DB) {
        try {
          await ensurePaymentDomainSchema(env.DB);
          const existing = await env.DB.prepare(
            "SELECT * FROM payment_requests WHERE id = ? LIMIT 1",
          )
            .bind(requestId)
            .first<MemPaymentRequest & { product_type?: string }>();

          if (!existing) {
            return jsonResponse({ detail: "Payment request not found." }, 404);
          }

          if (existing.status !== "pending") {
            return jsonResponse({ detail: `Payment request was already ${existing.status}.` }, 400);
          }

          if (action === "approve") {
            // Atomic claim: only one concurrent approval can flip pending -> approved,
            // so a request can never grant its entitlement twice.
            const claimed = await env.DB.prepare(
              "UPDATE payment_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending' RETURNING id",
            )
              .bind(reviewer, now, now, requestId)
              .first<{ id: string }>();
            if (!claimed) {
              return jsonResponse({ detail: "Payment request was already reviewed." }, 409);
            }

            // Grant entitlement
            const mid = existing.merchant_id;
            const rawReqType = existing.requested_entitlement || existing.product_type || "";
            const isProReq =
              rawReqType === "pro_monthly" ||
              rawReqType === "pro_subscription" ||
              rawReqType === "dynamic_pro_subscription";
            const isPdfReq = rawReqType === "pdf_download" || rawReqType === "pdf_export";

            if (isProReq) {
              const existingRow = await env.DB.prepare(
                "SELECT id, expires_at, valid_until FROM merchant_entitlements WHERE merchant_id = ? AND (entitlement_type = 'pro_subscription' OR entitlement_key = 'dynamic_pro_subscription') LIMIT 1",
              )
                .bind(mid)
                .first<{ id: string; expires_at?: string; valid_until?: string }>();

              const currentExp = existingRow?.expires_at || existingRow?.valid_until;
              const baseDate =
                currentExp && new Date(currentExp).getTime() > Date.now()
                  ? new Date(currentExp)
                  : new Date();
              baseDate.setDate(baseDate.getDate() + 30);
              const newExpiresAt = baseDate.toISOString();

              if (existingRow) {
                await env.DB.prepare(
                  "UPDATE merchant_entitlements SET expires_at = ?, valid_until = ?, status = 'active', updated_at = ? WHERE id = ?",
                )
                  .bind(newExpiresAt, newExpiresAt, now, existingRow.id)
                  .run();
              } else {
                const newEntId = `ent_${crypto.randomUUID()}`;
                await env.DB.prepare(
                  "INSERT INTO merchant_entitlements (id, merchant_id, entitlement_type, entitlement_key, granted_count, consumed_count, status, expires_at, valid_until, created_at, updated_at) " +
                    "VALUES (?, ?, 'pro_subscription', 'dynamic_pro_subscription', 1, 0, 'active', ?, ?, ?, ?)",
                )
                  .bind(newEntId, mid, newExpiresAt, newExpiresAt, now, now)
                  .run();
              }
            } else {
              const entType = isPdfReq ? "pdf_download" : "offline_generation";
              const entKey = isPdfReq ? "pdf_export" : "offline_qr_generation";
              const existingRow = await env.DB.prepare(
                "SELECT id, granted_count, consumed_count FROM merchant_entitlements WHERE merchant_id = ? AND (entitlement_type = ? OR entitlement_key = ?) LIMIT 1",
              )
                .bind(mid, entType, entKey)
                .first<{ id: string; granted_count?: number; consumed_count?: number }>();

              if (existingRow) {
                await env.DB.prepare(
                  "UPDATE merchant_entitlements SET granted_count = granted_count + 1, status = 'active', updated_at = ? WHERE id = ?",
                )
                  .bind(now, existingRow.id)
                  .run();
              } else {
                // 1 free + 1 just paid for. For offline QR codes, what is already used is the number
                // of cards that exist (not an assumed 1), so a first-time payer gets both.
                let alreadyUsed = 1;
                if (!isPdfReq) {
                  const cards = await env.DB.prepare(
                    "SELECT count(*) AS count FROM qr_codes WHERE (owner_id = ? OR phone_number = ?) AND (is_dynamic = 0 OR is_dynamic IS NULL)",
                  )
                    .bind(mid, existing.merchant_phone || mid)
                    .first<{ count: number }>();
                  alreadyUsed = cards?.count ?? 0;
                }
                const newEntId = `ent_${crypto.randomUUID()}`;
                await env.DB.prepare(
                  "INSERT INTO merchant_entitlements (id, merchant_id, entitlement_type, entitlement_key, granted_count, consumed_count, status, created_at, updated_at) " +
                    "VALUES (?, ?, ?, ?, 2, ?, 'active', ?, ?)",
                )
                  .bind(newEntId, mid, entType, entKey, alreadyUsed, now, now)
                  .run();
              }
            }

            // Log event
            const eventId = `ev_${crypto.randomUUID()}`;
            await env.DB.prepare(
              "INSERT INTO entitlement_events (id, merchant_id, entitlement_type, event_type, quantity, details) " +
                "VALUES (?, ?, ?, 'admin_approved_grant', 1, ?)",
            )
              .bind(
                eventId,
                mid,
                isProReq ? "pro_subscription" : isPdfReq ? "pdf_download" : "offline_generation",
                JSON.stringify({
                  payment_request_id: requestId,
                  reference_code: existing.reference_code,
                }),
              )
              .run()
              .catch(() => {});

            return jsonResponse({
              success: true,
              message: `Payment approved! Entitlement granted for merchant ${mid}.`,
            });
          } else {
            // Reject
            try {
              await env.DB.prepare(
                "UPDATE payment_requests SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
              )
                .bind(
                  rejectionReason || "Payment evidence could not be verified",
                  reviewer,
                  now,
                  now,
                  requestId,
                )
                .run();
            } catch {
              await env.DB.prepare(
                "UPDATE payment_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
              )
                .bind(reviewer, now, now, requestId)
                .run();
            }

            return jsonResponse({ success: true, message: `Payment request rejected.` });
          }
        } catch (dbErr) {
          console.warn("D1 payment request review error:", dbErr);
          return jsonResponse({ detail: "Database error during review." }, 500);
        }
      }

      // In-memory fallback
      const req = memPaymentRequests.find((p) => p.id === requestId);
      if (!req) {
        return jsonResponse({ detail: "Payment request not found." }, 404);
      }
      if (req.status !== "pending") {
        return jsonResponse({ detail: `Payment request was already ${req.status}.` }, 400);
      }

      if (action === "approve") {
        req.status = "approved";
        req.reviewed_by = reviewer;
        req.reviewed_at = now;
        req.updated_at = now;

        const mEnts = getMemEntitlements(req.merchant_id);
        if (req.requested_entitlement === "pro_monthly") {
          const pro = mEnts.get("dynamic_pro_subscription")!;
          const currentExpiry =
            pro.valid_until && new Date(pro.valid_until).getTime() > Date.now()
              ? new Date(pro.valid_until)
              : new Date();
          currentExpiry.setDate(currentExpiry.getDate() + 30);
          pro.valid_until = currentExpiry.toISOString();
          pro.granted_count += 1;
        } else {
          const entKey =
            req.requested_entitlement === "pdf_download" ? "pdf_export" : "offline_qr_generation";
          const ent = mEnts.get(entKey)!;
          ent.granted_count += 1;
        }

        return jsonResponse({ success: true, message: `Payment approved! Entitlement granted.` });
      } else {
        req.status = "rejected";
        req.rejection_reason = rejectionReason || "Evidence unverified";
        req.reviewed_by = reviewer;
        req.reviewed_at = now;
        req.updated_at = now;
        return jsonResponse({ success: true, message: `Payment request rejected.` });
      }
    }

    // ----------------------------------------------------
    // 3. QR CODES: Create, Edit & List (Dynamic & Fixed Price Support)
    // ----------------------------------------------------
    if (
      path === "/qr-codes" ||
      path === "/qr/create" ||
      path === "/qr/list" ||
      path === "/qr-codes/delete" ||
      path === "/qr/delete" ||
      path === "/qr-codes/quick-bill"
    ) {
      // Who is calling: an admin, a signed-in merchant, or nobody.
      const qrSession = await getSession(request, env);
      const qrAdmin = await verifyAdminAuth(request, env);
      const qrDenied = (row: {
        owner_id?: string | null;
        phone_number?: string | null;
      }): Response | null => {
        if (qrAdmin) return null;
        if (!qrSession) return jsonResponse({ detail: "Please sign in to manage QR codes." }, 401);
        return ownsRecord(qrSession, row)
          ? null
          : jsonResponse({ detail: "You do not have access to this QR code." }, 403);
      };

      // Quick bill update endpoint for PRO merchants
      if (path === "/qr-codes/quick-bill" && request.method === "POST") {
        if (!qrAdmin && !qrSession) {
          return jsonResponse({ detail: "Please sign in to manage QR codes." }, 401);
        }
        const quickBody = (await request.json().catch(() => ({}))) as {
          id?: string;
          amount?: number | null;
          item_name?: string | null;
        };

        if (!quickBody.id) {
          return jsonResponse({ detail: "QR code ID required." }, 400);
        }

        const newAmount =
          typeof quickBody.amount === "number" && !isNaN(quickBody.amount)
            ? quickBody.amount
            : null;
        if (quickBody.amount !== undefined && quickBody.amount !== null) {
          if (newAmount === null || !Number.isSafeInteger(newAmount) || newAmount <= 0) {
            return jsonResponse({ detail: "Amount must be a positive whole number of RWF." }, 400);
          }
        }
        const newItem = quickBody.item_name !== undefined ? quickBody.item_name : undefined;

        if (env.DB) {
          const current = await env.DB.prepare("SELECT * FROM qr_codes WHERE id = ?")
            .bind(quickBody.id)
            .first<MemQrCode>();

          if (!current) {
            return jsonResponse({ detail: "QR code not found." }, 404);
          }
          const quickDenied = qrDenied(current);
          if (quickDenied) return quickDenied;

          const finalItem = newItem !== undefined ? newItem : current.item_name;
          await env.DB.prepare("UPDATE qr_codes SET amount = ?, item_name = ? WHERE id = ?")
            .bind(newAmount, finalItem, quickBody.id)
            .run();
          const domainRecord = await syncPaymentDomainRecord(env.DB, {
            standId: current.id,
            merchantId: current.owner_id || current.phone_number,
            businessName: current.business_name,
            network: current.network,
            paymentType: current.payment_type,
            dialCode: current.dial_code,
            phoneNumber: current.phone_number,
            amount: newAmount,
            isDynamic: current.is_dynamic,
            status: current.status,
          });

          return jsonResponse({
            ...current,
            amount: newAmount,
            item_name: finalItem,
            ...domainRecord,
            message: "Live counter bill updated instantly without reprinting!",
          });
        }

        const memItem = memQrCodes.find((q) => q.id === quickBody.id);
        if (!memItem) {
          return jsonResponse({ detail: "QR code not found." }, 404);
        }
        const memQuickDenied = qrDenied(memItem);
        if (memQuickDenied) return memQuickDenied;
        memItem.amount = newAmount;
        memItem.config_version = (memItem.config_version || 1) + 1;
        memItem.payment_mode = inferPaymentMode(newAmount);
        if (newItem !== undefined) memItem.item_name = newItem;
        return jsonResponse({
          ...memItem,
          message: "Live counter bill updated instantly without reprinting!",
        });
      }

      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          owner_id?: string;
          description?: string;
          amount?: number | null;
          item_name?: string | null;
          is_dynamic?: boolean | number;
          business_name?: string;
          network?: string;
          payment_type?: string;
          dial_code?: string;
          phone_number?: string;
          update_if_exists?: boolean;
        };

        const id = crypto.randomUUID();
        const description = body.description || "QR Payment Card";
        const businessName = body.business_name || (description.split("(")[0] || "").trim();
        const network = body.network || "Mobile Money";
        const paymentType = body.payment_type || "momo_code";
        const rawDialCode = (body.dial_code || "*182#").trim();
        const dialCode = rawDialCode;
        const cleanTarget = rawDialCode.replace(/[^0-9*#]/g, "");
        const codeDigits = extractMerchantOrAccountCode(rawDialCode);
        let phone = body.phone_number || body.owner_id || "unassigned";
        let ownerId = body.owner_id || body.phone_number || phone;
        const isDynamic = body.is_dynamic ? 1 : 0;
        const itemName = body.item_name || null;
        const numAmount =
          typeof body.amount === "number" && !isNaN(body.amount) ? body.amount : null;

        // Check if requester has Admin credentials
        const isAdmin = qrAdmin;

        // A merchant can only create stands for themselves: ownership comes from the session,
        // not from owner_id / phone_number in the request body.
        if (!isAdmin) {
          if (!qrSession) {
            return jsonResponse(
              {
                error: "UNAUTHORIZED",
                detail:
                  "Authentication is required to generate payment QR codes. Please sign in or create an account.",
              },
              401,
            );
          }
          ownerId = qrSession.sub;
          phone = qrSession.phone || qrSession.sub;
        }

        // ENFORCE SINGLE GENERATION & IN-PLACE DYNAMIC UPDATES:
        if (env.DB) {
          try {
            const existing = await env.DB.prepare(
              "SELECT * FROM qr_codes WHERE dial_code = ? OR REPLACE(REPLACE(dial_code, ' ', ''), '-', '') = ? OR (network = ? AND dial_code LIKE ?) LIMIT 1",
            )
              .bind(dialCode, cleanTarget, network, `%${codeDigits}%`)
              .first<MemQrCode>();

            if (existing && !isAdmin) {
              const isOwner =
                Boolean(
                  ownerId &&
                  existing.owner_id &&
                  (existing.owner_id === ownerId || existing.owner_id === phone),
                ) ||
                Boolean(
                  phone &&
                  existing.phone_number &&
                  (existing.phone_number === phone || existing.phone_number === ownerId),
                );

              if (isOwner) {
                // If it's a Dynamic PRO Stand or update requested, update in-place without reprinting!
                const shouldUpdateInPlace = Boolean(
                  isDynamic || existing.is_dynamic || body.update_if_exists,
                );
                if (shouldUpdateInPlace) {
                  const updatedName = businessName || existing.business_name;
                  const updatedNet = network || existing.network;
                  const updatedType = paymentType || existing.payment_type;
                  const updatedDial = dialCode || existing.dial_code;
                  const updatedAmount =
                    numAmount !== null
                      ? numAmount
                      : body.amount !== undefined
                        ? numAmount
                        : existing.amount;
                  const updatedItem =
                    itemName !== null
                      ? itemName
                      : body.item_name !== undefined
                        ? itemName
                        : existing.item_name;
                  const updatedDynamic = isDynamic || (existing.is_dynamic ? 1 : 0);
                  const updatedDesc = `${updatedName} (${updatedNet} - ${updatedDial})`;

                  try {
                    await env.DB.prepare(
                      "UPDATE qr_codes SET business_name = ?, network = ?, payment_type = ?, dial_code = ?, amount = ?, item_name = ?, is_dynamic = ?, description = ? WHERE id = ?",
                    )
                      .bind(
                        updatedName,
                        updatedNet,
                        updatedType,
                        updatedDial,
                        updatedAmount,
                        updatedItem,
                        updatedDynamic,
                        updatedDesc,
                        existing.id,
                      )
                      .run();
                  } catch (updateErr) {
                    console.warn("D1 in-place update fallback notice:", updateErr);
                  }

                  const domainRecord = await syncPaymentDomainRecord(env.DB, {
                    standId: existing.id,
                    merchantId: ownerId,
                    businessName: updatedName,
                    network: updatedNet,
                    paymentType: updatedType,
                    dialCode: updatedDial,
                    phoneNumber: phone,
                    amount: updatedAmount,
                    isDynamic: updatedDynamic,
                    status: existing.status,
                  });

                  return jsonResponse({
                    id: existing.id,
                    owner_id: existing.owner_id,
                    phone_number: existing.phone_number,
                    business_name: updatedName,
                    network: updatedNet,
                    payment_type: updatedType,
                    dial_code: updatedDial,
                    description: updatedDesc,
                    amount: updatedAmount,
                    item_name: updatedItem,
                    is_dynamic: updatedDynamic,
                    ...domainRecord,
                    created_at: existing.created_at,
                    updated_in_place: true,
                    message:
                      "Existing Smart Stand updated! Your counter stand and NFC tag will show this new bill immediately without reprinting.",
                  });
                }

                return jsonResponse({
                  ...existing,
                  is_owner_reprint: true,
                  message: `Retrieved your registered payment QR card for ${existing.business_name}.`,
                });
              }

              return jsonResponse(
                {
                  error: "DUPLICATE_QR",
                  detail: `A QR card for this payment code was already generated and printed for "${existing.business_name}" (${existing.network} - ${existing.dial_code}). You can easily request a reprint or replacement card here.`,
                  duplicate: true,
                  existing_qr: existing,
                },
                409,
              );
            }
          } catch {
            // ignore check error
          }

          // Enforce Entitlements before generating a new QR:
          if (!isAdmin) {
            const e164 = phone ? formatToE164(phone) : "";

            // Dynamic Smart Stand features additionally require an active PRO subscription:
            if (isDynamic) {
              const proRow = await env.DB.prepare(
                "SELECT expires_at, valid_until FROM merchant_entitlements WHERE (merchant_id = ? OR merchant_id = ? OR merchant_id = ?) AND (entitlement_type = 'pro_subscription' OR entitlement_key = 'dynamic_pro_subscription') LIMIT 1",
              )
                .bind(ownerId, phone, e164 || phone)
                .first<{ expires_at?: string | null; valid_until?: string | null }>();
              const expiry = proRow?.expires_at || proRow?.valid_until;
              const proActive = Boolean(expiry && new Date(expiry).getTime() > Date.now());
              if (!proActive) {
                const pendingPro = await env.DB.prepare(
                  "SELECT reference_code FROM payment_requests WHERE (merchant_id = ? OR merchant_id = ? OR merchant_phone = ? OR merchant_phone = ?) AND status = 'pending' AND (requested_entitlement = 'pro_monthly' OR requested_entitlement = 'pro_subscription' OR product_type = 'pro_subscription') ORDER BY created_at DESC LIMIT 1",
                )
                  .bind(ownerId, phone, phone, e164 || phone)
                  .first<{ reference_code?: string }>();

                const detail = pendingPro?.reference_code
                  ? `Your PRO subscription payment submission (Ref: ${pendingPro.reference_code}) is currently awaiting administrator review. Once approved, you can generate dynamic smart stands immediately.`
                  : "Dynamic Smart Stand features require an active Ishyura PRO subscription.";

                return jsonResponse(
                  {
                    error: "PRO_ENTITLEMENT_REQUIRED",
                    locked: true,
                    pending_approval: Boolean(pendingPro?.reference_code),
                    pending_reference: pendingPro?.reference_code,
                    price: MONETIZATION_PRICES.pro_monthly,
                    currency: "RWF",
                    entitlement_key: "dynamic_pro_subscription",
                    detail,
                  },
                  402,
                );
              }
            }

            // Universal single-free-generation policy across ALL networks and types (MoMo, eKash, phone, static, dynamic):
            // Exactly 1 lifetime free generation. Any additional generation requires payment.
            const existingCountRow = await env.DB.prepare(
              "SELECT count(*) as count FROM qr_codes WHERE (owner_id = ? OR owner_id = ? OR phone_number = ? OR phone_number = ? OR phone_number = ?)",
            )
              .bind(ownerId, phone, phone, e164 || phone, ownerId)
              .first<{ count: number }>();
            const existingTotalCount = existingCountRow?.count || 0;

            // Also check historical creations from audit_events so deleting a card never restores the free quota
            let pastAuditCount = 0;
            try {
              await ensureAuditTable(env.DB);
              const auditRow = await env.DB.prepare(
                "SELECT count(*) as count FROM audit_events WHERE (owner_id = ? OR owner_id = ? OR owner_phone = ? OR owner_phone = ?) AND event_type = 'qr_created'",
              )
                .bind(ownerId, phone, phone, e164 || phone)
                .first<{ count: number }>();
              pastAuditCount = auditRow?.count || 0;
            } catch {
              // ignore
            }

            // Query merchant entitlements
            const entRow = await env.DB.prepare(
              "SELECT granted_count, consumed_count FROM merchant_entitlements WHERE (merchant_id = ? OR merchant_id = ? OR merchant_id = ?) AND (entitlement_type = 'offline_generation' OR entitlement_key = 'offline_qr_generation') LIMIT 1",
            )
              .bind(ownerId, phone, e164 || phone)
              .first<{ granted_count?: number; consumed_count?: number }>();

            // Free included generation is 1. Admin approved payment increases granted_count.
            const granted = Math.max(1, entRow?.granted_count ?? 1);
            // consumed_count only ever goes up, so deleting a card never gives its slot back.
            const usedSlots = Math.max(entRow?.consumed_count ?? 0, existingTotalCount, pastAuditCount);

            if (usedSlots >= granted) {
              // Check if there is a pending payment request
              const pendingReq = await env.DB.prepare(
                "SELECT reference_code FROM payment_requests WHERE (merchant_id = ? OR merchant_id = ? OR merchant_phone = ? OR merchant_phone = ?) AND status = 'pending' AND (requested_entitlement = 'offline_qr_generation' OR product_type = 'offline_qr_generation') ORDER BY created_at DESC LIMIT 1",
              )
                .bind(ownerId, phone, phone, e164 || phone)
                .first<{ reference_code?: string }>();

              const detail = pendingReq?.reference_code
                ? `Your payment submission (Ref: ${pendingReq.reference_code}) is currently awaiting administrator review. Once approved, you can generate your next QR card immediately.`
                : "Payment is non-negotiable. Only your very first QR generation is free across all payment networks and types. Additional QR generation requires payment (2,000 RWF) approved by an administrator.";

              return jsonResponse(
                {
                  error: "ENTITLEMENT_REQUIRED",
                  locked: true,
                  pending_approval: Boolean(pendingReq?.reference_code),
                  pending_reference: pendingReq?.reference_code,
                  price: MONETIZATION_PRICES.extra_offline_generation,
                  currency: "RWF",
                  entitlement_key: "offline_qr_generation",
                  detail,
                },
                402,
              );
            }
          }

          try {
            await env.DB.prepare(
              "INSERT INTO qr_codes (id, owner_id, phone_number, business_name, network, payment_type, dial_code, description, amount, is_dynamic, item_name) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
              .bind(
                id,
                ownerId,
                phone,
                businessName,
                network,
                paymentType,
                dialCode,
                description,
                numAmount,
                isDynamic,
                itemName,
              )
              .run();
          } catch (insertErr) {
            // Fallback insert if new columns not yet applied in D1
            console.warn("D1 extended insert fallback:", insertErr);
            await env.DB.prepare(
              "INSERT INTO qr_codes (id, owner_id, phone_number, business_name, network, payment_type, dial_code, description, amount) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
              .bind(
                id,
                ownerId,
                phone,
                businessName,
                network,
                paymentType,
                dialCode,
                description,
                numAmount,
              )
              .run();
          }

          const domainRecord = await syncPaymentDomainRecord(env.DB, {
            standId: id,
            merchantId: ownerId,
            businessName,
            network,
            paymentType,
            dialCode,
            phoneNumber: phone,
            amount: numAmount,
            isDynamic,
          });

          // Record consumption for all generations (offline and dynamic)
          if (!isAdmin) {
            try {
              const existingEnt = await env.DB.prepare(
                "SELECT id, consumed_count FROM merchant_entitlements WHERE (merchant_id = ? OR merchant_id = ?) AND (entitlement_type = 'offline_generation' OR entitlement_key = 'offline_qr_generation') LIMIT 1",
              )
                .bind(ownerId, phone)
                .first<{ id: string; consumed_count?: number }>();

              const cardsNow = await env.DB.prepare(
                "SELECT count(*) AS count FROM qr_codes WHERE (owner_id = ? OR phone_number = ?)",
              )
                .bind(ownerId, phone)
                .first<{ count: number }>();

              if (existingEnt) {
                await env.DB.prepare(
                  "UPDATE merchant_entitlements SET consumed_count = MAX(consumed_count + 1, ?), updated_at = datetime('now') WHERE id = ?",
                )
                  .bind(cardsNow?.count ?? 0, existingEnt.id)
                  .run();
              } else {
                const newEntId = `ent_${crypto.randomUUID()}`;
                await env.DB.prepare(
                  "INSERT INTO merchant_entitlements (id, merchant_id, entitlement_type, entitlement_key, granted_count, consumed_count, status, created_at, updated_at) VALUES (?, ?, 'offline_generation', 'offline_qr_generation', 1, ?, 'active', datetime('now'), datetime('now'))",
                )
                  .bind(newEntId, ownerId, cardsNow?.count ?? 1)
                  .run();
              }

              const eventId = `ev_${crypto.randomUUID()}`;
              await env.DB.prepare(
                "INSERT INTO entitlement_events (id, merchant_id, entitlement_type, event_type, quantity, details) VALUES (?, ?, 'offline_generation', 'consume_generation', 1, ?)",
              )
                .bind(eventId, ownerId, JSON.stringify({ stand_id: id, dial_code: dialCode, is_dynamic: isDynamic }))
                .run()
                .catch(() => {});
            } catch (entErr) {
              console.warn("D1 entitlement update error:", entErr);
            }
          }

          await recordAudit(env, {
            event: "qr_created",
            kind: isDynamic ? "nfc_stand" : "qr",
            qrId: id,
            ownerId,
            ownerPhone: phone,
            ownerEmail: qrSession?.email || null,
            ownerName: businessName,
            label: businessName,
            dialCode,
            actor: { id: qrSession?.sub || null, role: isAdmin ? "admin" : "merchant" },
          });

          return jsonResponse({
            id,
            owner_id: ownerId,
            phone_number: phone,
            business_name: businessName,
            network,
            payment_type: paymentType,
            dial_code: dialCode,
            description,
            amount: numAmount,
            is_dynamic: isDynamic,
            item_name: itemName,
            ...domainRecord,
            created_at: new Date().toISOString(),
            admin_reissued: isAdmin,
          });
        }

        const existing = memQrCodes.find(
          (q) =>
            q.dial_code === dialCode ||
            (q.dial_code && q.dial_code.replace(/[^0-9*#]/g, "") === cleanTarget) ||
            (codeDigits &&
              extractMerchantOrAccountCode(q.dial_code) === codeDigits &&
              (q.network || "").toLowerCase() === (network || "").toLowerCase()),
        );

        if (existing && !isAdmin) {
          const isOwner =
            Boolean(
              ownerId &&
              existing.owner_id &&
              (existing.owner_id === ownerId || existing.owner_id === phone),
            ) ||
            Boolean(
              phone &&
              existing.phone_number &&
              (existing.phone_number === phone || existing.phone_number === ownerId),
            );

          if (isOwner) {
            const shouldUpdateInPlace = Boolean(
              isDynamic || existing.is_dynamic || body.update_if_exists,
            );
            if (shouldUpdateInPlace) {
              if (businessName) existing.business_name = businessName;
              if (network) existing.network = network;
              if (paymentType) existing.payment_type = paymentType;
              if (dialCode) existing.dial_code = dialCode;
              if (numAmount !== null) existing.amount = numAmount;
              if (itemName !== null) existing.item_name = itemName;
              if (isDynamic) existing.is_dynamic = 1;
              existing.config_version = (existing.config_version || 1) + 1;
              existing.payment_mode = inferPaymentMode(existing.amount);
              existing.description = `${existing.business_name} (${existing.network} - ${existing.dial_code})`;

              return jsonResponse({
                ...existing,
                updated_in_place: true,
                message:
                  "Existing Smart Stand updated! Your counter stand and NFC tag will show this new bill immediately without reprinting.",
              });
            }

            return jsonResponse({
              ...existing,
              is_owner_reprint: true,
              message: `Retrieved your registered payment QR card for ${existing.business_name}.`,
            });
          }

          return jsonResponse(
            {
              error: "DUPLICATE_QR",
              detail: `A QR card for this payment code was already generated and printed for "${existing.business_name}" (${existing.network} - ${existing.dial_code}). You can easily request a reprint or replacement card here.`,
              duplicate: true,
              existing_qr: existing,
            },
            409,
          );
        }

        if (!isAdmin) {
          const mEnts = getMemEntitlements(ownerId);
          if (isDynamic) {
            const pro = mEnts.get("dynamic_pro_subscription");
            const proActive = Boolean(
              pro?.valid_until && new Date(pro.valid_until).getTime() > Date.now(),
            );
            if (!proActive) {
              return jsonResponse(
                {
                  error: "PRO_ENTITLEMENT_REQUIRED",
                  locked: true,
                  price: MONETIZATION_PRICES.pro_monthly,
                  currency: "RWF",
                  entitlement_key: "dynamic_pro_subscription",
                  detail:
                    "Dynamic Smart Stand features require an active Ishyura PRO subscription.",
                },
                402,
              );
            }
          }

          // Universal single free generation policy:
          const existingMemCount = memQrCodes.filter(
            (q) => q.owner_id === ownerId || q.phone_number === phone,
          ).length;
          const memAuditCount = memAudit.filter(
            (a) =>
              (a.owner_id === ownerId || a.owner_phone === phone) &&
              a.event_type === "qr_created",
          ).length;
          const off = mEnts.get("offline_qr_generation") || {
            granted_count: 1,
            consumed_count: 0,
          };
          const granted = Math.max(1, off.granted_count);
          const usedSlots = Math.max(off.consumed_count, existingMemCount, memAuditCount);
          if (usedSlots >= granted) {
            return jsonResponse(
              {
                error: "ENTITLEMENT_REQUIRED",
                locked: true,
                price: MONETIZATION_PRICES.extra_offline_generation,
                currency: "RWF",
                entitlement_key: "offline_qr_generation",
                detail:
                  "Payment is non-negotiable. Only your very first QR generation is free across all payment networks and types. Additional QR generation requires payment (2,000 RWF) approved by an administrator.",
              },
              402,
            );
          }
          off.consumed_count = usedSlots + 1;
          mEnts.set("offline_qr_generation", off);
        }

        await recordAudit(env, {
          event: "qr_created",
          kind: isDynamic ? "nfc_stand" : "qr",
          qrId: id,
          ownerId,
          ownerPhone: phone,
          ownerEmail: qrSession?.email || null,
          ownerName: businessName,
          label: businessName,
          dialCode,
          actor: { id: qrSession?.sub || null, role: isAdmin ? "admin" : "merchant" },
        });

        const newQr: MemQrCode = {
          id,
          owner_id: ownerId,
          phone_number: phone,
          business_name: businessName,
          network,
          payment_type: paymentType,
          dial_code: dialCode,
          description,
          amount: numAmount,
          is_dynamic: isDynamic,
          item_name: itemName,
          public_id: publicIdFromInternalId(id),
          destination_id: `dst_${id}`,
          payment_mode: inferPaymentMode(numAmount),
          config_version: 1,
          status: "active",
          created_at: new Date().toISOString(),
        };
        memQrCodes.unshift(newQr);
        return jsonResponse({
          ...newQr,
          admin_reissued: isAdmin,
        });
      }

      // PATCH: Edit destination phone number or price without reprinting!
      if (request.method === "PATCH") {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          business_name?: string;
          network?: string;
          payment_type?: string;
          dial_code?: string;
          phone_number?: string;
          amount?: number | null;
          item_name?: string | null;
          is_dynamic?: boolean | number;
        };

        if (!body.id) {
          return jsonResponse({ detail: "QR code ID required." }, 400);
        }
        if (!qrAdmin && !qrSession) {
          return jsonResponse({ detail: "Please sign in to manage QR codes." }, 401);
        }

        const rawDial = (body.dial_code || "").trim();
        const businessName = (body.business_name || "").trim();

        if (env.DB) {
          const current = await env.DB.prepare("SELECT * FROM qr_codes WHERE id = ?")
            .bind(body.id)
            .first<MemQrCode>();

          if (!current) {
            return jsonResponse({ detail: "QR Code not found." }, 404);
          }
          const patchDenied = qrDenied(current);
          if (patchDenied) return patchDenied;

          const updatedName = businessName || current.business_name;
          const updatedNet = body.network || current.network;
          const updatedType = body.payment_type || current.payment_type;
          const updatedDial = rawDial || current.dial_code;
          const updatedPhone = body.phone_number || current.phone_number;
          const updatedAmount = body.amount !== undefined ? body.amount : current.amount;
          const updatedItem = body.item_name !== undefined ? body.item_name : current.item_name;
          const updatedDynamic =
            body.is_dynamic !== undefined ? (body.is_dynamic ? 1 : 0) : current.is_dynamic;
          const updatedDesc = `${updatedName} (${updatedNet} - ${updatedDial})`;

          try {
            await env.DB.prepare(
              "UPDATE qr_codes SET business_name = ?, network = ?, payment_type = ?, dial_code = ?, phone_number = ?, amount = ?, item_name = ?, is_dynamic = ?, description = ? WHERE id = ?",
            )
              .bind(
                updatedName,
                updatedNet,
                updatedType,
                updatedDial,
                updatedPhone,
                updatedAmount,
                updatedItem,
                updatedDynamic,
                updatedDesc,
                body.id,
              )
              .run();
          } catch (updateErr) {
            console.warn("D1 extended update notice, running fallback update:", updateErr);
            await env.DB.prepare(
              "UPDATE qr_codes SET business_name = ?, network = ?, payment_type = ?, dial_code = ?, phone_number = ?, amount = ?, description = ? WHERE id = ?",
            )
              .bind(
                updatedName,
                updatedNet,
                updatedType,
                updatedDial,
                updatedPhone,
                updatedAmount,
                updatedDesc,
                body.id,
              )
              .run();
          }

          const domainRecord = await syncPaymentDomainRecord(env.DB, {
            standId: body.id,
            merchantId: current.owner_id || current.phone_number,
            businessName: updatedName,
            network: updatedNet,
            paymentType: updatedType,
            dialCode: updatedDial,
            phoneNumber: updatedPhone,
            amount: updatedAmount,
            isDynamic: updatedDynamic,
            status: current.status,
          });

          return jsonResponse({
            id: body.id,
            business_name: updatedName,
            network: updatedNet,
            payment_type: updatedType,
            dial_code: updatedDial,
            phone_number: updatedPhone,
            amount: updatedAmount,
            item_name: updatedItem,
            is_dynamic: updatedDynamic,
            ...domainRecord,
            description: updatedDesc,
            message: "QR destination updated successfully without reprinting!",
          });
        }

        const item = memQrCodes.find((q) => q.id === body.id);
        if (!item) {
          return jsonResponse({ detail: "QR code not found." }, 404);
        }
        const memPatchDenied = qrDenied(item);
        if (memPatchDenied) return memPatchDenied;
        if (businessName) item.business_name = businessName;
        if (body.network) item.network = body.network;
        if (body.payment_type) item.payment_type = body.payment_type;
        if (rawDial) item.dial_code = rawDial;
        if (body.phone_number) item.phone_number = body.phone_number;
        if (body.amount !== undefined) item.amount = body.amount;
        if (body.item_name !== undefined) item.item_name = body.item_name;
        if (body.is_dynamic !== undefined) item.is_dynamic = body.is_dynamic ? 1 : 0;
        item.config_version = (item.config_version || 1) + 1;
        item.payment_mode = inferPaymentMode(item.amount);
        item.description = `${item.business_name} (${item.network} - ${item.dial_code})`;

        return jsonResponse({
          ...item,
          message: "QR destination updated successfully without reprinting!",
        });
      }

      if (request.method === "GET") {
        // Admins may list everything (optionally filtered); merchants only ever see their own.
        if (!qrAdmin && !qrSession) {
          return jsonResponse({ detail: "Please sign in to view your QR codes." }, 401);
        }
        const ownerParam = qrAdmin ? url.searchParams.get("owner_id") : qrSession!.sub;
        const phoneParam = qrAdmin ? url.searchParams.get("phone_number") : qrSession!.phone;

        if (env.DB) {
          try {
            if (ownerParam || phoneParam) {
              const rows = await env.DB.prepare(
                "SELECT q.*, s.public_id, s.payment_destination_id AS destination_id, s.payment_mode, s.config_version, s.status, s.stand_type " +
                  "FROM qr_codes q LEFT JOIN payment_stands s ON s.id = q.id " +
                  "WHERE q.owner_id = ? OR q.phone_number = ? ORDER BY q.created_at DESC LIMIT 100",
              )
                .bind(ownerParam || phoneParam, phoneParam || ownerParam)
                .all();
              return jsonResponse(rows.results || []);
            }
            const rows = await env.DB.prepare(
              "SELECT q.*, s.public_id, s.payment_destination_id AS destination_id, s.payment_mode, s.config_version, s.status, s.stand_type " +
                "FROM qr_codes q LEFT JOIN payment_stands s ON s.id = q.id ORDER BY q.created_at DESC LIMIT 50",
            ).all();
            return jsonResponse(rows.results || []);
          } catch {
            // Fallback for older schema without is_dynamic
            const rows = await env.DB.prepare(
              "SELECT id, owner_id, phone_number, business_name, network, payment_type, dial_code, description, amount, created_at FROM qr_codes ORDER BY created_at DESC LIMIT 50",
            ).all();
            return jsonResponse(rows.results || []);
          }
        }

        if (ownerParam || phoneParam) {
          return jsonResponse(
            memQrCodes.filter(
              (q) =>
                q.owner_id === ownerParam ||
                q.owner_id === phoneParam ||
                q.phone_number === phoneParam,
            ),
          );
        }
        return jsonResponse(memQrCodes);
      }

      // Customer or Admin deleting a QR code (releases single-generation lock so one can print again!)
      if (
        request.method === "DELETE" ||
        (request.method === "POST" && (path === "/qr-codes/delete" || path === "/qr/delete"))
      ) {
        let id = url.searchParams.get("id");
        if (!id) {
          const body = (await request.json().catch(() => ({}))) as { id?: string };
          id = body.id || null;
        }
        if (!id) {
          return jsonResponse({ detail: "QR code ID required." }, 400);
        }
        if (!qrAdmin && !qrSession) {
          return jsonResponse({ detail: "Please sign in to manage QR codes." }, 401);
        }

        const deleteTarget = env.DB
          ? await env.DB.prepare(
              "SELECT owner_id, phone_number, business_name, dial_code, is_dynamic FROM qr_codes WHERE id = ?",
            )
              .bind(id)
              .first<{
                owner_id?: string | null;
                phone_number?: string | null;
                business_name?: string | null;
                dial_code?: string | null;
                is_dynamic?: number | null;
              }>()
          : memQrCodes.find((q) => q.id === id);
        if (deleteTarget) {
          const deleteDenied = qrDenied(deleteTarget);
          if (deleteDenied) return deleteDenied;
        }

        if (env.DB) {
          await env.DB.prepare("DELETE FROM qr_codes WHERE id = ?").bind(id).run();
        }
        const idx = memQrCodes.findIndex((q) => q.id === id);
        if (idx !== -1) memQrCodes.splice(idx, 1);

        if (deleteTarget) {
          await recordAudit(env, {
            event: "qr_deleted",
            kind: deleteTarget.is_dynamic ? "nfc_stand" : "qr",
            qrId: id,
            ownerId: deleteTarget.owner_id,
            ownerPhone: deleteTarget.phone_number,
            label: deleteTarget.business_name,
            dialCode: deleteTarget.dial_code,
            actor: { id: qrSession?.sub || null, role: qrAdmin ? "admin" : "merchant" },
          });
        }

        return jsonResponse({
          success: true,
          message:
            "Payment QR card deleted. Its payment code is free to register again, but deleting a card does not give back its generation slot: an additional QR needs an approved payment.",
        });
      }
    }

    // ----------------------------------------------------
    // 4. INQUIRIES: Create (Public) & List (Admin)
    // ----------------------------------------------------
    if (path === "/inquiries") {
      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          sender_name?: string;
          sender_phone?: string;
          sender_email?: string;
          subject?: string;
          message?: string;
        };

        const name = (body.sender_name || "").trim();
        const phone = (body.sender_phone || "").trim();
        const subject = (body.subject || "General Inquiry").trim();
        const message = (body.message || "").trim();

        if (!name || !phone || !message) {
          return jsonResponse(
            { detail: "Please provide your name, phone number, and message." },
            400,
          );
        }

        const id = crypto.randomUUID();
        const email = (body.sender_email || "").trim() || null;

        if (env.DB) {
          await env.DB.prepare(
            "INSERT INTO inquiries (id, sender_name, sender_phone, sender_email, subject, message, status) " +
              "VALUES (?, ?, ?, ?, ?, ?, 'new')",
          )
            .bind(id, name, phone, email, subject, message)
            .run();
        } else {
          memInquiries.unshift({
            id,
            sender_name: name,
            sender_phone: phone,
            sender_email: email,
            subject,
            message,
            status: "new",
            created_at: new Date().toISOString(),
          });
        }

        return jsonResponse({
          success: true,
          id,
          message:
            "Thank you! Your inquiry has been recorded. Our team will contact you shortly via phone/WhatsApp.",
        });
      }

      if (request.method === "GET") {
        if (!(await verifyAdminAuth(request, env))) {
          return jsonResponse({ detail: "Unauthorized admin access." }, 401);
        }

        if (env.DB) {
          const res = await env.DB.prepare(
            "SELECT * FROM inquiries ORDER BY created_at DESC",
          ).all();
          return jsonResponse(res.results || []);
        }
        return jsonResponse(memInquiries);
      }
    }

    // ----------------------------------------------------
    // 4B. DOWNLOADS: Track PDF / PNG Download Events
    // ----------------------------------------------------
    if (path === "/downloads/track" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        business_name?: string;
        network?: string;
        dial_code?: string;
        phone_number?: string;
        file_format?: string;
      };

      const id = crypto.randomUUID();
      const businessName = (body.business_name || "Payment Card").trim();
      const network = (body.network || "Mobile Money").trim();
      const dialCode = (body.dial_code || "*182#").trim();
      // Entitlements are charged to the signed-in merchant only; a body phone could burn someone else's quota.
      const dlSession = await getSession(request, env);
      const phone = (dlSession?.sub || "guest").trim();
      const fileFormat = (body.file_format || "png").trim();

      if (env.DB) {
        try {
          await env.DB.prepare(
            "INSERT INTO download_events (id, business_name, network, dial_code, phone_number, file_format) " +
              "VALUES (?, ?, ?, ?, ?, ?)",
          )
            .bind(id, businessName, network, dialCode, phone, fileFormat)
            .run();

          await recordAudit(env, {
            event: "card_exported",
            ownerId: dlSession?.sub || null,
            ownerPhone: dlSession?.phone || null,
            label: businessName,
            dialCode,
            actor: { id: dlSession?.sub || null, role: dlSession?.role || "system" },
            detail: fileFormat.toUpperCase(),
          });

          // Increment pdf_export consumed_count for this merchant if known
          if (phone && phone !== "guest") {
            const entRow = await env.DB.prepare(
              "SELECT id, consumed_count FROM merchant_entitlements WHERE merchant_id = ? AND (entitlement_type = 'pdf_export' OR entitlement_key = 'pdf_export') LIMIT 1",
            )
              .bind(phone)
              .first<{ id: string; consumed_count?: number }>();

            if (entRow?.id) {
              await env.DB.prepare(
                "UPDATE merchant_entitlements SET consumed_count = consumed_count + 1, updated_at = datetime('now') WHERE id = ?",
              )
                .bind(entRow.id)
                .run();
            } else {
              await env.DB.prepare(
                "INSERT INTO merchant_entitlements (id, merchant_id, entitlement_type, entitlement_key, granted_count, consumed_count, status, created_at, updated_at) VALUES (?, ?, 'pdf_export', 'pdf_export', 1, 1, 'active', datetime('now'), datetime('now'))",
              )
                .bind(crypto.randomUUID(), phone)
                .run();
            }
          }
        } catch (e) {
          console.warn("D1 download event track warning:", e);
        }
      } else {
        memDownloads.unshift({
          id,
          business_name: businessName,
          network,
          dial_code: dialCode,
          phone_number: phone,
          file_format: fileFormat,
          created_at: new Date().toISOString(),
        });
        if (phone && phone !== "guest") {
          const mEnts = getMemEntitlements(phone);
          const pdf = mEnts.get("pdf_export") || { granted_count: 1, consumed_count: 0 };
          pdf.consumed_count += 1;
          mEnts.set("pdf_export", pdf);
        }
      }

      return jsonResponse({ success: true, id, recorded_at: new Date().toISOString() });
    }

    // ----------------------------------------------------
    // 4C. ORDERS: Physical Stands & Stickers Checkout
    // ----------------------------------------------------
    if (path === "/orders" && request.method === "POST") {
      // An order is always for one of the merchant's own generated payment QRs, so the printer
      // knows exactly what to design (online smart stand vs offline USSD code, which network).
      const orderSession = await getSession(request, env);
      if (!orderSession) {
        return jsonResponse(
          { detail: "Please sign in and generate a payment QR before placing an order." },
          401,
        );
      }

      const body = (await request.json().catch(() => ({}))) as {
        qr_code_id?: string;
        customer_name?: string;
        customer_phone?: string;
        delivery_location?: string;
        item_type?: string;
        quantity?: number;
        notes?: string;
      };

      const qrCodeId = (body.qr_code_id || "").trim();
      const customerName = (body.customer_name || "").trim().slice(0, 100);
      const customerPhone = (body.customer_phone || "").trim().slice(0, 32);
      const deliveryLocation = (body.delivery_location || "").trim().slice(0, 300);
      const itemType = (body.item_type || "acrylic_stand").trim();
      const notes = (body.notes || "").trim().slice(0, 1000) || null;

      if (!qrCodeId) {
        return jsonResponse(
          { detail: "Choose which of your generated payment QR codes this order is for." },
          400,
        );
      }
      if (
        !/^\+?[0-9][0-9\s\-()]*$/.test(customerPhone) ||
        !/^\d{8,15}$/.test(customerPhone.replace(/\D/g, ""))
      ) {
        return jsonResponse(
          {
            detail:
              "Please enter a valid phone number we can call or WhatsApp (e.g. 0788 123 456).",
          },
          400,
        );
      }
      if (!customerName || !deliveryLocation) {
        return jsonResponse(
          { detail: "Please provide your name, phone number, and delivery location in Kigali." },
          400,
        );
      }

      // The catalog decides what an order costs; any price sent by the client is ignored.
      if (!isCatalogItem(itemType)) {
        return jsonResponse({ detail: "Unknown product." }, 400);
      }
      const quantity = body.quantity === undefined ? 1 : Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
        return jsonResponse(
          { detail: `Quantity must be a whole number from 1 to ${MAX_ORDER_QUANTITY}.` },
          400,
        );
      }
      const totalPrice = ORDER_UNIT_PRICES[itemType] * quantity;

      // The QR must exist and belong to the caller; its details are copied onto the order.
      const qr: Partial<MemQrCode> | null = env.DB
        ? await env.DB.prepare(
            "SELECT id, owner_id, phone_number, business_name, network, dial_code, is_dynamic FROM qr_codes WHERE id = ?",
          )
            .bind(qrCodeId)
            .first<MemQrCode>()
        : memQrCodes.find((q) => q.id === qrCodeId) || null;
      if (!qr) {
        return jsonResponse({ detail: "That payment QR code was not found." }, 404);
      }
      if (!ownsRecord(orderSession, qr)) {
        return jsonResponse({ detail: "You can only order for your own payment QR codes." }, 403);
      }
      const qrKind: "online" | "offline" = qr.is_dynamic ? "online" : "offline";
      const businessName = (qr.business_name || customerName).slice(0, 120);
      const network = (qr.network || "").slice(0, 40) || null;
      const dialCode = (qr.dial_code || "").slice(0, 64) || null;
      const qrLabel = `${businessName} · ${network || "Mobile Money"} · ${qrKind === "online" ? "Online (smart stand)" : "Offline (USSD)"}`;

      // Cap how many orders one merchant / phone / IP can place per hour.
      const orderIp = clientIp(request);
      const orderMerchantCount = await rateLimitHit(
        env,
        `order-merchant:${orderSession.sub}`,
        ORDER_WINDOW_MS,
      );
      const orderPhoneCount = await rateLimitHit(
        env,
        `order:${customerPhone.replace(/[^0-9+]/g, "")}`,
        ORDER_WINDOW_MS,
      );
      const orderIpCount = orderIp
        ? await rateLimitHit(env, `order-ip:${orderIp}`, ORDER_WINDOW_MS)
        : 0;
      if (
        orderMerchantCount > ORDER_MAX_PER_PHONE ||
        orderPhoneCount > ORDER_MAX_PER_PHONE ||
        orderIpCount > ORDER_MAX_PER_IP
      ) {
        return tooManyAttempts(3600, "Too many orders placed recently. Please try again later.");
      }

      const id = crypto.randomUUID();
      const newOrderNumber = () =>
        `ISH-${100000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900000)}`;
      let orderNumber = newOrderNumber();
      const now = new Date().toISOString();
      const createdOrder: MemOrder = {
        id,
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        business_name: businessName,
        delivery_location: deliveryLocation,
        item_type: itemType,
        quantity,
        total_price: totalPrice,
        notes,
        network,
        dial_code: dialCode,
        status: "pending",
        merchant_id: orderSession.sub,
        qr_code_id: qrCodeId,
        qr_kind: qrKind,
        qr_label: qrLabel,
        merchant_deleted_at: null,
        created_at: now,
        updated_at: now,
      };

      if (env.DB) {
        // A customer must never be told "order placed" when nothing was saved: retry on an
        // order-number collision, and report a failure otherwise.
        let saved = false;
        for (let attempt = 0; attempt < 3 && !saved; attempt++) {
          try {
            await env.DB.prepare(
              "INSERT INTO orders (id, order_number, customer_name, customer_phone, business_name, delivery_location, item_type, quantity, total_price, notes, network, dial_code, status, merchant_id, qr_code_id, qr_kind, qr_label) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)",
            )
              .bind(
                id,
                orderNumber,
                customerName,
                customerPhone,
                businessName,
                deliveryLocation,
                itemType,
                quantity,
                totalPrice,
                notes,
                network,
                dialCode,
                orderSession.sub,
                qrCodeId,
                qrKind,
                qrLabel,
              )
              .run();
            saved = true;
          } catch (e) {
            console.warn("D1 order insertion warning:", e);
            orderNumber = newOrderNumber();
            createdOrder.order_number = orderNumber;
          }
        }
        if (!saved) {
          return jsonResponse(
            { detail: "We could not save your order right now. Please try again." },
            503,
          );
        }
      } else {
        memOrders.unshift(createdOrder);
      }

      return jsonResponse({
        success: true,
        order_number: orderNumber,
        order: createdOrder,
        message:
          "Order placed successfully! We will contact you via WhatsApp / Phone to confirm delivery.",
      });
    }

    if (path === "/orders" && request.method === "GET") {
      // Orders contain customer names, phones and addresses: admins see all, merchants only their own.
      const ordersAdmin = await verifyAdminAuth(request, env);
      const ordersSession = ordersAdmin ? null : await getSession(request, env);
      if (!ordersAdmin && !ordersSession) {
        return jsonResponse({ detail: "Please sign in to view orders." }, 401);
      }
      const adminPhone = ordersAdmin ? url.searchParams.get("phone") : null;
      // Orders placed before orders were tied to a QR only have the phone as typed (+250…, 250…, 07…).
      const ownPhones = ordersSession
        ? Array.from(sessionIdentities(ordersSession)).filter((v) => /^\+?\d{8,}$/.test(v))
        : [];

      if (env.DB) {
        try {
          if (ordersSession) {
            const marks = ownPhones.map(() => "?").join(", ");
            const legacy = ownPhones.length
              ? ` OR (merchant_id IS NULL AND customer_phone IN (${marks}))`
              : "";
            const rows = await env.DB.prepare(
              `SELECT * FROM orders WHERE merchant_deleted_at IS NULL AND (merchant_id = ?${legacy}) ORDER BY created_at DESC LIMIT 100`,
            )
              .bind(ordersSession.sub, ...ownPhones)
              .all();
            return jsonResponse(rows.results || []);
          }
          if (adminPhone) {
            const rows = await env.DB.prepare(
              "SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 100",
            )
              .bind(adminPhone)
              .all();
            return jsonResponse(rows.results || []);
          }
          const rows = await env.DB.prepare(
            "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
          ).all();
          return jsonResponse(rows.results || []);
        } catch {
          // fall through to the in-memory list, still scoped to the caller
        }
      }

      if (ordersSession) {
        return jsonResponse(
          memOrders.filter(
            (o) =>
              !o.merchant_deleted_at &&
              (o.merchant_id === ordersSession.sub ||
                (!o.merchant_id && ownPhones.includes(o.customer_phone))),
          ),
        );
      }
      if (adminPhone) {
        return jsonResponse(memOrders.filter((o) => o.customer_phone === adminPhone));
      }
      return jsonResponse(memOrders);
    }

    // Delete an order. Merchants: not while it is being processed (wait until it is delivered);
    // a still-pending order is cancelled. Admins: only finished (delivered / cancelled) orders.
    if (
      (path === "/orders" && request.method === "DELETE") ||
      (path === "/orders/delete" && request.method === "POST")
    ) {
      const delAdmin = await verifyAdminAuth(request, env);
      const delSession = delAdmin ? null : await getSession(request, env);
      if (!delAdmin && !delSession) {
        return jsonResponse({ detail: "Please sign in to manage your orders." }, 401);
      }
      let delId = url.searchParams.get("id");
      if (!delId) {
        const delBody = (await request.json().catch(() => ({}))) as { id?: string };
        delId = delBody.id || null;
      }
      if (!delId) {
        return jsonResponse({ detail: "Order ID required." }, 400);
      }

      type OrderRow = Pick<
        MemOrder,
        "id" | "status" | "merchant_id" | "customer_phone" | "merchant_deleted_at"
      >;
      const row: OrderRow | null = env.DB
        ? await env.DB.prepare(
            "SELECT id, status, merchant_id, customer_phone, merchant_deleted_at FROM orders WHERE id = ?",
          )
            .bind(delId)
            .first<OrderRow>()
        : memOrders.find((o) => o.id === delId) || null;
      if (!row) {
        return jsonResponse({ detail: "Order not found." }, 404);
      }

      if (delSession) {
        const ownPhones = Array.from(sessionIdentities(delSession));
        const mine =
          row.merchant_id === delSession.sub ||
          (!row.merchant_id && ownPhones.includes(row.customer_phone));
        if (!mine || row.merchant_deleted_at) {
          return jsonResponse({ detail: "Order not found." }, 404);
        }
      }

      if (row.status === "processing") {
        return jsonResponse(
          {
            error: "ORDER_IN_PROGRESS",
            detail: "This order is being processed. You can delete it once it has been delivered.",
          },
          409,
        );
      }
      if (delAdmin && row.status === "pending") {
        return jsonResponse(
          {
            error: "ORDER_NOT_COMPLETE",
            detail: "Only delivered or cancelled orders can be deleted. Cancel it first.",
          },
          409,
        );
      }

      const now = new Date().toISOString();
      if (delAdmin) {
        // Finished orders only: remove the record entirely.
        if (env.DB) {
          await env.DB.prepare(
            "DELETE FROM orders WHERE id = ? AND status IN ('delivered', 'cancelled')",
          )
            .bind(delId)
            .run();
        } else {
          const idx = memOrders.findIndex((o) => o.id === delId);
          if (idx !== -1) memOrders.splice(idx, 1);
        }
        return jsonResponse({ success: true, message: "Order deleted." });
      }

      // Merchant delete: hide it from their list but keep the record for fulfilment / accounting.
      // A pending order that was never started is cancelled so the printer does not make it.
      const newStatus = row.status === "pending" ? "cancelled" : row.status;
      if (env.DB) {
        await env.DB.prepare(
          "UPDATE orders SET status = ?, merchant_deleted_at = ?, updated_at = ? WHERE id = ? AND status != 'processing'",
        )
          .bind(newStatus, now, now, delId)
          .run();
      } else {
        const ord = memOrders.find((o) => o.id === delId);
        if (ord) {
          ord.status = newStatus as MemOrder["status"];
          ord.merchant_deleted_at = now;
          ord.updated_at = now;
        }
      }
      return jsonResponse({
        success: true,
        message:
          row.status === "pending"
            ? "Order cancelled and removed."
            : "Order removed from your list.",
      });
    }

    // ----------------------------------------------------
    // 5. ADMIN: Stats & Reporting
    // ----------------------------------------------------
    if (path === "/admin/stats" && request.method === "GET") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (env.DB) {
        try {
          // Independent counts run in parallel instead of one round-trip after another.
          const [
            merchantsRow,
            qrRow,
            inquiriesRow,
            inquiriesNewRow,
            ordersRow,
            ordersPendingRow,
            downloadsRow,
            networks,
          ] = await Promise.all([
            env.DB.prepare("SELECT count(*) as count FROM merchants").first<{ count: number }>(),
            env.DB.prepare("SELECT count(*) as count FROM qr_codes").first<{ count: number }>(),
            env.DB.prepare("SELECT count(*) as count FROM inquiries").first<{ count: number }>(),
            env.DB.prepare("SELECT count(*) as count FROM inquiries WHERE status = 'new'").first<{
              count: number;
            }>(),
            env.DB.prepare("SELECT count(*) as count FROM orders").first<{ count: number }>(),
            env.DB.prepare("SELECT count(*) as count FROM orders WHERE status = 'pending'").first<{
              count: number;
            }>(),
            env.DB.prepare("SELECT count(*) as count FROM download_events").first<{
              count: number;
            }>(),
            env.DB.prepare("SELECT network, count(*) as count FROM qr_codes GROUP BY network").all<{
              network: string;
              count: number;
            }>(),
          ]);
          const merchantsCount = merchantsRow?.count || 0;
          const qrCount = qrRow?.count || 0;
          const inquiriesTotal = inquiriesRow?.count || 0;
          const inquiriesNew = inquiriesNewRow?.count || 0;
          const ordersTotal = ordersRow?.count || 0;
          const ordersPending = ordersPendingRow?.count || 0;
          const downloadsTotal = downloadsRow?.count || 0;

          const networkStats = (networks.results || []).reduce<Record<string, number>>(
            (acc, row) => {
              acc[row.network] = row.count;
              return acc;
            },
            {},
          );

          return jsonResponse({
            total_merchants: merchantsCount,
            total_qr_codes: qrCount,
            total_inquiries: inquiriesTotal,
            new_inquiries: inquiriesNew,
            total_orders: ordersTotal,
            pending_orders: ordersPending,
            total_downloads: downloadsTotal,
            network_breakdown: networkStats,
            database_type: "Cloudflare D1",
          });
        } catch (dbErr) {
          console.warn("D1 stats query failed, retrying table init:", dbErr);
          d1Initialized = false;
          await ensureD1Tables(env.DB);
          return jsonResponse({
            total_merchants: 0,
            total_qr_codes: 0,
            total_inquiries: 0,
            new_inquiries: 0,
            total_orders: 0,
            pending_orders: 0,
            total_downloads: 0,
            network_breakdown: {},
            database_type: "Cloudflare D1 (Tables created)",
          });
        }
      }

      // Memory stats
      const breakdown = memQrCodes.reduce(
        (acc, item) => {
          acc[item.network] = (acc[item.network] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return jsonResponse({
        total_merchants: memMerchants.size,
        total_qr_codes: memQrCodes.length,
        total_inquiries: memInquiries.length,
        new_inquiries: memInquiries.filter((i) => i.status === "new").length,
        total_orders: memOrders.length,
        pending_orders: memOrders.filter((o) => o.status === "pending").length,
        total_downloads: memDownloads.length,
        network_breakdown: breakdown,
        database_type: "In-Memory (Cloudflare D1 Ready)",
      });
    }

    // ----------------------------------------------------
    // 6. ADMIN: Merchants List
    // ----------------------------------------------------
    // Support tool: forget which devices a merchant account is tied to (for example after the
    // account holder gets a new phone, or two people legitimately share one).
    if (
      path === "/admin/device-links" &&
      (request.method === "DELETE" || request.method === "POST")
    ) {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }
      let targetId = url.searchParams.get("merchant_id");
      if (!targetId) {
        const b = (await request.json().catch(() => ({}))) as { merchant_id?: string };
        targetId = b.merchant_id || null;
      }
      if (!targetId) {
        return jsonResponse({ detail: "merchant_id required." }, 400);
      }
      if (env.DB) {
        await ensureDeviceTable(env.DB);
        await env.DB.prepare("DELETE FROM device_accounts WHERE merchant_id = ?")
          .bind(targetId)
          .run();
      }
      for (const set of memDeviceLinks.values()) set.delete(targetId);
      return jsonResponse({ success: true, message: "Device links cleared for this account." });
    }

    // ----------------------------------------------------
    // 6B. ADMIN: Deactivate / reactivate a merchant account
    // ----------------------------------------------------
    if (
      (path === "/admin/merchants/deactivate" || path === "/admin/merchants/reactivate") &&
      request.method === "POST"
    ) {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }
      const deactivating = path === "/admin/merchants/deactivate";
      const body = (await request.json().catch(() => ({}))) as {
        merchant_id?: string;
        reason?: string;
      };
      const merchantId = (body.merchant_id || "").trim();
      const reason = (body.reason || "").trim().slice(0, 300) || null;
      if (!merchantId) {
        return jsonResponse({ detail: "merchant_id is required." }, 400);
      }
      if (!env.DB) {
        return jsonResponse({ detail: "Account management needs the database." }, 503);
      }

      const target = await env.DB.prepare(
        "SELECT id, phone_number, email, business_name, role FROM merchants WHERE id = ?",
      )
        .bind(merchantId)
        .first<{
          id: string;
          phone_number: string;
          email: string | null;
          business_name: string | null;
          role: string | null;
        }>();
      if (!target) {
        return jsonResponse({ detail: "Account not found." }, 404);
      }
      if (
        (target.role || "merchant") === "admin" ||
        (await isAdminIdentity(env, { email: target.email, phones: [target.phone_number] }))
      ) {
        return jsonResponse(
          { detail: "Administrator accounts cannot be deactivated here. Remove the admin first." },
          400,
        );
      }

      if (deactivating) {
        await env.DB.prepare(
          "UPDATE merchants SET deactivated_at = datetime('now'), deactivated_reason = ? WHERE id = ?",
        )
          .bind(reason, merchantId)
          .run();
      } else {
        await env.DB.prepare(
          "UPDATE merchants SET deactivated_at = NULL, deactivated_reason = NULL WHERE id = ?",
        )
          .bind(merchantId)
          .run();
      }

      const adminSession = await getSession(request, env);
      await recordAudit(env, {
        event: deactivating ? "account_deactivated" : "account_reactivated",
        ownerId: target.id,
        ownerPhone: target.phone_number,
        actor: { id: adminSession?.sub || null, role: "admin" },
        detail: reason,
      });

      return jsonResponse({
        success: true,
        message: deactivating
          ? "Account deactivated. The merchant is signed out and cannot sign in until you reactivate it."
          : "Account reactivated. The merchant can sign in again.",
      });
    }

    // ----------------------------------------------------
    // 6C. ADMIN: Audit trail (who created, deleted or exported what, and who owns it)
    // ----------------------------------------------------
    if (path === "/admin/audit" && request.method === "GET") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }
      if (env.DB) {
        try {
          await ensureAuditTable(env.DB);
          const rows = await env.DB.prepare(
            "SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 300",
          ).all();
          return jsonResponse(rows.results || []);
        } catch (dbErr) {
          console.warn("D1 audit query error:", dbErr);
          return jsonResponse([]);
        }
      }
      return jsonResponse(memAudit);
    }

    if (path === "/admin/merchants" && request.method === "GET") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (env.DB) {
        try {
          const rows = await env.DB.prepare(
            "SELECT m.id, m.phone_number, m.email, m.business_name, m.role, m.is_fully_registered, m.created_at, m.last_active_at, " +
              "m.deactivated_at, m.deactivated_reason, count(q.id) as qr_count " +
              "FROM merchants m " +
              "LEFT JOIN qr_codes q ON m.phone_number = q.phone_number " +
              "GROUP BY m.id " +
              "ORDER BY m.created_at DESC",
          ).all();
          return jsonResponse(rows.results || []);
        } catch (dbErr) {
          console.warn("D1 merchants query error:", dbErr);
          d1Initialized = false;
          await ensureD1Tables(env.DB);
          return jsonResponse([]);
        }
      }

      const list = Array.from(memMerchants.values()).map((m) => {
        const qrs = memQrCodes.filter((q) => q.phone_number === m.phone_number);
        return {
          ...m,
          qr_count: qrs.length,
        };
      });
      return jsonResponse(list);
    }

    // ----------------------------------------------------
    // 7. ADMIN: QR Codes CRUD & Unlock/Delete
    // ----------------------------------------------------
    if (path === "/admin/qr-codes" || path === "/admin/qr-codes/delete") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (request.method === "GET") {
        if (env.DB) {
          try {
            const rows = await env.DB.prepare(
              "SELECT q.*, s.public_id, s.payment_destination_id AS destination_id, s.payment_mode, s.config_version, s.status, s.stand_type " +
                "FROM qr_codes q LEFT JOIN payment_stands s ON s.id = q.id ORDER BY q.created_at DESC LIMIT 300",
            ).all();
            return jsonResponse(rows.results || []);
          } catch (dbErr) {
            console.warn("D1 qr_codes query error:", dbErr);
            d1Initialized = false;
            await ensureD1Tables(env.DB);
            return jsonResponse([]);
          }
        }
        return jsonResponse(memQrCodes);
      }

      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          phone_number?: string;
          business_name?: string;
          network?: string;
          payment_type?: string;
          dial_code?: string;
          amount?: number | null;
          item_name?: string | null;
          is_dynamic?: boolean | number;
        };

        const id = crypto.randomUUID();
        const businessName = (body.business_name || "Merchant Store").trim();
        const network = body.network || "MTN MoMo";
        const paymentType = body.payment_type || "momo_code";
        const dialCode = body.dial_code || "*182*8*1*000000#";
        const phone = body.phone_number || "unassigned";
        const isDynamic = body.is_dynamic ? 1 : 0;
        const itemName = body.item_name || null;
        const numAmount =
          typeof body.amount === "number" && !isNaN(body.amount) ? body.amount : null;
        const desc = `${businessName} (${network} - ${dialCode})`;

        if (env.DB) {
          try {
            await env.DB.prepare(
              "INSERT INTO qr_codes (id, owner_id, phone_number, business_name, network, payment_type, dial_code, description, amount, is_dynamic, item_name) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
              .bind(
                id,
                phone,
                phone,
                businessName,
                network,
                paymentType,
                dialCode,
                desc,
                numAmount,
                isDynamic,
                itemName,
              )
              .run();
          } catch (e) {
            console.warn("D1 admin QR insert fallback:", e);
            await env.DB.prepare(
              "INSERT INTO qr_codes (id, owner_id, phone_number, business_name, network, payment_type, dial_code, description, amount) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
              .bind(id, phone, phone, businessName, network, paymentType, dialCode, desc, numAmount)
              .run();
          }
        }

        const domainRecord = env.DB
          ? await syncPaymentDomainRecord(env.DB, {
              standId: id,
              merchantId: phone,
              businessName,
              network,
              paymentType,
              dialCode,
              phoneNumber: phone,
              amount: numAmount,
              isDynamic,
            })
          : {
              public_id: publicIdFromInternalId(id),
              destination_id: `dst_${id}`,
              config_version: 1,
              payment_mode: inferPaymentMode(numAmount),
              status: "active",
            };

        const adminCreateSession = await getSession(request, env);
        await recordAudit(env, {
          event: "qr_created",
          kind: isDynamic ? "nfc_stand" : "qr",
          qrId: id,
          ownerId: phone,
          ownerPhone: phone,
          label: businessName,
          dialCode,
          actor: { id: adminCreateSession?.sub || null, role: "admin" },
          detail: "Created by an administrator for this merchant",
        });

        const newQr: MemQrCode = {
          id,
          owner_id: phone,
          phone_number: phone,
          business_name: businessName,
          network,
          payment_type: paymentType,
          dial_code: dialCode,
          description: desc,
          amount: numAmount,
          is_dynamic: isDynamic,
          item_name: itemName,
          ...domainRecord,
          created_at: new Date().toISOString(),
        };
        memQrCodes.unshift(newQr);

        return jsonResponse(newQr, 201);
      }

      if (request.method === "PATCH") {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          business_name?: string;
          network?: string;
          payment_type?: string;
          dial_code?: string;
          phone_number?: string;
          amount?: number | null;
          item_name?: string | null;
          is_dynamic?: boolean | number;
        };

        if (!body.id) {
          return jsonResponse({ detail: "QR code ID required." }, 400);
        }

        const rawDial = (body.dial_code || "").trim();
        const businessName = (body.business_name || "").trim();

        if (env.DB) {
          const current = await env.DB.prepare("SELECT * FROM qr_codes WHERE id = ?")
            .bind(body.id)
            .first<MemQrCode>();

          if (!current) {
            return jsonResponse({ detail: "QR code not found." }, 404);
          }

          const updatedName = businessName || current.business_name;
          const updatedNet = body.network || current.network;
          const updatedType = body.payment_type || current.payment_type;
          const updatedDial = rawDial || current.dial_code;
          const updatedPhone = body.phone_number || current.phone_number;
          const updatedAmount = body.amount !== undefined ? body.amount : current.amount;
          const updatedItem = body.item_name !== undefined ? body.item_name : current.item_name;
          const updatedDynamic =
            body.is_dynamic !== undefined ? (body.is_dynamic ? 1 : 0) : current.is_dynamic;
          const updatedDesc = `${updatedName} (${updatedNet} - ${updatedDial})`;

          try {
            await env.DB.prepare(
              "UPDATE qr_codes SET business_name = ?, network = ?, payment_type = ?, dial_code = ?, phone_number = ?, amount = ?, item_name = ?, is_dynamic = ?, description = ? WHERE id = ?",
            )
              .bind(
                updatedName,
                updatedNet,
                updatedType,
                updatedDial,
                updatedPhone,
                updatedAmount,
                updatedItem,
                updatedDynamic,
                updatedDesc,
                body.id,
              )
              .run();
          } catch (updateErr) {
            console.warn("D1 extended update notice, running fallback update:", updateErr);
            await env.DB.prepare(
              "UPDATE qr_codes SET business_name = ?, network = ?, payment_type = ?, dial_code = ?, phone_number = ?, amount = ?, description = ? WHERE id = ?",
            )
              .bind(
                updatedName,
                updatedNet,
                updatedType,
                updatedDial,
                updatedPhone,
                updatedAmount,
                updatedDesc,
                body.id,
              )
              .run();
          }

          const domainRecord = await syncPaymentDomainRecord(env.DB, {
            standId: body.id,
            merchantId: current.owner_id || current.phone_number,
            businessName: updatedName,
            network: updatedNet,
            paymentType: updatedType,
            dialCode: updatedDial,
            phoneNumber: updatedPhone,
            amount: updatedAmount,
            isDynamic: updatedDynamic,
            status: current.status,
          });

          return jsonResponse({
            id: body.id,
            business_name: updatedName,
            network: updatedNet,
            payment_type: updatedType,
            dial_code: updatedDial,
            phone_number: updatedPhone,
            amount: updatedAmount,
            item_name: updatedItem,
            is_dynamic: updatedDynamic,
            ...domainRecord,
            description: updatedDesc,
            message: "QR code successfully updated by Admin.",
          });
        }

        const item = memQrCodes.find((q) => q.id === body.id);
        if (!item) {
          return jsonResponse({ detail: "QR code not found." }, 404);
        }
        if (businessName) item.business_name = businessName;
        if (body.network) item.network = body.network;
        if (body.payment_type) item.payment_type = body.payment_type;
        if (rawDial) item.dial_code = rawDial;
        if (body.phone_number) item.phone_number = body.phone_number;
        if (body.amount !== undefined) item.amount = body.amount;
        if (body.item_name !== undefined) item.item_name = body.item_name;
        if (body.is_dynamic !== undefined) item.is_dynamic = body.is_dynamic ? 1 : 0;
        item.config_version = (item.config_version || 1) + 1;
        item.payment_mode = inferPaymentMode(item.amount);
        item.description = `${item.business_name} (${item.network} - ${item.dial_code})`;

        return jsonResponse({
          ...item,
          message: "QR code successfully updated by Admin.",
        });
      }

      if (
        request.method === "DELETE" ||
        (request.method === "POST" && path === "/admin/qr-codes/delete")
      ) {
        let id = url.searchParams.get("id");
        if (!id) {
          const body = (await request.json().catch(() => ({}))) as { id?: string };
          id = body.id || null;
        }
        if (!id) {
          return jsonResponse({ detail: "QR code ID required." }, 400);
        }
        // An admin delete / unlock is a deliberate decision, so it hands the owner's offline slot back.
        const gone: Partial<MemQrCode> | null = env.DB
          ? await env.DB.prepare(
              "SELECT owner_id, phone_number, business_name, dial_code, is_dynamic FROM qr_codes WHERE id = ?",
            )
              .bind(id)
              .first<MemQrCode>()
          : memQrCodes.find((q) => q.id === id) || null;
        if (env.DB) {
          await env.DB.prepare("DELETE FROM qr_codes WHERE id = ?").bind(id).run();
        }
        const idx = memQrCodes.findIndex((q) => q.id === id);
        if (idx !== -1) memQrCodes.splice(idx, 1);

        if (gone) {
          const adminDeleteSession = await getSession(request, env);
          await recordAudit(env, {
            event: "qr_deleted",
            kind: gone.is_dynamic ? "nfc_stand" : "qr",
            qrId: id,
            ownerId: gone.owner_id,
            ownerPhone: gone.phone_number,
            label: gone.business_name,
            dialCode: gone.dial_code,
            actor: { id: adminDeleteSession?.sub || null, role: "admin" },
          });
        }

        // Payment is non negotiable: 1 lifetime free offline generation per merchant across all networks.
        // Deleting a previous card never restores or refunds the generation slot.
        return jsonResponse({
          success: true,
          slot_returned: false,
          message: "QR code deleted. Offline generation quota is unchanged (deleting does not restore free generation).",
        });
      }
    }

    // ----------------------------------------------------
    // 7B. ADMINS MANAGEMENT (Database-Backed RBAC)
    // ----------------------------------------------------
    if (path === "/admin/admins") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (request.method === "GET") {
        if (env.DB) {
          try {
            const rows = await env.DB.prepare(
              "SELECT id, email, name, phone_number, role, created_at FROM system_admins ORDER BY created_at ASC",
            ).all();
            return jsonResponse(rows.results || []);
          } catch {
            return jsonResponse(Array.from(memAdmins.values()));
          }
        }
        return jsonResponse(Array.from(memAdmins.values()));
      }

      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          name?: string;
          phone_number?: string;
        };
        const email = (body.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          return jsonResponse({ detail: "Valid administrator email required." }, 400);
        }

        const id = `admin-${crypto.randomUUID().slice(0, 8)}`;
        const name = (body.name || email.split("@")[0] || "").trim();
        const now = new Date().toISOString();

        if (env.DB) {
          await env.DB.prepare(
            "INSERT INTO system_admins (id, email, name, phone_number, role, created_at) " +
              "VALUES (?, ?, ?, ?, 'admin', ?) " +
              "ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = 'admin'",
          )
            .bind(id, email, name, body.phone_number || null, now)
            .run();
        }

        const newAdmin: MemAdmin = {
          id,
          email,
          name,
          phone_number: body.phone_number || null,
          role: "admin",
          created_at: now,
        };
        memAdmins.set(email, newAdmin);

        return jsonResponse({
          success: true,
          message: `Administrator ${email} successfully added.`,
          admin: newAdmin,
        });
      }

      if (request.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) {
          return jsonResponse({ detail: "Admin ID required." }, 400);
        }
        if (id === "admin-owner") {
          return jsonResponse({ detail: "Superadmin cannot be deleted." }, 400);
        }

        if (env.DB) {
          await env.DB.prepare("DELETE FROM system_admins WHERE id = ? AND id != 'admin-owner'")
            .bind(id)
            .run();
        }
        for (const [em, a] of memAdmins.entries()) {
          if (a.id === id && em !== "jeanniyonkuru29@gmail.com") {
            memAdmins.delete(em);
          }
        }
        return jsonResponse({ success: true, message: "Administrator removed." });
      }
    }

    if (path === "/admin/check-auth" && request.method === "GET") {
      const isAuth = await verifyAdminAuth(request, env);
      if (!isAuth) {
        return jsonResponse({ authenticated: false, detail: "Unauthorized admin access." }, 401);
      }
      return jsonResponse({ authenticated: true, role: "admin" });
    }

    // ----------------------------------------------------
    // 8. ADMIN: Inquiries List & Status Update
    // ----------------------------------------------------
    if (path === "/admin/inquiries") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (request.method === "GET") {
        if (env.DB) {
          try {
            const rows = await env.DB.prepare(
              "SELECT * FROM inquiries ORDER BY created_at DESC",
            ).all();
            return jsonResponse(rows.results || []);
          } catch (dbErr) {
            console.warn("D1 inquiries query error:", dbErr);
            d1Initialized = false;
            await ensureD1Tables(env.DB);
            return jsonResponse([]);
          }
        }
        return jsonResponse(memInquiries);
      }

      if (request.method === "PATCH") {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          status?: "new" | "resolved";
        };
        if (!body.id || !body.status) {
          return jsonResponse({ detail: "Inquiry ID and status required." }, 400);
        }

        if (env.DB) {
          await env.DB.prepare("UPDATE inquiries SET status = ? WHERE id = ?")
            .bind(body.status, body.id)
            .run();
        } else {
          const inq = memInquiries.find((i) => i.id === body.id);
          if (inq) inq.status = body.status;
        }

        return jsonResponse({ success: true, id: body.id, status: body.status });
      }
    }

    // ----------------------------------------------------
    // 8B. ADMIN: Orders List & Status Update
    // ----------------------------------------------------
    if (path === "/admin/orders") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (request.method === "GET") {
        if (env.DB) {
          try {
            const rows = await env.DB.prepare(
              "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
            ).all();
            return jsonResponse(rows.results || []);
          } catch (dbErr) {
            console.warn("D1 orders query error:", dbErr);
            d1Initialized = false;
            await ensureD1Tables(env.DB);
            return jsonResponse([]);
          }
        }
        return jsonResponse(memOrders);
      }

      if (request.method === "PATCH") {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          status?: "pending" | "processing" | "delivered" | "cancelled";
        };
        if (!body.id || !body.status) {
          return jsonResponse({ detail: "Order ID and status required." }, 400);
        }
        if (!["pending", "processing", "delivered", "cancelled"].includes(body.status)) {
          return jsonResponse({ detail: "Invalid order status." }, 400);
        }

        const now = new Date().toISOString();
        if (env.DB) {
          await env.DB.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
            .bind(body.status, now, body.id)
            .run();
        } else {
          const ord = memOrders.find((o) => o.id === body.id);
          if (ord) {
            ord.status = body.status;
            ord.updated_at = now;
          }
        }

        return jsonResponse({ success: true, id: body.id, status: body.status });
      }
    }

    // ----------------------------------------------------
    // 8C. ADMIN: Download Events List
    // ----------------------------------------------------
    if (path === "/admin/downloads" && request.method === "GET") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (env.DB) {
        try {
          const rows = await env.DB.prepare(
            "SELECT * FROM download_events ORDER BY created_at DESC LIMIT 100",
          ).all();
          return jsonResponse(rows.results || []);
        } catch (dbErr) {
          console.warn("D1 downloads query error:", dbErr);
          d1Initialized = false;
          await ensureD1Tables(env.DB);
          return jsonResponse([]);
        }
      }
      return jsonResponse(memDownloads);
    }

    // ----------------------------------------------------
    // 9. ADMIN: CSV Export
    // ----------------------------------------------------
    if (path === "/admin/export" && request.method === "GET") {
      if (!(await verifyAdminAuth(request, env, { allowQueryToken: true }))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      const type = url.searchParams.get("type") || "merchants";

      if (type === "merchants") {
        const merchants = Array.from(memMerchants.values());
        const csvLines = [
          "ID,Phone Number,Full Registered,Email,Created At,Last Active At",
          ...merchants.map(
            (m) =>
              `"${m.id}","${m.phone_number}","${m.is_fully_registered}","${m.email || ""}","${m.created_at}","${m.last_active_at}"`,
          ),
        ];
        return new Response(csvLines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="merchants_report.csv"',
            ...corsHeaders(),
          },
        });
      }

      if (type === "qrs") {
        const csvLines = [
          "ID,Business Name,Network,Payment Type,Dial Code,Created At",
          ...memQrCodes.map(
            (q) =>
              `"${q.id}","${q.business_name}","${q.network}","${q.payment_type}","${q.dial_code}","${q.created_at}"`,
          ),
        ];
        return new Response(csvLines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="qr_codes_report.csv"',
            ...corsHeaders(),
          },
        });
      }

      if (type === "inquiries") {
        const csvLines = [
          "ID,Name,Phone,Email,Subject,Status,Created At,Message",
          ...memInquiries.map(
            (i) =>
              `"${i.id}","${i.sender_name}","${i.sender_phone}","${i.sender_email || ""}","${i.subject}","${i.status}","${i.created_at}","${i.message.replace(/"/g, '""')}"`,
          ),
        ];
        return new Response(csvLines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="inquiries_report.csv"',
            ...corsHeaders(),
          },
        });
      }

      if (type === "orders") {
        const ordersList = memOrders;
        const csvLines = [
          "ID,Order Number,Customer Name,Phone,Business Name,Location,Item,Qty,Total RWF,Status,Created At",
          ...ordersList.map(
            (o) =>
              `"${o.id}","${o.order_number}","${o.customer_name}","${o.customer_phone}","${o.business_name}","${o.delivery_location}","${o.item_type}","${o.quantity}","${o.total_price}","${o.status}","${o.created_at}"`,
          ),
        ];
        return new Response(csvLines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="orders_report.csv"',
            ...corsHeaders(),
          },
        });
      }

      if (type === "downloads") {
        const dlList = memDownloads;
        const csvLines = [
          "ID,Business Name,Network,Dial Code,Phone,Format,Downloaded At",
          ...dlList.map(
            (d) =>
              `"${d.id}","${d.business_name}","${d.network}","${d.dial_code}","${d.phone_number || ""}","${d.file_format}","${d.created_at}"`,
          ),
        ];
        return new Response(csvLines.join("\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="downloads_log.csv"',
            ...corsHeaders(),
          },
        });
      }
    }

    // ----------------------------------------------------
    // 8D. ADMIN: System Settings & Twilio Dynamic Config
    // ----------------------------------------------------
    if (path === "/admin/settings") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (request.method === "GET") {
        const twilio = await loadMergedTwilioConfig(env);
        return jsonResponse({
          twilio: {
            hasAccountSid: Boolean(twilio.TWILIO_ACCOUNT_SID),
            accountSidMasked: twilio.TWILIO_ACCOUNT_SID
              ? `${twilio.TWILIO_ACCOUNT_SID.slice(0, 6)}...${twilio.TWILIO_ACCOUNT_SID.slice(-4)}`
              : "",
            hasAuthToken: Boolean(twilio.TWILIO_AUTH_TOKEN),
            phoneNumber: twilio.TWILIO_PHONE_NUMBER || "",
            verifyServiceSid: twilio.TWILIO_VERIFY_SERVICE_SID || "",
          },
        });
      }

      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          twilio_account_sid?: string;
          twilio_auth_token?: string;
          twilio_phone_number?: string;
          twilio_verify_service_sid?: string;
        };

        const db = env.DB;
        if (db) {
          const now = new Date().toISOString();
          const upsertSetting = async (key: string, val?: string) => {
            if (val !== undefined && val.trim() !== "") {
              await db
                .prepare(
                  "INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                )
                .bind(key, val.trim(), now)
                .run();
            }
          };

          await upsertSetting("TWILIO_ACCOUNT_SID", body.twilio_account_sid);
          await upsertSetting("TWILIO_AUTH_TOKEN", body.twilio_auth_token);
          await upsertSetting("TWILIO_PHONE_NUMBER", body.twilio_phone_number);
          await upsertSetting("TWILIO_VERIFY_SERVICE_SID", body.twilio_verify_service_sid);
        }

        return jsonResponse({ success: true, message: "Settings saved successfully." });
      }
    }

    // ----------------------------------------------------
    // 8E. ADMIN: Test SMS Dispatch
    // ----------------------------------------------------
    if (path === "/admin/test-sms" && request.method === "POST") {
      if (!(await verifyAdminAuth(request, env))) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      const body = (await request.json().catch(() => ({}))) as {
        phone_number?: string;
      };

      if (!body.phone_number) {
        return jsonResponse({ detail: "Phone number required." }, 400);
      }

      const twilioConfig = await loadMergedTwilioConfig(env);
      const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const res = await sendRealOtpSms(body.phone_number, testOtp, twilioConfig);

      return jsonResponse({
        success: res.success,
        provider: res.provider,
        messageId: res.messageId,
        detail: res.detail,
        error: res.error,
        isTrialNotice: res.isTrialNotice,
        rawResponse: res.rawResponse,
        test_code: testOtp,
      });
    }

    return jsonResponse({ detail: `Route not found: ${request.method} ${path}` }, 404);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return jsonResponse({ detail: message }, 500);
  }
}
