-- 🛡️ 2026-05-17: orders.settlement_status CHECK 제약 확장.
--
-- 배경:
--   migration 0010 이 'CHECK(settlement_status IN ("pending","settled","cancelled"))' 정의.
--   그러나 production 코드는 'confirmed' (배송 확정) 과 'completed' (정산 처리 완료) 도 사용:
--     · orders.routes.ts:216, :260 — 배송 확정 시 settlement_status='confirmed'
--     · admin-settlements.routes.ts:247 — 어드민 정산 처리 시 'completed'
--     · cron scheduled-cleanup.ts:355 — 14일 자동 확정 시 'completed'
--   → CHECK 위반 시 SqlError. 사용자 정산/배송 confirm 동작 silent 실패 위험.
--
-- 해결: settlement_status 컬럼을 DROP 후 CHECK 없는 컬럼으로 재생성.
--   원본 데이터는 _bak 컬럼으로 보존 후 복원. 0118 의 orders.status fix 동일 패턴.
--
-- 향후 코드 표준화 todo: 'confirmed' / 'completed' / 'settled' 중 하나로 통일 권장.

-- 1. 현재 값 백업
ALTER TABLE orders ADD COLUMN _settlement_status_bak TEXT;
UPDATE orders SET _settlement_status_bak = settlement_status;

-- 2. 기존 컬럼 제거 (CHECK 함께 삭제)
ALTER TABLE orders DROP COLUMN settlement_status;

-- 3. CHECK 없는 컬럼으로 재생성 (DEFAULT 'pending' 유지)
ALTER TABLE orders ADD COLUMN settlement_status TEXT DEFAULT 'pending';

-- 4. 백업 데이터 복원
UPDATE orders SET settlement_status = COALESCE(_settlement_status_bak, 'pending');

-- 5. 백업 컬럼 제거
ALTER TABLE orders DROP COLUMN _settlement_status_bak;

-- 6. 인덱스 재생성 (0010 에서 생성된 인덱스가 DROP COLUMN 시 사라짐)
CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_settlement ON orders(seller_id, settlement_status);
