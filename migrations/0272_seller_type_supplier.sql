-- 🛡️ 2026-05-19: 셀러 타입 분리 — 가게 사장님 (store_owner) vs 인플루언서 (influencer).
--
-- 배경: D (셀러 공동구매) 정산이 셀러(인플루언서) + 가게 + 플랫폼 3자 분배 구조여야 함.
--   기존 consignment_partnerships + lib/consignment-split 이 이미 3자 분배 지원.
--   가게 사장님도 sellers 테이블의 일원으로 추가하되 seller_type 으로 구분:
--     'influencer' — 본인이 라이브 송출 + 상품 판매 (기본, 인플루언서)
--     'store_owner' — 라이브 안 함, 상품 등록 + 정산만 (가게 사장님 / 도매처)
--     'both'        — 본인 라이브도 송출하면서 다른 셀러에게 공급도 함
--
-- 흐름:
--   1. 가게 사장님 → seller 가입 (seller_type='store_owner')
--      또는 어드민이 빠른 등록 (가게 정보 입력 → 자동 store_owner 셀러 계정 생성)
--   2. 인플루언서 셀러가 가게 상품을 자기 라이브에서 위탁 판매 신청
--      POST /api/seller/consignment/request { product_id, host_rate: 30 }
--   3. 가게 승인 → consignment_partnerships.status='active'
--   4. 정산 자동 3자 분배 (lib/consignment-split.calcConsignmentSplit) —
--      가게(원 store_owner) / 인플루언서(라이브 host) / 플랫폼.
--
-- 마이그레이션 0151 에서 seller_type 추가가 주석 처리되어 있어 production 에 미존재 가능.
-- 이 migration 에서 멱등 처리 (이미 있으면 무시).

ALTER TABLE sellers ADD COLUMN seller_type TEXT
  CHECK (seller_type IN ('influencer','store_owner','both'))
  DEFAULT 'influencer';

-- store_owner 는 라이브 송출 안 함 (UI 에서 hide / 라이브 시작 버튼 비활성).
-- 단순화: trigger 대신 application 레이어에서 처리.
ALTER TABLE sellers ADD COLUMN can_broadcast INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_sellers_type_active
  ON sellers(seller_type, is_active);

-- 빠른 검색: 공급자 (store_owner / both) 만 필터링.
CREATE INDEX IF NOT EXISTS idx_sellers_supplier_active
  ON sellers(is_active) WHERE seller_type IN ('store_owner','both');
