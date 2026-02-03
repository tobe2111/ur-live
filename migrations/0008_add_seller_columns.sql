-- orders 테이블에 셀러 관련 컬럼 추가
ALTER TABLE orders ADD COLUMN seller_id INTEGER;
ALTER TABLE orders ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 10.00;
ALTER TABLE orders ADD COLUMN commission_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN seller_amount INTEGER DEFAULT 0;

-- sellers 테이블에 프로필 컬럼 추가 (없으면 무시)
ALTER TABLE sellers ADD COLUMN display_name TEXT;
ALTER TABLE sellers ADD COLUMN profile_image TEXT;
ALTER TABLE sellers ADD COLUMN bio TEXT;
ALTER TABLE sellers ADD COLUMN instagram_url TEXT;
ALTER TABLE sellers ADD COLUMN youtube_url TEXT;

-- live_streams 테이블에 seller_id 추가 (없으면 무시)
ALTER TABLE live_streams ADD COLUMN seller_id INTEGER;
ALTER TABLE live_streams ADD COLUMN scheduled_at DATETIME;

-- users 테이블에 카카오 로그인 컬럼 추가 (없으면 무시)
ALTER TABLE users ADD COLUMN kakao_id TEXT;
ALTER TABLE users ADD COLUMN profile_image TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;

-- 배송지 테이블 생성
CREATE TABLE IF NOT EXISTS shipping_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  postal_code TEXT,
  address TEXT NOT NULL,
  address_detail TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- orders 테이블에 배송지 정보 추가
ALTER TABLE orders ADD COLUMN shipping_address_id INTEGER;
ALTER TABLE orders ADD COLUMN shipping_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_address TEXT;
ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT;
