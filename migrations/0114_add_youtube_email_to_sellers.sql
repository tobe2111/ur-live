-- Migration 0114: sellers 테이블에 youtube_email 컬럼 추가
-- 셀러 가입 시 유튜브 라이브에 사용할 구글 계정 이메일을 수집하기 위함

ALTER TABLE sellers ADD COLUMN youtube_email TEXT;

CREATE INDEX IF NOT EXISTS idx_sellers_youtube_email ON sellers(youtube_email);
