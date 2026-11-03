/**
 * 💸 토스 지급대행 웹훅 — `payout.changed` · `seller.changed` (2026-11-03, 게이트 기본 OFF)
 *
 * Endpoint: POST /api/webhooks/toss-payouts  (토스 개발자센터 웹훅에 이 URL 을 등록한다)
 *
 * 🔒 **본문을 믿지 않는다.** 웹훅은 "무언가 바뀌었다" 는 신호로만 쓰고, 지급 상태는 토스 API 로
 * 다시 묻는다(`syncTossPayout` → `GET /v2/payouts/{id}`). 그래서 누가 가짜 본문을 보내도 장부가
 * 'sent' 가 되지 않는다 — 우리가 요청한 지급(`toss_payout_requests`)이 아니면 무시하고, 토스가
 * COMPLETED 라고 답할 때만 `markPayoutSent`(가드 셋 + CAS)가 돈다.
 * 게이트가 꺼져 있으면 200 만 돌려주고 아무것도 안 한다(토스 재전송 폭주 방지).
 *
 * 로직 SSOT `worker/utils/toss-payouts.ts` · 결재 `docs/decisions/2026-11-03-settlement-structure.md`
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { syncTossPayout, tossPayoutsReady } from '@/worker/utils/toss-payouts'

export const tossPayoutWebhookRoutes = new Hono<{ Bindings: Env }>()

interface PayoutWebhookBody {
  eventType?: string
  data?: { id?: string; entityBody?: { id?: string } }
  entityBody?: { id?: string }
}

tossPayoutWebhookRoutes.post('/', async (c) => {
  try {
    const ready = await tossPayoutsReady(c.env.DB, c.env)
    if (!ready.ok) return c.json({ ok: true, ignored: 'disabled' })
    const body = await c.req.json<PayoutWebhookBody>().catch(() => ({} as PayoutWebhookBody))
    if (body.eventType !== 'payout.changed') return c.json({ ok: true, ignored: body.eventType ?? 'unknown' })
    const id = String(body.data?.entityBody?.id || body.data?.id || body.entityBody?.id || '').slice(0, 64)
    if (!id) return c.json({ ok: true, ignored: 'no_id' })
    const r = await syncTossPayout(c.env.DB, c.env, id)
    return c.json({ ok: true, status: r.status ?? null })
  } catch (err) {
    console.error('[toss-payout-webhook]', err)
    // 500 이면 토스가 재전송한다 — 일시 오류는 그게 맞다.
    return c.json({ ok: false }, 500)
  }
})
