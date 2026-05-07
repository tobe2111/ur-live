/**
 * 🛡️ 2026-05-07: Cron job 실패 통합 리포터.
 *
 * 기존: 모든 cron 이 console.error 만 출력 → silent failure 가능 (admin 모름).
 * 처리:
 *   1. console.error (기존 동작 유지)
 *   2. cron_failures 테이블 INSERT (영구 기록)
 *   3. admin_dashboard_notifications INSERT (admin 대시보드 알림)
 *   4. Critical 이면 admin 알림톡 (TODO — 향후)
 *
 * 사용:
 *   import { reportCronFailure } from './utils/cron-reporter'
 *   try { ... } catch (err) {
 *     await reportCronFailure(env, 'auto-settlement', err)
 *   }
 */

interface CronEnv {
  DB?: D1Database
}

let _cronTableEnsured = false
async function ensureCronFailuresTable(DB: D1Database) {
  if (_cronTableEnsured) return
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS cron_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_name TEXT NOT NULL,
        error_message TEXT NOT NULL,
        stack TEXT,
        context TEXT,
        severity TEXT DEFAULT 'error',
        resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_cron_failures_unresolved
      ON cron_failures(resolved, created_at DESC) WHERE resolved = 0
    `).run()
    _cronTableEnsured = true
  } catch { /* table 생성 실패해도 console.error 는 유지 */ }
}

export async function reportCronFailure(
  env: CronEnv,
  jobName: string,
  error: unknown,
  context?: Record<string, unknown>,
  severity: 'warning' | 'error' | 'critical' = 'error'
): Promise<void> {
  const errMsg = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  // 1. console (즉시 가시성)
  console.error(`[cron:${jobName}] FAILED [${severity}]:`, errMsg, context ?? '')

  if (!env.DB) return

  try {
    await ensureCronFailuresTable(env.DB)

    // 2. 영구 기록
    await env.DB.prepare(`
      INSERT INTO cron_failures (job_name, error_message, stack, context, severity)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      jobName,
      errMsg.slice(0, 1000),  // 메시지 cap
      stack?.slice(0, 4000) ?? null,
      context ? JSON.stringify(context).slice(0, 2000) : null,
      severity
    ).run()

    // 3. admin 대시보드 알림 (critical / error 만 — warning 은 노이즈)
    if (severity !== 'warning') {
      try {
        await env.DB.prepare(`
          INSERT INTO admin_dashboard_notifications (type, title, body, link, severity, created_at)
          VALUES ('cron_failure', ?, ?, '/admin/cron-failures', ?, datetime('now'))
        `).bind(
          `Cron 실패: ${jobName}`,
          errMsg.slice(0, 200),
          severity
        ).run()
      } catch { /* notifications 테이블 없으면 silent */ }
    }
  } catch (innerErr) {
    // 리포팅 자체가 실패해도 원본 에러는 이미 console.error 됨
    console.error(`[cron-reporter] failed to report cron failure:`, innerErr)
  }
}
