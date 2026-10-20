-- 🛡️ 2026-05-22: 영구 perf 인프라 — group-buy 피드 materialized cache.
--
-- 의도: D1 + KV 만으로 100만 사용자 대응 가능한 cache 패턴.
--   현재 (1만 명): KV 300s TTL + D1 SELECT 직접 조회로 충분.
--   확장 (100만 명): 동시 cold miss 시 D1 부하 폭증 → pre-computed snapshot 으로 우회.
--
-- 구조:
--   - (status, category) 별 1 row → product JSON array 저장 (LIMIT 50)
--   - cron 5분마다 갱신 (group-buy-feed-cache.ts)
--   - response 는 KV(L1) → cache table(L2) → D1 실시간(L3) 순으로 lookup
--
-- 마이그레이션은 옵트인 — 테이블만 만들어두고 cron / 응답 분기는 future PR 에서 enable.

CREATE TABLE IF NOT EXISTS group_buy_feed_cache (
  status         TEXT NOT NULL,                   -- 'active' | 'achieved' | 'expired' | 'all'
  category       TEXT NOT NULL,                   -- 'all' or single category
  product_json   TEXT NOT NULL,                   -- JSON array of product rows (~16 columns)
  row_count      INTEGER NOT NULL DEFAULT 0,      -- denormalized for quick check
  computed_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (status, category)
);

CREATE INDEX IF NOT EXISTS idx_group_buy_feed_cache_computed
  ON group_buy_feed_cache (computed_at DESC);
