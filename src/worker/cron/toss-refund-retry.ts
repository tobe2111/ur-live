/**
 * 🛡️ 2026-05-21 Phase TD-3: 토스 환불 실패 자동 재시도 cron.
 *
 * 1시간 cron 으로 실행 (auto-settlement 와 다른 슬롯).
 *   - retry_count < 5 + resolved_at IS NULL + (마지막 시도 > 1시간) 조회
 *   - tossCancelPayment 재호출
 *   - 성공 시 resolved_at 마킹
 *   - 5회 실패 시 어드민 Discord 알림
 *
 * 영구성:
 *   - exponential backoff (1h, 2h, 4h, 8h, 16h)
 *   - Idempotency-Key 동일 — 토스 측 중복 환불 차단
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface Failure {
  id: number
  payment_key: string
  cancel_amount: number | null
  cancel_reason: string
  retry_count: number
  created_at: string
  last_retried_at: string | null
}

export async function handleTossRefundRetry(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    // exponential backoff — 마지막 시도 + 2^retry_count 시간 경과한 것만
    const rows = await DB.prepare(
      `SELECT id, payment_key, cancel_amount, cancel_reason, retry_count, created_at, last_retried_at
         FROM toss_refund_failures
        WHERE resolved_at IS NULL
          AND retry_count < 5
          AND (
            last_retried_at IS NULL OR
            datetime(last_retried_at, '+' || (1 << retry_count) || ' hours') < datetime('now')
          )
        ORDER BY created_at ASC
        LIMIT 20`,
    ).all<Failure>().catch(() => ({ results: [] as Failure[] }))

    const list = rows.results || []
    if (list.length === 0) return

    const { tossCancelPayment } = await import('../utils/toss-refund')
    let resolved = 0
    const dead: Failure[] = []
    for (const f of list) {
      try {
        const result = await tossCancelPayment(
          env as unknown as { TOSS_SECRET_KEY?: string },  // DB 인자 X — 재시도 자체로 중복 INSERT 방지
          f.payment_key,
          {
            reason: f.cancel_reason,
            amount: f.cancel_amount ?? undefined,
            idempotencyKey: `retry-${f.id}-${f.payment_key}`,
          },
        )
        if (result.ok) {
          await DB.prepare("UPDATE toss_refund_failures SET resolved_at = datetime('now'), retry_count = retry_count + 1 WHERE id = ?").bind(f.id).run()
          resolved++
        } else {
          const newCount = f.retry_count + 1
          await DB.prepare("UPDATE toss_refund_failures SET retry_count = ?, last_retried_at = datetime('now'), error_message = ? WHERE id = ?").bind(newCount, result.error_message || null, f.id).run()
          if (newCount >= 5) dead.push(f)
        }
      } catch (e) {
        logError('[toss-refund-retry] one failed', { id: f.id, error: (e as Error).message })
      }
    }
    if (resolved > 0) logInfo(`[toss-refund-retry] resolved ${resolved}/${list.length}`)

    // dead-letter — 5회 실패한 것들 어드민 알림 (Discord)
    if (dead.length > 0) {
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          const summary = dead.slice(0, 10).map(d => `#${d.id} ${d.payment_key} ${d.cancel_amount ?? 'full'}원`).join('\n')
          await sendDiscordAlert(
            webhook,
            `🚨 토스 환불 5회 실패 — 수동 처리 필요`,
            summary + '\n\n /admin/payouts → 어드민이 토스 콘솔에서 직접 환불',
            'error',
          )
        } catch { /* graceful */ }
      }
    }
  } catch (e) {
    logError('[toss-refund-retry] failed', { error: (e as Error).message })
  }
}
