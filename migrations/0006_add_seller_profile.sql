-- 셀러 프로필 정보 추가 (프로덕션에는 이미 존재)
-- ALTER TABLE sellers ADD COLUMN display_name TEXT;
-- ALTER TABLE sellers ADD COLUMN profile_image TEXT;
-- ALTER TABLE sellers ADD COLUMN bio TEXT;
-- ALTER TABLE sellers ADD COLUMN instagram_url TEXT;
-- ALTER TABLE sellers ADD COLUMN youtube_url TEXT;

-- live_streams에 seller_id 추가 (프로덕션에는 이미 존재)
-- ALTER TABLE live_streams ADD COLUMN seller_id INTEGER;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_sellers_username ON sellers(username);
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_id ON live_streams(seller_id);
