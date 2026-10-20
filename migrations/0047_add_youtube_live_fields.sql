-- Add YouTube Live API integration fields to live_streams table
-- Migration: 0047_add_youtube_live_fields.sql

-- YouTube Broadcast ID (자동 생성된 라이브 방송 ID)
ALTER TABLE live_streams ADD COLUMN youtube_broadcast_id TEXT;

-- YouTube Stream Key (RTMP 스트리밍 키)
ALTER TABLE live_streams ADD COLUMN youtube_stream_key TEXT;

-- YouTube Live Chat ID (채팅 메시지 조회용)
ALTER TABLE live_streams ADD COLUMN youtube_live_chat_id TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_live_streams_youtube_broadcast_id ON live_streams(youtube_broadcast_id);
