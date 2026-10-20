/**
 * 🗂️ 어드민 전용 테이블 복구 정의 (repair-schema.routes.ts 에서 추출 — 2026-08-22)
 *
 * ⚠️ 이 레포는 **마이그레이션 CI 가 동작하지 않는다**(TECHNICAL_DEBT — D1 권한 없음).
 *    그래서 마이그레이션 파일에만 있는 테이블은 prod 에 없을 수 있고, 그걸 쓰는 코드는
 *    try-catch 안에서 **조용히 실패**한다(감사로그가 그렇게 유실됐다). repair-schema 에
 *    등록해야 실제로 존재한다.
 */

import { ADMIN_PREFS_TABLE_SQL } from '@/worker/utils/admin-prefs';

export const ADMIN_REPAIRS: Array<{ name: string; sql: string }> = [
  // 🛡️ 2026-06-16 어드민 활동 감사로그 — writeAuditLog/adminAuditMiddleware 가 기록(모든 어드민 변경 자동).
  //   ⚠️ 마이그레이션(0126/0128)에만 있어 prod(마이그 미실행)엔 테이블이 없을 수 있음 → writeAuditLog 가
  //   조용히 실패(try-catch)해 로그 유실. repair-schema 에 보장해야 실제로 기록됨.
  { name: 'admin_audit_logs', sql: `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT NOT NULL,
    admin_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    before_value TEXT,
    after_value TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )` },
  // ⭐ 2026-08-22 어드민 개인 설정(즐겨찾기) — DDL 은 `utils/admin-prefs.ts` SSOT(두 벌이면 갈린다).
  { name: 'admin_prefs', sql: ADMIN_PREFS_TABLE_SQL },
  { name: 'admin_login_history', sql: `CREATE TABLE IF NOT EXISTS admin_login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT NOT NULL,
    email TEXT,
    ip TEXT,
    user_agent TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )` },
  { name: 'idx_admin_login_history_created', sql: `CREATE INDEX IF NOT EXISTS idx_admin_login_history_created ON admin_login_history(created_at DESC)` },
  { name: 'idx_admin_audit_admin_id', sql: `CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_logs(admin_id, created_at)` },
  { name: 'idx_admin_audit_action', sql: `CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action, created_at)` },
  { name: 'idx_admin_audit_created', sql: `CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC)` },
]
