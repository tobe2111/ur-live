-- Migration 0110: Add deleted_accounts table for account deletion tracking
-- Purpose: Track deleted accounts to enforce 30-day re-registration restriction
-- Date: 2026-03-24

CREATE TABLE IF NOT EXISTS deleted_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  email TEXT,
  reason TEXT,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reregister_available_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email ON deleted_accounts(email);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_user_id ON deleted_accounts(user_id);
