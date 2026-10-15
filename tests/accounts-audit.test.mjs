import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "vite";

const rootDir = process.cwd();
const srcDir = path.resolve(rootDir, "src");

const vite = await createServer({
  configFile: false,
  root: rootDir,
  resolve: { alias: { "@": srcDir } },
  server: { middlewareMode: true },
  appType: "custom",
});
const { handleApiRequest } = await vite.ssrLoadModule("/src/lib/api-router.ts");

/** Just enough of Cloudflare D1 on top of an in-memory SQLite database. */
function makeD1() {
  const db = new DatabaseSync(":memory:");
  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes) } };
    },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return {
    raw: db,
    exec: async (sql) => db.exec(sql),
    prepare: (sql) => statement(sql),
  };
}

const ADMIN_SECRET = "test-admin-secret-0123456789abcdef";
const PASSWORD = "correct horse battery";

function passwordHash(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2$100000$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function api(env, method, route, { token, admin, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (admin) headers["x-admin-key"] = ADMIN_SECRET;
  return handleApiRequest(
    new Request(`http://localhost/api${route}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}

// The API creates its tables once per process, so every test shares one database and starts it clean.
const DB = makeD1();
const env = { DB, ADMIN_SECRET };

async function setup() {
  await api(env, "GET", "/health"); // creates the tables
  for (const table of [
    "merchants",
    "qr_codes",
    "audit_events",
    "merchant_entitlements",
    "entitlement_events",
    "payment_destinations",
    "payment_stands",
    "payment_requests",
    "rate_limits",
    "download_events",
  ]) {
    try {
      DB.raw.exec(`DELETE FROM ${table}`);
    } catch {
      // table is created later, on first use
    }
  }
  DB.raw
    .prepare(
      "INSERT INTO merchants (id, phone_number, email, business_name, role, password_hash, is_fully_registered) VALUES (?, ?, ?, ?, 'merchant', ?, 1)",
    )
    .run("m-1", "+250788111222", "shop@example.com", "Kimironko Shop", passwordHash(PASSWORD));
  return env;
}

async function signIn(env) {
  const res = await api(env, "POST", "/auth/password-login", {
    body: { identifier: "shop@example.com", password: PASSWORD },
  });
  assert.equal(res.status, 200, "merchant can sign in");
  return (await res.json()).access_token;
}

test("a deactivated account is cut off at once, and can come back when reactivated", async () => {
  const env = await setup();
  const token = await signIn(env);

  const before = await api(env, "GET", "/qr/list", { token });
  assert.equal(before.status, 200);

  const off = await api(env, "POST", "/admin/merchants/deactivate", {
    admin: true,
    body: { merchant_id: "m-1", reason: "fake business name" },
  });
  assert.equal(off.status, 200);

  // the token is still valid, but the account is not
  const blocked = await api(env, "GET", "/qr/list", { token });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).error, "ACCOUNT_DEACTIVATED");

  // and it cannot sign in again
  const login = await api(env, "POST", "/auth/password-login", {
    body: { identifier: "shop@example.com", password: PASSWORD },
  });
  assert.equal(login.status, 403);
  assert.equal((await login.json()).error, "ACCOUNT_DEACTIVATED");

  // the admin list shows why
  const merchants = await (await api(env, "GET", "/admin/merchants", { admin: true })).json();
  const row = merchants.find((m) => m.id === "m-1");
  assert.ok(row.deactivated_at);
  assert.equal(row.deactivated_reason, "fake business name");

  const on = await api(env, "POST", "/admin/merchants/reactivate", {
    admin: true,
    body: { merchant_id: "m-1" },
  });
  assert.equal(on.status, 200);
  assert.equal((await api(env, "GET", "/qr/list", { token })).status, 200);
  assert.equal((await signIn(env)).length > 20, true);
});

test("administrators cannot be deactivated, and only admins can deactivate", async () => {
  const env = await setup();
  env.DB.raw
    .prepare(
      "INSERT INTO merchants (id, phone_number, email, business_name, role, is_fully_registered) VALUES ('m-admin', '+250788000001', 'jeanniyonkuru29@gmail.com', 'Owner', 'merchant', 1)",
    )
    .run();

  const refused = await api(env, "POST", "/admin/merchants/deactivate", {
    admin: true,
    body: { merchant_id: "m-admin" },
  });
  assert.equal(refused.status, 400);

  const token = await signIn(env);
  const notAdmin = await api(env, "POST", "/admin/merchants/deactivate", {
    token,
    body: { merchant_id: "m-1" },
  });
  assert.equal(notAdmin.status, 401);
  assert.equal(
    (await api(env, "POST", "/admin/merchants/deactivate", { admin: true, body: {} })).status,
    400,
  );
  assert.equal(
    (
      await api(env, "POST", "/admin/merchants/deactivate", {
        admin: true,
        body: { merchant_id: "nobody" },
      })
    ).status,
    404,
  );
});

test("the audit trail names the owner of every QR card created and deleted", async () => {
  const env = await setup();
  const token = await signIn(env);

  const created = await api(env, "POST", "/qr-codes", {
    token,
    body: {
      business_name: "Kimironko Shop",
      network: "MTN MoMo",
      payment_type: "momo_code",
      dial_code: "*182*8*1*123456#",
      phone_number: "+250788111222",
    },
  });
  assert.equal(created.status, 200, await created.clone().text());
  const qr = await created.json();

  const audit = await (await api(env, "GET", "/admin/audit", { admin: true })).json();
  const made = audit.find((e) => e.event_type === "qr_created");
  assert.ok(made, "creation is logged");
  assert.equal(made.qr_id, qr.id);
  assert.equal(made.kind, "qr");
  assert.equal(made.owner_id, "m-1");
  assert.equal(made.owner_name, "Kimironko Shop");
  assert.equal(made.owner_email, "shop@example.com");
  assert.equal(made.owner_phone, "+250788111222");
  assert.equal(made.actor_role, "merchant");
  assert.equal(made.label, "Kimironko Shop");

  const removed = await api(env, "DELETE", `/qr-codes?id=${encodeURIComponent(qr.id)}`, { token });
  assert.equal(removed.status, 200, await removed.clone().text());
  const after = await (await api(env, "GET", "/admin/audit", { admin: true })).json();
  const gone = after.find((e) => e.event_type === "qr_deleted");
  assert.ok(gone, "deletion is logged");
  assert.equal(gone.owner_id, "m-1");
  assert.equal(gone.owner_email, "shop@example.com");

  // a smart stand (QR + NFC tag) is recorded as such, with the same owner
  const audit2 = await api(env, "GET", "/admin/audit");
  assert.equal(audit2.status, 401, "the audit trail is admin-only");
});

test("account changes are audited with who did them", async () => {
  const env = await setup();
  await api(env, "POST", "/admin/merchants/deactivate", {
    admin: true,
    body: { merchant_id: "m-1", reason: "chargeback fraud" },
  });
  const audit = await (await api(env, "GET", "/admin/audit", { admin: true })).json();
  const ev = audit.find((e) => e.event_type === "account_deactivated");
  assert.ok(ev);
  assert.equal(ev.owner_id, "m-1");
  assert.equal(ev.actor_role, "admin");
  assert.equal(ev.detail, "chargeback fraud");
});

test("deleting a previous QR card does not return the offline slot: generating phone/eKash next requires payment", async () => {
  const env = await setup();
  const token = await signIn(env);

  // 1. First generation (MTN MoMo code) succeeds as the free included generation
  const res1 = await api(env, "POST", "/qr-codes", {
    token,
    body: {
      business_name: "Kimironko Shop",
      network: "MTN MoMo",
      payment_type: "momo_code",
      dial_code: "*182*8*1*123456#",
      phone_number: "+250788111222",
    },
  });
  assert.equal(res1.status, 200, "first offline generation allowed");
  const qr1 = await res1.json();

  // 2. Delete the created card
  const del = await api(env, "DELETE", `/qr-codes?id=${encodeURIComponent(qr1.id)}`, { token });
  assert.equal(del.status, 200);

  // 3. Generating a phone number / eKash stand afterwards is strictly locked (non-negotiable payment)
  const res2 = await api(env, "POST", "/qr-codes", {
    token,
    body: {
      business_name: "Kimironko Shop",
      network: "Equity Bank (eKash)",
      payment_type: "phone",
      dial_code: "*555*2*0788111222#",
      phone_number: "+250788111222",
    },
  });
  assert.equal(res2.status, 402, "second offline generation locked even after delete");
  const body2 = await res2.json();
  assert.equal(body2.error, "ENTITLEMENT_REQUIRED");
  assert.equal(body2.locked, true);

  // 4. Entitlements endpoint confirms available is 0 and consumed is at least 1
  const entRes = await api(env, "GET", "/merchants/entitlements", { token });
  assert.equal(entRes.status, 200);
  const entData = await entRes.json();
  assert.equal(entData.offline_generations.available, 0);
  assert.ok(entData.offline_generations.consumed >= 1);
});

test("creating an NFC / smart stand records kind nfc_stand and the owner in audit trail", async () => {
  const env = await setup();
  const token = await signIn(env);

  // Grant PRO entitlement so smart stand can be generated
  env.DB.raw
    .prepare(
      "INSERT INTO merchant_entitlements (id, merchant_id, entitlement_type, entitlement_key, granted_count, consumed_count, status, expires_at) VALUES ('ent-pro-1', 'm-1', 'pro_subscription', 'dynamic_pro_subscription', 1, 0, 'active', datetime('now', '+30 days'))",
    )
    .run();

  const created = await api(env, "POST", "/qr-codes", {
    token,
    body: {
      business_name: "Kimironko Smart Mart",
      network: "MTN MoMo",
      payment_type: "momo_code",
      dial_code: "*182*8*1*654321#",
      phone_number: "+250788111222",
      is_dynamic: true,
    },
  });
  assert.equal(created.status, 200);
  const stand = await created.json();

  const audit = await (await api(env, "GET", "/admin/audit", { admin: true })).json();
  const nfcEvent = audit.find((e) => e.qr_id === stand.id && e.event_type === "qr_created");
  assert.ok(nfcEvent, "smart stand creation is logged");
  assert.equal(nfcEvent.kind, "nfc_stand");
  assert.equal(nfcEvent.owner_id, "m-1");
  assert.equal(nfcEvent.owner_name, "Kimironko Shop");
  assert.equal(nfcEvent.owner_email, "shop@example.com");
  assert.equal(nfcEvent.owner_phone, "+250788111222");
});

test.after(async () => {
  await vite.close();
});
