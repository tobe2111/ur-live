-- ============================================================
-- Migration 0222: 누락된 보조 테이블 생성 (X1 위험 감소)
-- ============================================================
-- 배경: 이번 세션에 추가된 cron handlers (tier-eval, monthly-invoices,
--       monthly-tasks, creator-eval) 가 다음 테이블에 직접 INSERT 한다:
--   - agency_notifications (lib/notifications.ts 에서만 auto-create)
--   - agency_contracts (agency.routes.ts 에서만 auto-create)
--   - agency_settlements (agency.routes.ts 에서만 auto-create)
--   - agency_seller_targets (agency.routes.ts 에서만 auto-create)
--
-- 위험: cron 이 첫 실행 시 (lib 호출 전) 이 테이블들이 없으면 INSERT 실패 (silent).
--       사용자가 알림을 못 받음.
-- 해결: 마이그레이션으로 명시적 생성. 멱등 (CREATE TABLE IF NOT EXISTS).
--
-- 작성: 2026-04-26 (X1)
-- ============================================================

-- 에이전시 알림 (in-app dashboard notification)
CREATE TABLE IF NOT EXISTS agency_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  type TEXT NOT NULL,         -- 'tier_change' | 'auto_settlement' | 'invoice_issued' 등
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agency_notifications_agency_unread
  ON agency_notifications(agency_id, is_read, created_at DESC);

-- 에이전시 계약 (agency.routes.ts:1318 에서 생성)
CREATE TABLE IF NOT EXISTS agency_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  terms TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 에이전시 셀러 매출 목표 (agency.routes.ts 에서 생성)
CREATE TABLE IF NOT EXISTS agency_seller_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  target_amount INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, seller_id, month)
);

-- 에이전시 정산 내역 (agency.routes.ts:818 에서 생성)
CREATE TABLE IF NOT EXISTS agency_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 2.0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  account_holder TEXT,
  status TEXT DEFAULT 'pending',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME
);
