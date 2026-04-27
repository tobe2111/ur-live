-- ============================================================
-- Migration 0226: 라이브 종료 자동 KPI 메트릭 캐시
-- ============================================================
-- 컨셉: 라이브 종료 시 (또는 cron 주기적으로) 6개 메트릭을 사전 집계해
--   live_stream_metrics 에 저장. 캘린더/대시보드에서 즉시 표시 (실시간 계산 X).
--
-- 메트릭 6개:
--   peak_viewers          — 피크 시청자 수
--   avg_viewers           — 평균 시청자 수
--   total_revenue         — 라이브 동안 매출 (orders)
--   total_donations       — 라이브 동안 후원
--   chat_count            — 채팅 수
--   new_followers         — 신규 팔로워 (없으면 0)
--
-- 작성: 2026-04-27 (Phase 2-4)
-- ============================================================

CREATE TABLE IF NOT EXISTS live_stream_metrics (
  live_stream_id INTEGER PRIMARY KEY,
  seller_id INTEGER NOT NULL,
  peak_viewers INTEGER DEFAULT 0,
  avg_viewers INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  total_donations INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_live_stream_metrics_seller
  ON live_stream_metrics(seller_id, computed_at DESC);
