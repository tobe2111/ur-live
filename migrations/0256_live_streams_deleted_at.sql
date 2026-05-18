-- 🛡️ 2026-05-18: live_streams.deleted_at 컬럼 정식 등록.
--   배경: 어드민 라이브 모니터링 → "최근 종료된 방송 삭제" 클릭 시 row 가 안 사라짐.
--   원인: DELETE handler 가 deleted_at 컬럼만 마킹 (status 는 'ended' 유지 — CHECK 제약 회피),
--         하지만 /live-monitor/history 와 /api/home/bundle 의 SELECT 가 deleted_at 필터 안 함
--         → soft-delete 된 row 가 어드민 + 메인 페이지 다시보기에 그대로 노출.
--   조치: 컬럼을 production schema 에 정식 추가 + 모든 user-facing SELECT 에 deleted_at IS NULL 추가
--         (별도 PR 의 라우트 패치와 함께).
--   참고: DELETE handler 의 defensive `ALTER TABLE ... ADD COLUMN deleted_at` 는 그대로 유지 — 동일 컬럼
--         재추가 시도 시 에러 캐치되므로 idempotent.

ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME;

-- 인덱스: deleted_at IS NULL 필터가 status/ended_at 정렬과 함께 자주 호출됨.
CREATE INDEX IF NOT EXISTS idx_live_streams_active_status
  ON live_streams (status, deleted_at, ended_at DESC);
