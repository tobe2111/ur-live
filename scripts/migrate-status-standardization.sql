-- 🛡️ 2026-05-07: 셀러 status 표준화 마이그레이션 (선택 실행)
--
-- 배경:
--   현재 코드베이스에 sellers.status 가 'approved' / 'active' 혼용.
--   - admin-sellers.routes.ts: 'approved' 사용 (승인 시)
--   - admin-tools.routes.ts:   'approved' 사용
--   - 일부 신규 코드:           'active' 사용
--
-- 임시 대응 (이미 적용됨):
--   모든 SELECT 쿼리에 status IN ('approved', 'active') 적용 → 양쪽 모두 활성으로 인식.
--
-- 영구 통일 (이 SQL):
--   기존 'active' → 'approved' 통일 (admin 측 default 라 호환 영향 최소).
--   실행 전 백업 필수: ./scripts/backup-d1.sh
--
-- 실행:
--   npx wrangler@3 d1 execute ur-live-db --remote --file=./scripts/migrate-status-standardization.sql

BEGIN TRANSACTION;

-- 1. 변경 전 카운트 확인 (visual)
SELECT 'Before: status counts' AS marker, status, COUNT(*) AS cnt FROM sellers GROUP BY status;

-- 2. 모든 'active' → 'approved' 통일
UPDATE sellers SET status = 'approved' WHERE status = 'active';

-- 3. seller_status_history 에 마이그레이션 기록
INSERT INTO seller_status_history (seller_id, prev_status, new_status, reason)
SELECT id, 'active', 'approved', 'migrate-status-standardization.sql 자동 통일'
FROM sellers
WHERE updated_at >= datetime('now', '-1 minute');

-- 4. 변경 후 카운트
SELECT 'After: status counts' AS marker, status, COUNT(*) AS cnt FROM sellers GROUP BY status;

COMMIT;

-- 5. (선택) 동일 패턴으로 agencies 도 통일
-- UPDATE agencies SET status = 'approved' WHERE status = 'active';

-- 6. (선택) 검증
-- SELECT 'sellers' AS tbl, status, COUNT(*) FROM sellers GROUP BY status
-- UNION ALL
-- SELECT 'agencies' AS tbl, status, COUNT(*) FROM agencies GROUP BY status;
