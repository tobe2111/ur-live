/**
 * 🗑️ 2026-11-18 쌓이기만 하던 기록 표의 보관 기간 SSOT — 대표 *"1,2 모두 이상적으로 해줘"*
 *   (결재 `docs/decisions/2026-11-18-log-retention-and-ads-backup-drill.md` 1번).
 *
 * 기간은 "그 표를 **다시 읽는 코드가 보는 가장 먼 과거**" 보다 넉넉하게 잡았다(근거는 각 줄).
 * 매일 04:20 KST 청소(`scheduled-cleanup-daily.ts`)가 돌고, 한 표에서 한 번에 최대 5,000행만 지운다
 * (한 번에 많이 지우면 그 시간에 DB 쓰기가 몰린다 — 다음 날 이어서 지운다).
 *
 * 🚫 **일부러 넣지 않은 표**(지우면 안 된다 — `RETENTION_EXCLUDED`):
 *   - `dashboard_sessions` — 계정마다 1행, **강제 로그아웃 경계**(min_valid_iat)를 담는다. 행이 없으면
 *     "옛 로그인 = 유효" 로 판정된다(`dashboard-session.ts` grandfather) → 지우면 끊었던 토큰이 되살아난다.
 *   - `audit_logs` · `admin_audit_logs` · `admin_audit_log` · `ledger_integrity_log` · `moderation_log` — 회계·분쟁·감사 증빙.
 *   - `digital_download_logs` — 디지털 상품을 실제로 받았다는 증빙(분쟁 시).
 *   - `shipping_tracking_events` · `supply_price_history` — 주문·가격의 이력 그 자체.
 */
export interface RetentionRule {
  table: string
  /** 비교할 날짜 칸. `kind: 'date'` 면 'YYYY-MM-DD' 문자열 비교(`date('now', …)`), 아니면 datetime. */
  column: string
  days: number
  kind?: 'datetime' | 'date'
  why: string
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  { table: 'search_logs', column: 'created_at', days: 90, why: '인기 검색어가 최근 7일만 본다(ProductRepository.getPopularSearches)' },
  { table: 'referral_clicks', column: 'created_at', days: 120, why: '사장님 클릭 통계가 최대 90일·중복 판정 5분(ledger.routes)' },
  { table: 'alimtalk_dispatch_log', column: 'sent_at', days: 90, why: '중복 발송 판정이 1시간(system-alimtalk)' },
  { table: 'ad_autobid_log', column: 'created_at', days: 90, why: '화면이 최근 100건만 보여 준다(autobid)' },
  { table: 'ad_rank_snapshots', column: 'snap_date', days: 180, kind: 'date', why: '순위 경보가 직전 스냅샷 1개만 본다(alerts)' },
  { table: 'ad_daily_metrics', column: 'snap_date', days: 400, kind: 'date', why: '성과 차트가 최대 120일 — 1년 전과 비교할 여유' },
  { table: 'alimtalk_logs', column: 'created_at', days: 365, why: '사장님 발송 내역은 최근 목록 · 받는 사람 전화번호를 오래 들고 있지 않는다' },
  { table: 'bulk_email_log', column: 'created_at', days: 365, why: '어드민이 최근 50건만 본다' },
  { table: 'admin_login_history', column: 'created_at', days: 365, why: '접속 이력 화면 · 1년이면 이상 징후 추적에 충분' },
]

export const RETENTION_EXCLUDED: readonly string[] = [
  'dashboard_sessions', 'audit_logs', 'admin_audit_logs', 'admin_audit_log', 'ledger_integrity_log',
  'moderation_log', 'digital_download_logs', 'shipping_tracking_events', 'supply_price_history',
]

export const RETENTION_BATCH = 5000

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/

/** 표마다 오래된 행을 최대 RETENTION_BATCH 개 지운다. 표가 없으면(그 환경에 아직 없음) 조용히 건너뛴다. */
export async function purgeOldLogs(DB: D1Database, results: Record<string, number>): Promise<void> {
  for (const r of RETENTION_RULES) {
    if (!SAFE_IDENT.test(r.table) || !SAFE_IDENT.test(r.column) || RETENTION_EXCLUDED.includes(r.table)) continue
    const cutoff = r.kind === 'date' ? `date('now', '-${Math.trunc(r.days)} days')` : `datetime('now', '-${Math.trunc(r.days)} days')`
    try {
      const res = await DB.prepare(
        `DELETE FROM ${r.table} WHERE rowid IN (SELECT rowid FROM ${r.table} WHERE ${r.column} < ${cutoff} LIMIT ${RETENTION_BATCH})`,
      ).run()
      const n = Number(res.meta?.changes ?? 0)
      if (n > 0) results[`retention_${r.table}`] = n
    } catch { /* 표·칸 없음 — 이 환경엔 아직 안 생긴 표 */ }
  }
}
