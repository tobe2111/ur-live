-- 2026-05-05: 무재고 디지털/정보 상품 판매 지원 (Phase 1)
-- 운동 프로그램, 뷰티 노하우, 전자책, 강의 등
--
-- 기존 product_type 은 'live'/'featured' (라이브 노출 여부) — 그대로 유지.
-- 신규 product_kind 가 상품의 본질 (실물 vs 디지털) 을 나타냄.

-- ═══════════════════════════════════════════════════════════════
-- 1) products 테이블 확장
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE products ADD COLUMN product_kind TEXT DEFAULT 'physical';
-- 'physical' (실물, 기본) | 'digital' (전자책/이미지/PDF) | 'video_course' (영상 강의) |
-- 'live_class' (실시간 강의 입장권) | 'pdf_guide' (가이드/노하우 문서)

ALTER TABLE products ADD COLUMN delivery_type TEXT DEFAULT 'shipping';
-- 'shipping' (배송, 기본) | 'instant_url' (구매 즉시 URL 노출) |
-- 'email' (이메일 발송) | 'unlock' (마이페이지 잠금해제)

ALTER TABLE products ADD COLUMN content_url TEXT;
-- R2 또는 외부 CDN URL (셀러가 업로드한 원본). signed URL 생성 시 base 로 사용.

ALTER TABLE products ADD COLUMN content_format TEXT;
-- 'pdf' | 'video' | 'zip' | 'epub' | 'html' | 'audio' | 'image'

ALTER TABLE products ADD COLUMN access_duration_days INTEGER;
-- NULL = 영구 접근 (전자책/PDF), 30/90/180 = 일정 기간 (강의/구독형)

ALTER TABLE products ADD COLUMN preview_url TEXT;
-- 무료 미리보기 (강의 첫 강 / 전자책 샘플 PDF / 이미지 워터마크)

ALTER TABLE products ADD COLUMN file_size_mb INTEGER;
-- 다운로드 안내용 (UX — "12MB" 표시)

CREATE INDEX IF NOT EXISTS idx_products_kind_active
  ON products(product_kind, is_active, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2) orders 확장 — digital 주문은 shipping 정보 nullable
-- (기존 컬럼 유지, 코드 단에서 product_kind='physical' 일 때만 검증)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE orders ADD COLUMN delivery_kind TEXT DEFAULT 'shipping';
-- 'shipping' (실물 배송) | 'digital' (즉시 발급) | 'mixed' (실물+디지털 혼합)

-- ═══════════════════════════════════════════════════════════════
-- 3) digital_product_access — 구매자별 접근권 + 다운로드 추적
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS digital_product_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  order_item_id INTEGER,                 -- 주문 항목 추적 (환불 시 access revoke)
  access_token TEXT UNIQUE NOT NULL,     -- crypto.randomUUID() — signed URL 발급 base
  expires_at DATETIME,                   -- access_duration_days 기반 (NULL = 영구)
  download_count INTEGER DEFAULT 0,
  download_limit INTEGER DEFAULT 100,    -- 어뷰징 방지 (셀러가 설정 가능, default 100)
  last_accessed DATETIME,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id, order_id)  -- 같은 주문에서 같은 상품 1번만
);
CREATE INDEX IF NOT EXISTS idx_dpa_user
  ON digital_product_access(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dpa_product
  ON digital_product_access(product_id);
CREATE INDEX IF NOT EXISTS idx_dpa_order
  ON digital_product_access(order_id);
CREATE INDEX IF NOT EXISTS idx_dpa_token
  ON digital_product_access(access_token);

-- ═══════════════════════════════════════════════════════════════
-- 4) digital_download_logs — 감사/분석용 (어뷰징 탐지)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS digital_download_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  bytes_served INTEGER,
  status TEXT,                           -- 'success' | 'denied_limit' | 'denied_expired' | 'denied_revoked'
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ddl_access
  ON digital_download_logs(access_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ddl_user_ip
  ON digital_download_logs(user_id, ip, created_at DESC);
