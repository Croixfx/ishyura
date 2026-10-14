-- Cloudflare D1 Migration 0004: Rate limiting (OTP request / verification attempts)
-- Idempotent: the API also creates this table lazily on first use.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
