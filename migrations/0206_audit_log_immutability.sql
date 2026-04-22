-- ============================================================
-- Migration 0206: admin_audit_logs immutability (append-only)
-- 🛡️ 2026-04-22: 감사 로그 변조/삭제 방지 — 악의적 어드민이 자기 흔적 지우기 차단.
-- SQLite 트리거로 UPDATE/DELETE 를 RAISE ABORT 시킴.
-- cleanup(예: 5년 경과 로그 archive) 는 관리자가 직접 트리거를 DROP 하고 수행.
-- ============================================================

-- UPDATE 차단
CREATE TRIGGER IF NOT EXISTS admin_audit_logs_no_update
BEFORE UPDATE ON admin_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'admin_audit_logs is append-only');
END;

-- DELETE 차단
CREATE TRIGGER IF NOT EXISTS admin_audit_logs_no_delete
BEFORE DELETE ON admin_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'admin_audit_logs is append-only');
END;
