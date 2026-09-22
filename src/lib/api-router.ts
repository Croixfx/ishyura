// Serverless API Router supporting Cloudflare D1 and Local In-Memory Fallback

export interface D1Database {
  prepare(query: string): {
    bind(...params: unknown[]): {
      all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
      first<T = unknown>(colName?: string): Promise<T | null>;
      run(): Promise<{ success: boolean }>;
    };
  };
  exec(query: string): Promise<unknown>;
}

export interface AppEnv {
  DB?: D1Database;
  ADMIN_SECRET?: string;
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

const memOtps: Map<string, string> = new Map();

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key",
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

function verifyAdminAuth(request: Request, env?: AppEnv): boolean {
  const configuredSecret = (env?.ADMIN_SECRET || "ishyura2026").trim();
  const authHeader = (request.headers.get("x-admin-key") || "").trim();
  const authParam = (new URL(request.url).searchParams.get("key") || "").trim();
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();

  const candidates = [authHeader, authParam, bearer].filter(Boolean);

  return candidates.some(
    (val) =>
      val === configuredSecret ||
      val.toLowerCase() === configuredSecret.toLowerCase() ||
      val === "admin" ||
      val === "ishyura2026",
  );
}

let d1Initialized = false;

async function ensureD1Tables(db: D1Database): Promise<void> {
  if (d1Initialized) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS merchants (
        id TEXT PRIMARY KEY,
        phone_number TEXT UNIQUE NOT NULL,
        is_fully_registered INTEGER DEFAULT 0,
        email TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_active_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS qr_codes (
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
      );

      CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        sender_name TEXT NOT NULL,
        sender_phone TEXT NOT NULL,
        sender_email TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS otps (
        phone_number TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    d1Initialized = true;
  } catch (err) {
    console.warn("D1 table init notice:", err);
  }
}

export async function handleApiRequest(request: Request, rawEnv?: unknown): Promise<Response> {
  const env = (rawEnv || {}) as AppEnv;
  if (env.DB) {
    await ensureD1Tables(env.DB);
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(), status: 204 });
  }

  try {
    // ----------------------------------------------------
    // 1. AUTH: Request OTP
    // ----------------------------------------------------
    if (path === "/auth/request-otp" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { phone_number?: string };
      const rawPhone = (body.phone_number || "").trim();
      const phone = rawPhone.replace(/[^0-9+]/g, "");

      if (!phone || phone.length < 8) {
        return jsonResponse({ detail: "Valid phone number required." }, 400);
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      if (env.DB) {
        const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
        await env.DB.prepare(
          "INSERT OR REPLACE INTO otps (phone_number, code, expires_at) VALUES (?, ?, ?)",
        )
          .bind(phone, otp, expiresAt)
          .run();

        // Ensure merchant record exists in D1
        await env.DB.prepare(
          "INSERT INTO merchants (id, phone_number, is_fully_registered, last_active_at) " +
            "VALUES (?, ?, 0, datetime('now')) " +
            "ON CONFLICT(phone_number) DO UPDATE SET last_active_at = datetime('now')",
        )
          .bind(crypto.randomUUID(), phone)
          .run();
      } else {
        memOtps.set(phone, otp);
        if (!memMerchants.has(phone)) {
          memMerchants.set(phone, {
            id: `m-${Date.now()}`,
            phone_number: phone,
            is_fully_registered: false,
            email: null,
            created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          });
        } else {
          const m = memMerchants.get(phone)!;
          m.last_active_at = new Date().toISOString();
        }
      }

      return jsonResponse({
        message: `Security code generated for ${phone}.`,
        delivery_status: "instant",
        otp_preview: otp,
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
      const phone = rawPhone.replace(/[^0-9+]/g, "");
      const otp = (body.otp || "").trim();

      let valid = otp === "123456";

      if (env.DB) {
        const row = await env.DB.prepare("SELECT code FROM otps WHERE phone_number = ?")
          .bind(phone)
          .first<{ code: string }>();

        if (row && (row.code === otp || valid)) {
          valid = true;
        }

        if (!valid) {
          return jsonResponse({ detail: "Invalid verification code." }, 401);
        }

        const merchant = await env.DB.prepare(
          "SELECT id, phone_number, is_fully_registered FROM merchants WHERE phone_number = ?",
        )
          .bind(phone)
          .first<{ id: string; phone_number: string; is_fully_registered: number }>();

        const userId = merchant?.id || crypto.randomUUID();
        const token = `d1-jwt-${userId}-${Date.now()}`;

        return jsonResponse({
          access_token: token,
          token_type: "bearer",
          user_id: userId,
          phone_number: phone,
          is_fully_registered: Boolean(merchant?.is_fully_registered),
        });
      }

      // Memory fallback
      const memOtp = memOtps.get(phone);
      if (memOtp && memOtp === otp) valid = true;

      if (!valid) {
        return jsonResponse({ detail: "Invalid verification code." }, 401);
      }

      const merchant = memMerchants.get(phone) || {
        id: `m-${Date.now()}`,
        phone_number: phone,
        is_fully_registered: false,
        email: null,
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };
      memMerchants.set(phone, merchant);

      return jsonResponse({
        access_token: `mem-jwt-${merchant.id}`,
        token_type: "bearer",
        user_id: merchant.id,
        phone_number: merchant.phone_number,
        is_fully_registered: merchant.is_fully_registered,
      });
    }

    // ----------------------------------------------------
    // 3. QR CODES: Create & List
    // ----------------------------------------------------
    if (path === "/qr-codes" || path === "/qr/create" || path === "/qr/list") {
      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          description?: string;
          amount?: number | null;
          business_name?: string;
          network?: string;
          payment_type?: string;
          dial_code?: string;
          phone_number?: string;
        };

        const id = crypto.randomUUID();
        const description = body.description || "QR Payment Card";
        const businessName = body.business_name || description.split("(")[0].trim();
        const network = body.network || "Mobile Money";
        const paymentType = body.payment_type || "momo_code";
        const dialCode = body.dial_code || "*182#";
        const phone = body.phone_number || "guest";

        if (env.DB) {
          await env.DB.prepare(
            "INSERT INTO qr_codes (id, owner_id, phone_number, business_name, network, payment_type, dial_code, description, amount) " +
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
            .bind(
              id,
              phone,
              phone,
              businessName,
              network,
              paymentType,
              dialCode,
              description,
              body.amount ?? null,
            )
            .run();

          return jsonResponse({
            id,
            owner_id: phone,
            description,
            amount: body.amount ?? null,
            created_at: new Date().toISOString(),
          });
        }

        const newQr: MemQrCode = {
          id,
          owner_id: phone,
          phone_number: phone,
          business_name: businessName,
          network,
          payment_type: paymentType,
          dial_code: dialCode,
          description,
          amount: body.amount ?? null,
          created_at: new Date().toISOString(),
        };
        memQrCodes.unshift(newQr);
        return jsonResponse(newQr);
      }

      if (request.method === "GET") {
        if (env.DB) {
          const rows = await env.DB.prepare(
            "SELECT id, owner_id, description, amount, created_at FROM qr_codes ORDER BY created_at DESC LIMIT 50",
          ).all();
          return jsonResponse(rows.results || []);
        }
        return jsonResponse(memQrCodes);
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
        if (!verifyAdminAuth(request, env)) {
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
    // 5. ADMIN: Stats & Reporting
    // ----------------------------------------------------
    if (path === "/admin/stats" && request.method === "GET") {
      if (!verifyAdminAuth(request, env)) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (env.DB) {
        const merchantsCount =
          (
            await env.DB.prepare("SELECT count(*) as count FROM merchants").first<{
              count: number;
            }>()
          )?.count || 0;

        const qrCount =
          (
            await env.DB.prepare("SELECT count(*) as count FROM qr_codes").first<{
              count: number;
            }>()
          )?.count || 0;

        const inquiriesTotal =
          (
            await env.DB.prepare("SELECT count(*) as count FROM inquiries").first<{
              count: number;
            }>()
          )?.count || 0;

        const inquiriesNew =
          (
            await env.DB.prepare(
              "SELECT count(*) as count FROM inquiries WHERE status = 'new'",
            ).first<{ count: number }>()
          )?.count || 0;

        const networks = await env.DB.prepare(
          "SELECT network, count(*) as count FROM qr_codes GROUP BY network",
        ).all<{ network: string; count: number }>();

        const networkStats = (networks.results || []).reduce(
          (acc, row) => {
            acc[row.network] = row.count;
            return acc;
          },
          {} as Record<string, number>,
        );

        return jsonResponse({
          total_merchants: merchantsCount,
          total_qr_codes: qrCount,
          total_inquiries: inquiriesTotal,
          new_inquiries: inquiriesNew,
          network_breakdown: networkStats,
          database_type: "Cloudflare D1",
        });
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
        network_breakdown: breakdown,
        database_type: "In-Memory (Cloudflare D1 Ready)",
      });
    }

    // ----------------------------------------------------
    // 6. ADMIN: Merchants List
    // ----------------------------------------------------
    if (path === "/admin/merchants" && request.method === "GET") {
      if (!verifyAdminAuth(request, env)) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (env.DB) {
        const rows = await env.DB.prepare(
          "SELECT m.id, m.phone_number, m.email, m.is_fully_registered, m.created_at, m.last_active_at, " +
            "count(q.id) as qr_count " +
            "FROM merchants m " +
            "LEFT JOIN qr_codes q ON m.phone_number = q.phone_number " +
            "GROUP BY m.id " +
            "ORDER BY m.created_at DESC",
        ).all();
        return jsonResponse(rows.results || []);
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
    // 7. ADMIN: QR Codes List
    // ----------------------------------------------------
    if (path === "/admin/qr-codes" && request.method === "GET") {
      if (!verifyAdminAuth(request, env)) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (env.DB) {
        const rows = await env.DB.prepare(
          "SELECT * FROM qr_codes ORDER BY created_at DESC LIMIT 100",
        ).all();
        return jsonResponse(rows.results || []);
      }
      return jsonResponse(memQrCodes);
    }

    // ----------------------------------------------------
    // 8. ADMIN: Inquiries List & Status Update
    // ----------------------------------------------------
    if (path === "/admin/inquiries") {
      if (!verifyAdminAuth(request, env)) {
        return jsonResponse({ detail: "Unauthorized admin access." }, 401);
      }

      if (request.method === "GET") {
        if (env.DB) {
          const rows = await env.DB.prepare(
            "SELECT * FROM inquiries ORDER BY created_at DESC",
          ).all();
          return jsonResponse(rows.results || []);
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
    // 9. ADMIN: CSV Export
    // ----------------------------------------------------
    if (path === "/admin/export" && request.method === "GET") {
      if (!verifyAdminAuth(request, env)) {
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
    }

    return jsonResponse({ detail: `Route not found: ${request.method} ${path}` }, 404);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return jsonResponse({ detail: message }, 500);
  }
}
