-- ============================================================
-- Migration 0219: 정산 송장 (Invoice) — M6
-- ============================================================
-- 배경: TikTok Backstage 의 매월 자동 정산 명세서 모델.
-- 현재: 정산 신청만 있고 명세서 (송장) 발급 흐름 없음.
-- 목표: 매월 자동 명세서 생성 → R2 (옵션) 또는 inline HTML → 에이전시 다운로드.
--
-- Phase 1 (이 마이그레이션):
--   - agency_settlement_invoices 테이블 (HTML 본문 inline 저장)
--   - R2 binding 있으면 추가 업로드 (cron 측에서 처리)
--
-- Phase 2 (별도):
--   - PDF 생성 (Cloudflare Workers PDF — Browser Rendering API)
--   - 이메일 발송
--
-- 작성일: 2026-04-26 (M6)
-- 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (I)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_settlement_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  -- 대상 월 (YYYY-MM)
  month TEXT NOT NULL,
  -- 발행 번호 (사용자 친화 — INV-2026-04-{agency_id}-NNN)
  invoice_number TEXT NOT NULL UNIQUE,
  -- 합계 정보 (snapshot)
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 2.0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL DEFAULT 0,
  -- HTML 본문 (inline 저장; R2 키 별도)
  html_content TEXT NOT NULL,
  -- R2 업로드 후 키 (옵션)
  r2_key TEXT,
  -- 상태: draft / issued / paid / cancelled
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft','issued','paid','cancelled')),
  paid_at DATETIME,
  -- 정산 row 와의 링크 (옵션)
  settlement_id INTEGER,
  generated_by TEXT,    -- 'cron' | 'manual'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, month),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (settlement_id) REFERENCES agency_settlements(id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_invoices_agency_month
  ON agency_settlement_invoices(agency_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_invoices_status
  ON agency_settlement_invoices(status, created_at DESC);
