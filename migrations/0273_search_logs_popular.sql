-- 🛡️ 2026-05-19: 검색 로그 + 인기 검색어 테이블.
--
-- 배경: /api/search/popular 와 ProductRepository.logSearch / Levenshtein 오타 보정이
--   참조하던 popular_searches / search_logs 테이블이 migration 에 정의 X → 항상 빈 결과.
--   본 migration 으로 정식화.
--
-- popular_searches:
--   keyword UNIQUE 키로 search_count 누적 (UPSERT 패턴).
--   /api/search/popular 가 search_count DESC 로 top N 반환.
--   /api/products 의 0-result 오타 보정 후보 source.
--
-- search_logs:
--   유저별 검색 이력 (감사 / abuse 추적용). 인기 검색어 산정의 raw data.
--
-- 자동 정리: 90일 초과 search_logs 는 cron 으로 정리 (별도 작업).

CREATE TABLE IF NOT EXISTS popular_searches (
  keyword TEXT PRIMARY KEY,
  search_count INTEGER NOT NULL DEFAULT 1,
  last_searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_popular_searches_count
  ON popular_searches(search_count DESC);

CREATE TABLE IF NOT EXISTS search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  search_query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_logs_query_created
  ON search_logs(search_query, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_created
  ON search_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
