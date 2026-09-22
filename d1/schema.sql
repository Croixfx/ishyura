-- Cloudflare D1 Database Schema for Ishyura
-- To initialize: npx wrangler d1 execute ishyura-db --file=./d1/schema.sql

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
  status TEXT DEFAULT 'new', -- 'new', 'in_progress', 'resolved'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otps (
  phone_number TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_owner ON qr_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_phone ON qr_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
