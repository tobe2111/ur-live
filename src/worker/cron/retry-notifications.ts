/**
 * 🛡️ 2026-05-12: 이메일 / 푸시 발송 실패 자동 재시도 cron.
 *
 * `email_failures` / `push_failures` dead-letter 테이블을 5분 주기로 drain.
 * 정산/주문/선물 등 핵심 알림이 transient 실패 (Resend 5xx, Push Service 5xx)
 * 시 silent fail 되는 사고 방지. alimtalk-retry 와 동일 backoff 패턴.
 *
 * Schedule: 5분마다 (scheduled.ts 의 *\/5 * * * * tick 에서 호출).
 */

import type { Env } from '../types/env'
import { logInfo } from '../utils/logger'
import { reportCronFailure } from '../utils/cron-reporter'

interface EmailFailureRow {
  id: number
  recipient: string
  subject: string
  html: string
  retry_count: number
  max_retries: number
}

interface PushFailureRow {
  id: number
  user_type: 'user' | 'seller' | 'admin'
  user_id: number
  title: string
  body: string
  url: string | null
  retry_count: number
  max_retries: number
}

/**
 * email_failures dead-letter drainer.
 * 재시도 가능한 항목 (resolved=0, retry_count<max, next_retry_at 경과) 50개씩 처리.
 */
export async function retryEmailFailures(env: Env) {
  if (!env.DB) return
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, recipient, subject, html, retry_count, max_retries
      FROM email_failures
      WHERE resolved = 0
        AND retry_count < max_retries
        AND next_retry_at <= datetime('now')
      ORDER BY id ASC LIMIT 50
    `).all<EmailFailureRow>().catch(() => ({ results: [] as EmailFailureRow[] }))

    if (!results || results.length === 0) return

    let retried = 0
    let succeeded = 0
    for (const row of results) {
      retried++
      try {
        const { sendSystemEmail } = await import('../../lib/system-email')
        // sendSystemEmail 가 다시 실패 시 INSERT 가 발생하지 않도록 DB 우회는 어렵지만,
        // 동일 row 가 다시 INSERT 되어도 retry_count 가 격리되어 중복 처리 영향 미미.
        const result = await sendSystemEmail(env, row.recipient, {
          subject: row.subject,
          html: row.html,
        })
        if (result.success) {
          succeeded++
          await env.DB.prepare(`
            UPDATE email_failures
            SET resolved = 1, retry_count = retry_count + 1, updated_at = datetime('now')
            WHERE id = ?
          `).bind(row.id).run()
        } else if (result.skipped) {
          // 환경변수 미설정 — 재시도 무의미, resolved 처리하지 않고 backoff 만 늘림
          await env.DB.prepare(`
            UPDATE email_failures
            SET retry_count = retry_count + 1,
                next_retry_at = datetime('now', '+30 minutes'),
                error = 'skipped: env not configured',
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(row.id).run()
        } else {
          // exponential backoff (5 → 30 → 180 분)
          const nextDelayMin = Math.pow(6, row.retry_count + 1) * 5
          await env.DB.prepare(`
            UPDATE email_failures
            SET retry_count = retry_count + 1,
                next_retry_at = datetime('now', '+' || ? || ' minutes'),
                error = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(nextDelayMin, (result.error || 'retry failed').slice(0, 500), row.id).run()
        }
      } catch (sendErr) {
        await env.DB.prepare(`
          UPDATE email_failures
          SET retry_count = retry_count + 1,
              error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind((sendErr as Error).message?.slice(0, 500) || 'exception', row.id).run().catch(() => {})
      }
    }

    if (env.ENVIRONMENT !== 'production' || retried > 0) {
      logInfo(`[cron:retry-email] retried=${retried} succeeded=${succeeded}`)
    }
  } catch (err) {
    await reportCronFailure(env, 'retry-email-failures', err, undefined, 'warning')
  }
}

/**
 * push_failures dead-letter drainer.
 */
export async function retryPushFailures(env: Env) {
  if (!env.DB) return
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, user_type, user_id, title, body, url, retry_count, max_retries
      FROM push_failures
      WHERE resolved = 0
        AND retry_count < max_retries
        AND next_retry_at <= datetime('now')
      ORDER BY id ASC LIMIT 50
    `).all<PushFailureRow>().catch(() => ({ results: [] as PushFailureRow[] }))

    if (!results || results.length === 0) return

    let retried = 0
    let succeeded = 0
    for (const row of results) {
      retried++
      try {
        const { sendSystemPush } = await import('../../lib/system-push')
        const result = await sendSystemPush(env, row.user_type, row.user_id, {
          title: row.title,
          body: row.body,
          url: row.url || undefined,
        })
        if (result.success) {
          succeeded++
          await env.DB.prepare(`
            UPDATE push_failures
            SET resolved = 1, retry_count = retry_count + 1
            WHERE id = ?
          `).bind(row.id).run()
        } else if (result.skipped) {
          // 구독 0 또는 VAPID 미설정 — resolved 처리 (재시도 무의미)
          await env.DB.prepare(`
            UPDATE push_failures
            SET resolved = 1, retry_count = retry_count + 1
            WHERE id = ?
          `).bind(row.id).run()
        } else {
          const nextDelayMin = Math.pow(6, row.retry_count + 1) * 5
          await env.DB.prepare(`
            UPDATE push_failures
            SET retry_count = retry_count + 1,
                next_retry_at = datetime('now', '+' || ? || ' minutes')
            WHERE id = ?
          `).bind(nextDelayMin, row.id).run()
        }
      } catch (sendErr) {
        await env.DB.prepare(`
          UPDATE push_failures
          SET retry_count = retry_count + 1
          WHERE id = ?
        `).bind(row.id).run().catch(() => {})
        void sendErr
      }
    }

    if (env.ENVIRONMENT !== 'production' || retried > 0) {
      logInfo(`[cron:retry-push] retried=${retried} succeeded=${succeeded}`)
    }
  } catch (err) {
    await reportCronFailure(env, 'retry-push-failures', err, undefined, 'warning')
  }
}
