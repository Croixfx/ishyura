-- Cloudflare D1 Migration 0003: Product Monetization, Entitlements & Payment Requests
-- Additive only: strictly preserves all existing merchants, qr_codes, orders, and inquiries.

CREATE TABLE IF NOT EXISTS merchant_entitlements (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  entitlement_type TEXT NOT NULL, -- 'offline_generation', 'pdf_download', 'pro_subscription'
  granted_count INTEGER NOT NULL DEFAULT 0,
  consumed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'revoked'
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  request_reference TEXT UNIQUE NOT NULL, -- e.g. 'PAY-REQ-100234'
  merchant_id TEXT NOT NULL,
  merchant_phone TEXT NOT NULL,
  product_type TEXT NOT NULL, -- 'offline_generation', 'pdf_download', 'pro_subscription', 'physical_stand'
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  payment_method TEXT NOT NULL, -- 'mtn_momo', 'airtel_money', 'equity_ekash'
  submitted_reference TEXT, -- Merchant transaction ID or SMS code
  proof_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes TEXT,
  reviewed_by TEXT, -- Admin email or ID
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entitlement_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  request_id TEXT,
  event_type TEXT NOT NULL, -- 'initial_grant', 'admin_approved_grant', 'consume_generation', 'consume_pdf'
  entitlement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entitlements_merchant ON merchant_entitlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_type ON merchant_entitlements(entitlement_type);
CREATE INDEX IF NOT EXISTS idx_payment_requests_merchant ON payment_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created ON payment_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_entitlement_events_merchant ON entitlement_events(merchant_id);

-- Safe backfill: Every existing registered merchant gets 1 included initial offline generation and 1 PDF download
INSERT OR IGNORE INTO merchant_entitlements (
  id, merchant_id, entitlement_type, granted_count, consumed_count, status, created_at, updated_at
)
SELECT
  'ent_init_gen_' || m.id,
  m.id,
  'offline_generation',
  MAX(1, COALESCE((SELECT COUNT(*) FROM qr_codes q WHERE q.owner_id = m.id OR q.phone_number = m.phone_number), 0)),
  COALESCE((SELECT COUNT(*) FROM qr_codes q WHERE q.owner_id = m.id OR q.phone_number = m.phone_number), 0),
  'active',
  COALESCE(m.created_at, datetime('now')),
  datetime('now')
FROM merchants m
WHERE NOT EXISTS (
  SELECT 1 FROM merchant_entitlements e
  WHERE e.merchant_id = m.id AND e.entitlement_type = 'offline_generation'
);

INSERT OR IGNORE INTO merchant_entitlements (
  id, merchant_id, entitlement_type, granted_count, consumed_count, status, created_at, updated_at
)
SELECT
  'ent_init_pdf_' || m.id,
  m.id,
  'pdf_download',
  1,
  0,
  'active',
  COALESCE(m.created_at, datetime('now')),
  datetime('now')
FROM merchants m
WHERE NOT EXISTS (
  SELECT 1 FROM merchant_entitlements e
  WHERE e.merchant_id = m.id AND e.entitlement_type = 'pdf_download'
);
