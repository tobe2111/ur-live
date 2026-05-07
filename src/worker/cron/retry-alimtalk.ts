/**
 * 🛡️ 2026-05-07: 알림톡 발송 실패 자동 재시도 cron.
 *
 * 5분 주기로 alimtalk_failures 테이블에서 미해결 항목 재시도 (max 3회).
 * 정산/주문/선물 등 critical 알림이 silent fail 되어 사용자에게 안 가는 사고 방지.
 *
 * Schedule: 5분마다 (Star/5 Star Star Star Star)
 */
import type { Env } from '../types/env'
import { reportCronFailure } from '../utils/cron-reporter'

interface FailureRow {
  id: number
  phone: string
  template_code: string
  message: string
  retry_count: number
  max_retries: number
}

export async function handleRetryAlimtalk(env: Env) {
  if (!env.DB) return
  try {
    // 재시도 가능한 실패만 (next_retry_at 이미 지났고 max 미달)
    const { results } = await env.DB.prepare(`
      SELECT id, phone, template_code, message, retry_count, max_retries
      FROM alimtalk_failures
      WHERE resolved = 0
        AND retry_count < max_retries
        AND next_retry_at <= datetime('now')
      ORDER BY id ASC LIMIT 50
    `).all<FailureRow>().catch(() => ({ results: [] as FailureRow[] }))

    if (!results || results.length === 0) return

    let retried = 0
    let succeeded = 0
    for (const row of results) {
      retried++
      try {
        const { sendAlimtalk } = await import('../../lib/aligo')
        const e = env as unknown as Record<string, string | undefined>
        const result = await sendAlimtalk(
          { ALIGO_API_KEY: e.ALIGO_API_KEY!, ALIGO_USER_ID: e.ALIGO_USER_ID! },
          {
            senderKey: e.ALIGO_SENDER_KEY!,
            templateCode: row.template_code,
            to: row.phone,
            message: row.message,
          }
        )
        if (result.success) {
          succeeded++
          await env.DB.prepare(`
            UPDATE alimtalk_failures
            SET resolved = 1, retry_count = retry_count + 1, updated_at = datetime('now')
            WHERE id = ?
          `).bind(row.id).run()
        } else {
          // 재시도 실패 — 다음 시도 시간 exponential backoff (5분 → 30분 → 2시간)
          const nextDelayMin = Math.pow(6, row.retry_count + 1) * 5 // 30/180/1080
          await env.DB.prepare(`
            UPDATE alimtalk_failures
            SET retry_count = retry_count + 1,
                next_retry_at = datetime('now', '+' || ? || ' minutes'),
                error = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(nextDelayMin, result.error?.slice(0, 500) || 'retry failed', row.id).run()
        }
      } catch (sendErr) {
        await env.DB.prepare(`
          UPDATE alimtalk_failures
          SET retry_count = retry_count + 1,
              error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind((sendErr as Error).message?.slice(0, 500) || 'exception', row.id).run().catch(() => {})
      }
    }

    if (env.ENVIRONMENT !== 'production' || retried > 0) {
      console.log(`[cron:retry-alimtalk] retried=${retried} succeeded=${succeeded}`)
    }
  } catch (err) {
    await reportCronFailure(env, 'retry-alimtalk', err, undefined, 'warning')
  }
}
