-- 🛡️ 2026-05-18: stay 관련 신규 테이블 CHECK 제약 + FK 보강.
--   배경: migration 0258 의 stay_bookings.status / voucher_orders.status 등이 enum 인데
--   CHECK 제약이 정의 안 됨 → 잘못된 값 ('PAID' 같은 대문자) INSERT 가능 → 사고 위험.
--   D1 (SQLite) 은 ALTER TABLE ADD CHECK 미지원 — 새 테이블 만들고 데이터 복사하거나
--   INSERT 시점에 application-level 검증으로 대체.
--
--   본 마이그레이션:
--     1) 신규 테이블에 한해 CHECK 제약은 이미 0258 SQL 에서 컬럼 정의 시 표현이 누락됨.
--        → 0258 을 retrofit 하기 위해 신규 CHECK 가 필요한 컬럼은 코드 레이어에서 화이트리스트 검증.
--     2) status 화이트리스트 검증 헬퍼는 application 측: src/worker/utils/stay-status.ts (별도 PR).
--     3) 본 마이그레이션은 응급 데이터 sanity 만:
--        - 잘못된 status 값 발견 시 fallback ('pending' / 'sent' 등) 으로 정리.

-- stay_bookings.status 화이트리스트: 'pending','confirmed','checked_in','checked_out','cancelled','no_show','refunded','dispute'
UPDATE stay_bookings
   SET status = 'pending'
 WHERE status NOT IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show','refunded','dispute');

-- voucher_orders.status: 'pending','processing','sent','failed','cancelled','used'
UPDATE voucher_orders
   SET status = 'pending'
 WHERE status NOT IN ('pending','processing','sent','failed','cancelled','used');

-- stay_booking_status_log.changed_by_role: 'user','seller','admin','system'
UPDATE stay_booking_status_log
   SET changed_by_role = 'system'
 WHERE changed_by_role NOT IN ('user','seller','admin','system');

-- 평점 sanity (1-5 범위 외 → NULL 처리 또는 5 clamp).
UPDATE stay_booking_reviews
   SET rating_overall = MAX(1, MIN(5, COALESCE(rating_overall, 5)))
 WHERE rating_overall NOT BETWEEN 1 AND 5;

UPDATE stay_booking_reviews SET rating_cleanliness = NULL WHERE rating_cleanliness NOT BETWEEN 1 AND 5;
UPDATE stay_booking_reviews SET rating_location    = NULL WHERE rating_location    NOT BETWEEN 1 AND 5;
UPDATE stay_booking_reviews SET rating_service     = NULL WHERE rating_service     NOT BETWEEN 1 AND 5;
UPDATE stay_booking_reviews SET rating_facility    = NULL WHERE rating_facility    NOT BETWEEN 1 AND 5;
UPDATE stay_booking_reviews SET rating_value       = NULL WHERE rating_value       NOT BETWEEN 1 AND 5;
