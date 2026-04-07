-- 트래픽 대비 핵심 인덱스 추가
-- 결제/주문 흐름에서 자주 사용되는 쿼리 최적화

-- 주문 상태별 조회 (어드민/셀러 대시보드)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- 주문번호로 조회 (결제 승인 시 사용)
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- idempotency_key 조회 (중복 주문 방지)
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

-- 후원 조회
CREATE INDEX IF NOT EXISTS idx_donations_stream ON donations(live_stream_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_donations_order ON donations(order_id);

-- 포인트 조회
CREATE INDEX IF NOT EXISTS idx_point_tx_user_type ON point_transactions(user_id, type);
