-- Add seller profile fields for public page
-- 셀러 공개 페이지를 위한 프로필 필드 추가

-- Check if columns already exist before adding
-- profile_image and bio might already exist from earlier migrations

ALTER TABLE sellers ADD COLUMN sns_instagram TEXT;
ALTER TABLE sellers ADD COLUMN sns_youtube TEXT;
ALTER TABLE sellers ADD COLUMN sns_facebook TEXT;
ALTER TABLE sellers ADD COLUMN sns_twitter TEXT;
ALTER TABLE sellers ADD COLUMN website_url TEXT;
