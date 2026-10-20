-- Migration 0026: Add TikTok Live Support
-- TikTok 라이브 스트리밍 지원 추가

-- live_streams 테이블에 platform 컬럼 추가
ALTER TABLE live_streams ADD COLUMN platform TEXT DEFAULT 'youtube' CHECK(platform IN ('youtube', 'tiktok'));

-- live_streams 테이블에 tiktok_username 컬럼 추가
ALTER TABLE live_streams ADD COLUMN tiktok_username TEXT;

-- 기존 데이터 업데이트 (모든 기존 라이브는 YouTube)
UPDATE live_streams SET platform = 'youtube' WHERE platform IS NULL;
