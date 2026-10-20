-- 라이브 스트리밍 시청자 수 추가
ALTER TABLE live_streams ADD COLUMN current_viewers INTEGER DEFAULT 0;
ALTER TABLE live_streams ADD COLUMN peak_viewers INTEGER DEFAULT 0;
