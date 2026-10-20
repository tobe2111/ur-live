/**
 * 💸 **매장 요율(중개사 몫 · 인플루언서 상한) + 사장님 승계 코드** — 2026-09-19 대표 확정 플로우 1·3번
 *
 * `seller-stores.routes.ts` 에 `registerBrokerTermsRoutes(app, resolveActorUserId)` 로 얹는다
 * (파일 크기 룰 — 형제 `seller-store-claims.routes.ts` 와 같은 방식).
 *
 * ## 흐름
 *   ① 등록 요청 → `prepareBrokerTerms(body)` — 중개 매장이면 두 요율을 **행이 생기기 전에** 검증(반쪽 등록 방지)
 *   ② 권한 연결 뒤 → `finalizeBrokeredStore()` — 요율 저장(`seller_meta`) + **사장님 승계 코드** 발급.
 *      대행사가 그 코드를 사장님께 주고, 사장님이 `/store/find?code=` 에서 넣으면 소유권 신청이 된다.
 *   ③ `GET/POST /stores/:id/broker-terms` — 읽기는 운영 가능한 사람 누구나, 쓰기는 **주인**.
 *      주인이 아직 없는 중개 매장(승계 전)은 등록한 중개사가 고칠 수 있다 — 그때는 이 값이 곧 등록 조건이고,
 *      사장님이 오면 그 순간부터 사장님 돈이라 주인만 만진다.
 *
 * 돈은 여기서 안 움직인다. 적립은 `broker-share.ts`(게이트 `broker_share_enabled` 기본 OFF).
 */
import type { Context, Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { validateBrokerTerms, saveBrokerTerms, readBrokerTerms } from '@/worker/utils/broker-share'
import { getOrIssueOwnerClaimCode, formatStoreCode } from '@/worker/utils/store-codes'
import { canOperateStore, isStoreOwner, resolveStoreOwnerUserId } from '@/worker/utils/seller-operators'

type Ctx = Context<{ Bindings: Env }>
export type PreparedBrokerTerms = ReturnType<typeof validateBrokerTerms> | null

/** 중개 매장이면 검증 결과, 직접 매장이면 null. 실패면 `{ ok:false, error }` — 호출부가 400 으로 돌려준다. */
export function prepareBrokerTerms(b: { channel?: unknown; broker_share_pct?: unknown; influencer_pct_cap?: unknown }): PreparedBrokerTerms {
  return b.channel === 'brokered' ? validateBrokerTerms({ broker_share_pct: b.broker_share_pct, influencer_pct_cap: b.influencer_pct_cap }) : null
}

/**
 * 매장 행과 권한이 만들어진 **뒤**에 부른다. 둘 다 fail-soft — 매장은 이미 존재한다.
 * 반환은 사람이 볼 승계 코드(`XXXX-XXXX`) 또는 null.
 */
export async function finalizeBrokeredStore(
  DB: D1Database, sellerId: number, brokerUserId: number, terms: { sharePct: number; capPct: number | null },
): Promise<string | null> {
  await saveBrokerTerms(DB, sellerId, { brokerUserId, sharePct: terms.sharePct, capPct: terms.capPct })
    .catch(() => { /* 요율은 매장 관리에서 다시 넣을 수 있다 */ })
  const code = await getOrIssueOwnerClaimCode(DB, sellerId, brokerUserId).catch(() => null)
  return code ? formatStoreCode(code.code) : null
}

export function registerBrokerTermsRoutes(
  app: Hono<{ Bindings: Env }>,
  resolveActorUserId: (c: Ctx) => Promise<number | null>,
) {
  app.get('/stores/:id/broker-terms', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const sellerId = Number(c.req.param('id'))
      if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장입니다' }, 400)
      const access = await canOperateStore(c.env.DB, userId, sellerId)
      if (!access.ok) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)
      const terms = await readBrokerTerms(c.env.DB, sellerId)
      const ownerId = await resolveStoreOwnerUserId(c.env.DB, sellerId)
      return c.json({ success: true, data: {
        broker_user_id: terms.brokerUserId, broker_share_pct: terms.sharePct, influencer_pct_cap: terms.influencerCapPct,
        has_owner: ownerId != null,
        can_edit: access.role === 'owner' || (ownerId == null && terms.brokerUserId === userId),
      } })
    } catch (err) {
      return safeError(c, err, '요율을 불러오지 못했습니다', '[seller-stores]')
    }
  })

  app.post('/stores/:id/broker-terms', rateLimit({ action: 'store_broker_terms', max: 30, windowSec: 3600 }), async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const sellerId = Number(c.req.param('id'))
      if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장입니다' }, 400)
      const b = await c.req.json<{ broker_share_pct?: unknown; influencer_pct_cap?: unknown }>().catch(() => ({} as { broker_share_pct?: unknown; influencer_pct_cap?: unknown }))
      const v = validateBrokerTerms(b)
      if (!v.ok) return c.json({ success: false, error: v.error }, 400)
      if (!(await isStoreOwner(c.env.DB, userId, sellerId))) {
        const ownerId = await resolveStoreOwnerUserId(c.env.DB, sellerId)
        const terms = await readBrokerTerms(c.env.DB, sellerId)
        if (ownerId != null || terms.brokerUserId !== userId) {
          return c.json({ success: false, error: '매장 소유자만 요율을 바꿀 수 있습니다' }, 403)
        }
      }
      await saveBrokerTerms(c.env.DB, sellerId, { sharePct: v.sharePct, capPct: v.capPct })
      return c.json({ success: true, data: { broker_share_pct: v.sharePct, influencer_pct_cap: v.capPct } })
    } catch (err) {
      return safeError(c, err, '요율 저장 중 오류가 발생했습니다', '[seller-stores]')
    }
  })
}
