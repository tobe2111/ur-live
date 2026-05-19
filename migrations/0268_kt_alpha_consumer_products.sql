-- 🛡️ 2026-05-19: KT Alpha 상품권 자동 대량 등록 — 사용자 직접 구매 (딜 결제 전용).
--
--   ⚠️ KT Alpha 정책 리스크: 운영 측 결정으로 진행. 사전 승인 받아두는 것 권장.
--
--   추가 컬럼:
--     - kt_alpha_gift_code: gift_catalog 의 PK 와 연결 (NULL = 일반 상품)
--     - deal_only: 1 이면 딜 결제만 가능 (현금/PG 차단)
--     - auto_voucher_send: 1 이면 결제 성공 시 자동 KT Alpha sendCoupon 호출
--
--   설계:
--     - 가격 = real_price × (1 + kt_alpha_markup_pct/100)   (셀러 markup 과 분리된 별도 설정 권장 = 'kt_alpha_consumer_markup_pct')
--     - 재고는 무한 (stock=999999) — 실제 한도는 KT Alpha 비즈머니
--     - seller_id NULL — 플랫폼 직판 (or 'kt_alpha_admin_seller_id' 설정에서 가져옴)

-- 1. products 컬럼 추가 (idempotent — 이미 있으면 에러 무시).
ALTER TABLE products ADD COLUMN kt_alpha_gift_code TEXT;
ALTER TABLE products ADD COLUMN deal_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN auto_voucher_send INTEGER NOT NULL DEFAULT 0;

-- 2. 인덱스 — 중복 import 차단 + 빠른 조회.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_kt_alpha_gift_code ON products(kt_alpha_gift_code) WHERE kt_alpha_gift_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_deal_only ON products(deal_only) WHERE deal_only = 1;

-- 3. platform_settings — 소비자 마진 (셀러 정산 markup 과 별도).
INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES
  ('kt_alpha_consumer_markup_pct', '20', '소비자 직판 마진 % (액면가 위에 추가, deal 결제 전용)'),
  ('kt_alpha_consumer_enabled', '0', '소비자 직판 활성 (1=노출, 0=숨김). KT Alpha 사전 승인 후 1.'),
  ('kt_alpha_admin_seller_id', '', 'KT Alpha 직판 상품의 seller_id (어드민 시드 셀러 ID, 비우면 NULL)'),
  ('kt_alpha_consumer_category', 'voucher', 'KT Alpha 직판 상품 카테고리 (검색/필터링용)');
