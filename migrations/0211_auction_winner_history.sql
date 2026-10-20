-- ============================================================
-- Migration 0211: 경매 낙찰자 변경 이력 (TD-007)
-- ============================================================
-- 배경: 낙찰자가 결제 불이행(forfeit) 시 차순위 자동 승격이 없어
--       매번 수동 처리 필요. 이력 추적을 위한 테이블 추가.
--
-- 변경 사항:
-- 1) auction_winner_history: 낙찰자 변경 이력 (audit)
--    reason: 'won' (최초 낙찰), 'forfeited' (불이행으로 회수),
--            'promoted' (차순위 승격), 'cancelled' (경매 취소)
-- 2) auction_holds.forfeit_reason: hold 가 forfeit 으로 release 된 경우 사유
--
-- 작성일: 2026-04-26
-- 참조: TECHNICAL_DEBT.md TD-007
-- ============================================================

CREATE TABLE IF NOT EXISTS auction_winner_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auction_id INTEGER NOT NULL,
  user_id TEXT,
  user_name TEXT,
  amount INTEGER,
  reason TEXT NOT NULL CHECK (reason IN ('won', 'forfeited', 'promoted', 'cancelled')),
  notes TEXT,
  recorded_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (auction_id) REFERENCES live_auctions(id)
);

CREATE INDEX IF NOT EXISTS idx_auction_winner_history_auction
  ON auction_winner_history(auction_id, recorded_at);

ALTER TABLE auction_holds ADD COLUMN forfeit_reason TEXT;
