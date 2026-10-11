/** Runtime D1 bootstrap for local/dev, matching migrations/0002_payment_domain.sql. */

interface BootstrapStatement {
  bind(...params: unknown[]): BootstrapStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface BootstrapDatabase {
  prepare(query: string): BootstrapStatement;
}

export const PAYMENT_DOMAIN_CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS payment_destinations (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    display_name TEXT,
    network TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    recipient_code TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RWF',
    status TEXT NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY,
    stand_id TEXT,
    merchant_id TEXT,
    public_id TEXT,
    event_type TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT 'online',
    amount REAL,
    provider TEXT,
    user_agent TEXT,
    config_version INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS payment_stands (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    payment_destination_id TEXT,
    public_id TEXT NOT NULL UNIQUE,
    stand_type TEXT NOT NULL DEFAULT 'standard',
    payment_mode TEXT NOT NULL DEFAULT 'CUSTOMER_AMOUNT',
    config_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    qr_encoding TEXT,
    nfc_uri TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
];

const LEGACY_QR_COLUMN_DEFINITIONS: Record<string, string> = {
  is_dynamic: "INTEGER DEFAULT 0",
  item_name: "TEXT",
};

export const PAYMENT_DOMAIN_BACKFILL: string[] = [
  `INSERT INTO payment_destinations (
     id, merchant_id, display_name, network, payment_method, recipient_code,
     currency, status, version, created_at, updated_at
   )
   SELECT
     'dst_' || q.id,
     COALESCE(NULLIF(q.owner_id, ''), NULLIF(q.phone_number, ''), 'unknown'),
     q.business_name,
     q.network,
     CASE WHEN q.payment_type = 'phone' THEN 'phone' ELSE 'merchant_code' END,
     q.dial_code,
     'RWF',
     'active',
     1,
     COALESCE(q.created_at, datetime('now')),
     datetime('now')
   FROM qr_codes q
   WHERE NOT EXISTS (
     SELECT 1 FROM payment_destinations d WHERE d.id = 'dst_' || q.id
   )`,
  `INSERT INTO payment_stands (
     id, merchant_id, payment_destination_id, public_id, stand_type, payment_mode,
     config_version, status, qr_encoding, created_at, updated_at
   )
   SELECT
     q.id,
     COALESCE(NULLIF(q.owner_id, ''), NULLIF(q.phone_number, ''), 'unknown'),
     'dst_' || q.id,
     'ish_' || substr(replace(q.id, '-', ''), 1, 16),
     CASE WHEN q.is_dynamic = 1 THEN 'pro' ELSE 'standard' END,
     CASE
       WHEN q.amount IS NOT NULL AND q.amount > 0 THEN 'FIXED_AMOUNT'
       ELSE 'CUSTOMER_AMOUNT'
     END,
     1,
     'active',
     CASE WHEN q.is_dynamic = 1 THEN 'https_pay' ELSE 'tel_ussd' END,
     COALESCE(q.created_at, datetime('now')),
     datetime('now')
   FROM qr_codes q
   WHERE NOT EXISTS (
     SELECT 1 FROM payment_stands s WHERE s.id = q.id
   )`,
];

export const PAYMENT_DOMAIN_INDEXES: string[] = [
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_stands_public_id ON payment_stands(public_id)",
  "CREATE INDEX IF NOT EXISTS idx_payment_stands_destination ON payment_stands(payment_destination_id)",
  "CREATE INDEX IF NOT EXISTS idx_payment_stands_merchant ON payment_stands(merchant_id)",
  "CREATE INDEX IF NOT EXISTS idx_payment_destinations_merchant ON payment_destinations(merchant_id)",
  "CREATE INDEX IF NOT EXISTS idx_payment_events_stand ON payment_events(stand_id)",
  "CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at)",
];

export async function ensurePaymentDomainSchema(db: BootstrapDatabase): Promise<void> {
  for (const statement of PAYMENT_DOMAIN_CREATE_TABLES) {
    await db.prepare(statement).run();
  }

  const columns = await db.prepare("PRAGMA table_info(qr_codes)").all<{ name: string }>();
  const knownColumns = new Set(columns.results.map((column) => column.name));
  for (const [name, definition] of Object.entries(LEGACY_QR_COLUMN_DEFINITIONS)) {
    if (!knownColumns.has(name)) {
      await db.prepare(`ALTER TABLE qr_codes ADD COLUMN ${name} ${definition}`).run();
    }
  }

  const missingStand = await db
    .prepare(
      "SELECT 1 FROM qr_codes q LEFT JOIN payment_stands s ON s.id = q.id WHERE s.id IS NULL LIMIT 1",
    )
    .first<{ 1: number }>();
  const missingDestination = await db
    .prepare(
      "SELECT 1 FROM qr_codes q LEFT JOIN payment_destinations d ON d.id = 'dst_' || q.id WHERE d.id IS NULL LIMIT 1",
    )
    .first<{ 1: number }>();
  if (missingStand || missingDestination) {
    for (const statement of PAYMENT_DOMAIN_BACKFILL) {
      await db.prepare(statement).run();
    }
  }

  const staleStandMetadata = await db
    .prepare(
      "SELECT 1 FROM payment_stands s JOIN qr_codes q ON q.id = s.id " +
        "WHERE s.stand_type != CASE WHEN q.is_dynamic = 1 THEN 'pro' ELSE 'standard' END " +
        "OR COALESCE(s.qr_encoding, '') != CASE WHEN q.is_dynamic = 1 THEN 'https_pay' ELSE 'tel_ussd' END " +
        "LIMIT 1",
    )
    .first<{ 1: number }>();
  if (staleStandMetadata) {
    await db
      .prepare(
        "UPDATE payment_stands " +
          "SET stand_type = CASE WHEN (SELECT is_dynamic FROM qr_codes WHERE id = payment_stands.id) = 1 THEN 'pro' ELSE 'standard' END, " +
          "qr_encoding = CASE WHEN (SELECT is_dynamic FROM qr_codes WHERE id = payment_stands.id) = 1 THEN 'https_pay' ELSE 'tel_ussd' END " +
          "WHERE EXISTS (SELECT 1 FROM qr_codes q WHERE q.id = payment_stands.id)",
      )
      .run();
  }

  for (const statement of PAYMENT_DOMAIN_INDEXES) {
    await db.prepare(statement).run();
  }
}
