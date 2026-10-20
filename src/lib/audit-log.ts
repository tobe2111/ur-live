/**
 * Admin audit log — 정산·환불·수수료 등 금전 관련 어드민 액션 기록.
 *
 * 테이블: admin_audit_log (repair-new-tables 엔드포인트로 생성).
 * best-effort: DB write 실패 시 에러를 삼키고 본 로직을 차단하지 않음.
 */

export type AuditAction =
  | 'settlement_approve'    // 개별 정산 승인
  | 'settlement_batch'      // 일괄 정산 완료
  | 'settlement_status'     // 정산 상태 변경 (→pending 되돌리기 등)
  | 'settlement_execute'    // 정산 실행 (자동 이체)
  | 'order_refund'          // 주문 환불
  | 'order_cancel'          // 주문 취소
  | 'order_status'          // 주문 상태 변경
  | 'commission_change'     // 수수료율 변경
  | 'admin_action'          // 기타 어드민 액션

export interface AuditEntry {
  actor_id: string
  actor_email?: string
  action: AuditAction
  resource_type: string   // 'order' | 'settlement' | 'seller' | ...
  resource_id: string
  old_value?: string      // JSON
  new_value?: string      // JSON
  ip?: string
}

export async function logAudit(DB: D1Database, entry: AuditEntry): Promise<void> {
  try {
    await DB.prepare(
      `INSERT INTO admin_audit_log
         (actor_id, actor_email, action, resource_type, resource_id, old_value, new_value, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      entry.actor_id,
      entry.actor_email ?? null,
      entry.action,
      entry.resource_type,
      entry.resource_id,
      entry.old_value ?? null,
      entry.new_value ?? null,
      entry.ip ?? null,
    ).run()
  } catch {
    // non-fatal — 로그 실패가 본 작업을 차단하면 안 됨
  }
}
