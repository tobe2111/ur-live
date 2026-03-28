-- ============================================================
-- Migration 0123: 알림톡 충전 패키지 테이블
-- 어드민이 대시보드에서 패키지(건수/가격)를 직접 수정 가능
-- ============================================================

CREATE TABLE IF NOT EXISTS alimtalk_packages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT    NOT NULL,           -- "100건", "1,000건" 등 표시명
  credits    INTEGER NOT NULL,           -- 충전 건수
  price      INTEGER NOT NULL,           -- 판매가 (원)
  is_active  INTEGER NOT NULL DEFAULT 1, -- 0=비활성(셀러에게 미노출)
  sort_order INTEGER NOT NULL DEFAULT 0, -- 정렬 순서
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 초기 패키지 데이터 (건당 9원)
INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order) VALUES
  ('100건',   100,   900,   1, 1),
  ('500건',   500,   4500,  1, 2),
  ('1,000건', 1000,  9000,  1, 3),
  ('3,000건', 3000,  27000, 1, 4),
  ('5,000건', 5000,  45000, 1, 5);
