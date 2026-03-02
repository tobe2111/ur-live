-- Migration: Add seller special permissions for stats manipulation
-- Date: 2026-03-02
-- Purpose: Allow approved sellers to manipulate viewer count and send fake cart notifications

-- Add permission column to sellers table
ALTER TABLE sellers ADD COLUMN can_manipulate_stats BOOLEAN DEFAULT 0;

-- Add manual viewer count to live_streams table
ALTER TABLE live_streams ADD COLUMN manual_viewer_count INTEGER DEFAULT NULL;

-- Add comment for clarity
-- can_manipulate_stats: 1 = 셀러가 시청자 수 조작 및 가짜 알림 전송 가능 (어드민 승인 필요)
-- manual_viewer_count: NULL = 실제 시청자 수 사용, 숫자 = 셀러가 설정한 값 표시
