-- Cloudflare D1 Migration 0001: Initial Schema
-- Migration created to automatically execute on Cloudflare D1 deployments

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

CREATE TABLE IF NOT EXISTS orders (
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
);

CREATE TABLE IF NOT EXISTS download_events (
  id TEXT PRIMARY KEY,
  business_name TEXT,
  network TEXT NOT NULL,
  dial_code TEXT NOT NULL,
  phone_number TEXT,
  file_format TEXT DEFAULT 'png',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_owner ON qr_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_phone ON qr_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON download_events(created_at);
