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

CREATE TABLE IF NOT EXISTS payment_destinations (
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
);

CREATE TABLE IF NOT EXISTS payment_stands (
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
);

CREATE TABLE IF NOT EXISTS payment_events (
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

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  business_name TEXT NOT NULL,
  delivery_location TEXT NOT NULL,
  item_type TEXT NOT NULL, -- 'acrylic_stand', 'vinyl_stickers', 'pro_bundle', 'custom'
  quantity INTEGER DEFAULT 1,
  total_price REAL NOT NULL,
  notes TEXT,
  network TEXT,
  dial_code TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'delivered', 'cancelled'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS download_events (
  id TEXT PRIMARY KEY,
  business_name TEXT,
  network TEXT NOT NULL,
  dial_code TEXT NOT NULL,
  phone_number TEXT,
  file_format TEXT DEFAULT 'png', -- 'png', 'pdf'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_owner ON qr_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_phone ON qr_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON download_events(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_stands_public_id ON payment_stands(public_id);
CREATE INDEX IF NOT EXISTS idx_payment_stands_destination ON payment_stands(payment_destination_id);
CREATE INDEX IF NOT EXISTS idx_payment_stands_merchant ON payment_stands(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_destinations_merchant ON payment_destinations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_stand ON payment_events(stand_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at);
