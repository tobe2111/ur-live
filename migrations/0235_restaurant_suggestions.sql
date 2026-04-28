-- 사용자 수요 신호: 일반 맛집 (식사권 미출시) 에 대한 영입/알림 신청
--
-- 2026-04-28: restaurant-map 페이지 옵션 B (식사권 + 일반 맛집 통합 marketplace).
-- 회색 핀 클릭 시 사용자가 "이 매장 셀러 영입 신청" 또는 "출시 알림 받기" 가능.
-- 어드민이 수요 많은 매장을 보고 셀러 영입 우선순위 결정.

CREATE TABLE IF NOT EXISTS restaurant_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Kakao Place 식별
  kakao_place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  category_name TEXT,
  road_address TEXT,
  phone TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  -- 사용자 정보 (선택 — 익명 가능)
  user_id TEXT,
  user_phone TEXT, -- 출시 알림 수신용
  -- 신청 종류
  kind TEXT NOT NULL DEFAULT 'invite', -- 'invite' (셀러 영입), 'notify' (출시 알림)
  -- 메타
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- kakao_place_id 별 집계 빠르게
CREATE INDEX IF NOT EXISTS idx_restaurant_suggestions_place ON restaurant_suggestions(kakao_place_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_suggestions_kind ON restaurant_suggestions(kind, created_at DESC);
