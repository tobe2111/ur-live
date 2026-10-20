-- Migration: Create agency tables + seed test agency account
-- Date: 2026-04-13
--
-- Usage:
--   Local : npx wrangler d1 execute lister-db --local  --file=./migrations/0150_add_agency_tables_and_seed.sql
--   Remote: npx wrangler d1 execute lister-db --remote --file=./migrations/0150_add_agency_tables_and_seed.sql

-- ── 1. 테이블 생성 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agency_id, seller_id)
);

-- ── 2. 테스트 에이전시 계정 생성 ──────────────────────────────────
-- email: tobe2111@naver.com
-- password: 358533aa!! (PBKDF2-SHA256, 100000 iterations)
INSERT OR IGNORE INTO agencies (name, contact_name, email, password_hash, phone, status)
VALUES (
  '유어딜 본사',
  '정지원',
  'tobe2111@naver.com',
  'Hp10HtQcreH8k3VM66eVng==$vd4rPNOmPnF2evLhKdMo8nuiMNbL2xJZIL91mId6aOo=',
  '010-0000-0000',
  'active'
);

-- ── 확인 ──────────────────────────────────────────────────────
SELECT id, name, contact_name, email, status, created_at FROM agencies;
