-- 🛡️ 2026-05-18: 기프티쇼 (KT Alpha) B2B API 통합 — 비사업자 셀러 상품권 정산용.
--
--   API 0101 상품 목록 조회 (POST https://bizapi.giftishow.com/bizApi/goods)
--   를 매일 1회 cron 으로 sync → gift_catalog 테이블 저장.
--   셀러 정산 페이지에서 catalog 조회 → 선택 → orderSend API 호출.
--
--   필드 매핑 (API 응답 → DB):
--     goodsCode → gift_code (PK)
--     goodsName → name
--     brandName → brand_name
--     salePrice / discountPrice / realPrice → 가격 3종
--     goodsImgS / goodsImgB → image_url_small / large
--     validPrdTypeCd ('01' 일수 / '02' 일자) + limitday / validPrdDay → 유효기간 표시
--     goodsStateCd ('SALE' 판매중 / 'SUS' 판매중지) → is_active
--     content / contentAddDesc → 설명
--     category1Seq / goodsTypeDtlNm → 카테고리

CREATE TABLE IF NOT EXISTS gift_catalog (
  gift_code TEXT PRIMARY KEY,                  -- 'G00000280811'
  goods_no INTEGER,                             -- 21445 (참고용)
  name TEXT NOT NULL,                           -- '광동)비타500 100ml 병'
  brand_code TEXT,                              -- 'BR00046'
  brand_name TEXT,                              -- '세븐일레븐'
  brand_icon_url TEXT,

  -- 가격 (단위: KRW)
  sale_price INTEGER NOT NULL,                  -- 800 (정가)
  discount_price INTEGER NOT NULL,              -- 750 (할인가 — 셀러에게 보여줄 가격)
  real_price INTEGER NOT NULL,                  -- 800 (실제 차감 가격, B2B 마진 차감 전)
  discount_rate INTEGER NOT NULL DEFAULT 0,     -- 6 (%)

  -- 이미지
  image_url_small TEXT,                         -- 250x250
  image_url_large TEXT,                         -- 500x500
  desc_image_url TEXT,                          -- 상세 이미지

  -- 분류
  goods_type_name TEXT,                         -- '일반상품(물품교환형)'
  goods_type_detail TEXT,                       -- '편의점'
  category_seq INTEGER,                         -- 4
  affiliate_id TEXT,                            -- 'ELEVEN'
  affiliate_name TEXT,                          -- '세븐일레븐/바이더웨이'

  -- 유효기간
  valid_period_type TEXT,                       -- '01' (일수) / '02' (일자)
  valid_period_days INTEGER,                    -- 30 (limitday)
  valid_period_until TEXT,                      -- '20190814' (validPrdDay, 일자형)

  -- 상태
  goods_state TEXT NOT NULL DEFAULT 'SALE',     -- 'SALE' / 'SUS'
  is_active INTEGER NOT NULL DEFAULT 1,         -- 우리 측 노출 여부

  -- 검색
  search_keywords TEXT,                          -- '광동)비타500, 비타민, ...'

  -- 부가 정보
  content TEXT,
  content_add_desc TEXT,
  popular INTEGER NOT NULL DEFAULT 0,            -- 인기 순위 (1=가장 인기)

  -- 메타
  sync_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gift_catalog_brand ON gift_catalog(brand_code, goods_state);
CREATE INDEX IF NOT EXISTS idx_gift_catalog_state ON gift_catalog(goods_state, is_active, sale_price);
CREATE INDEX IF NOT EXISTS idx_gift_catalog_popular ON gift_catalog(is_active, popular);

-- 어드민 설정 — KT Alpha API 키 / 운영 모드.
-- 'platform_settings' 키-값 테이블 활용 (이미 존재).
INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES
  ('kt_alpha_api_enabled', '0', 'KT Alpha (기프티쇼) API 활성화 여부'),
  ('kt_alpha_dev_mode', '1', 'KT Alpha API dev_yn (1=테스트, 0=상용)'),
  ('kt_alpha_last_sync_at', '', 'KT Alpha catalog 마지막 sync 시각'),
  ('kt_alpha_last_sync_count', '0', 'KT Alpha 마지막 sync 시 상품 갯수');
-- 실제 API 키 (KT_ALPHA_AUTH_CODE, KT_ALPHA_AUTH_TOKEN) 는 Cloudflare secret 으로 저장.
