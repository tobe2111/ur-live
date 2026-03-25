-- Migration 0116: Composite index for chat polling optimization
-- SSE polling query: WHERE live_stream_id = ? AND id > ?
-- Existing index (live_stream_id, created_at DESC) does not cover id-based cursor pagination
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id_seq ON chat_messages(live_stream_id, id ASC);
