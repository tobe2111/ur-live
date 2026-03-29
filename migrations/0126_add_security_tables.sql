-- ============================================================
-- Migration 0126: Security tables
-- rate_limit_attempts: 로그인/API 브루트포스 방어
-- admin_audit_logs: 어드민 액션 감사 로그
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,             -- e.g. "login:1.2.3.4" or "sms:+821012345678"
  action TEXT NOT NULL,          -- e.g. "login", "sms", "alimtalk"
  window_start INTEGER NOT NULL, -- unix timestamp (seconds)
  count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(key, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_action ON rate_limit_attempts(key, action, window_start);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL,          -- e.g. "approve_seller", "reject_seller", "change_commission"
  target_type TEXT,              -- e.g. "seller", "order", "product"
  target_id TEXT,
  before_value TEXT,             -- JSON snapshot before change
  after_value TEXT,              -- JSON snapshot after change
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_logs(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action, created_at);
