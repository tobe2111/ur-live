/**
 * 🏪 매장 채널(직접/중개) **필수 선택** — 미지정 폴백 폐지 (2026-09-07 대표 결재 Q3-3)
 *
 * 결재: `docs/decisions/2026-09-07-actor-benefit-conflicts.md` — *"기본안대로 모두 승인"* ⇒ Q3-3
 *   "미지정 매장은 등록 시 채널을 **반드시 고르게** 폼을 바꾼다".
 *
 * ## 무엇이 비어 있었나
 * 매장이 생기는 두 문은 이미 채널을 찍는다(`/store/new` 필수 선택 · `/register-from-user` = direct,
 * 2026-09-04/05). 남은 것은 **그 전에 생긴 매장**이다 — 2026-08-31 실측 11곳 중 채널이 박힌 곳은 1곳.
 * 그 매장들은 `fee-context` 가 `channel: 'brokered'` 로 **보여 주고 있었다** — 사실은 "미지정"인데
 * 화면은 "중개 운영" 이라고 말했고, 영입 2% 는 조용히 미지급이었다(직접 입점만 대상).
 *
 * ## 이 모듈이 하는 것
 *   ① `pickStoreChannel` — 저장값이 없으면 **null** 을 돌려준다. 화면이 "중개" 로 추측하지 않게.
 *      ⚠️ **정산은 건드리지 않는다.** `getEffectivePlatformFee`·`channelPlatformRate` 의 brokered 폴백은
 *      머니 경로라 이 결재의 실행기 범위 밖이다(fee-resolver 주석·`ledger-commission-policy` 그대로).
 *      화면이 보여 주는 %(지금 실제로 떼이는 값)는 그래서 여전히 폴백값이고, 라벨만 "미선택" 이 된다.
 *   ② `POST /fee-context/channel` — 미지정 좌석이 **한 번** 고른다. 이미 있으면 409.
 *      운영 중 매장의 채널 *변경*은 수수료가 바뀌는 결정이라 어드민(`/admin/merchant-commissions`)의 일이다.
 *
 * ## 🚫 하지 않는 것
 *   D1 일괄 UPDATE 로 미지정 매장을 채우지 않는다(결재 실행 계획 명시). 그건 사장님이 아닌 우리가
 *   그 매장의 사실(누가 운영하는가)을 정하는 일이고, 틀리면 수수료가 틀린다. 등록 화면에 들어온
 *   사람이 고른다 — 가드: `store-channel-required-2026-09-07.test.ts`.
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { ensureSellerMetaTable, getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta'

export type StoreChannel = 'direct' | 'brokered'
export const isStoreChannel = (v: unknown): v is StoreChannel => v === 'direct' || v === 'brokered'

/**
 * 저장된 채널을 **있는 그대로** 읽는다.
 *   · `channel` — 화면에 보여 줄 값. 미지정이면 **null** (중개로 추측하지 않는다)
 *   · `effective` — 지금 정산이 실제로 쓰는 값(미지정 = brokered 폴백, fee-resolver 와 동일)
 *   · `set` — 사람이 고른 적이 있는가
 */
export function pickStoreChannel(stored: unknown): { channel: StoreChannel | null; effective: StoreChannel; set: boolean } {
  if (isStoreChannel(stored)) return { channel: stored, effective: stored, set: true }
  return { channel: null, effective: 'brokered', set: false }
}

export function registerStoreChannelRoutes(app: Hono<{ Bindings: Env }>) {
  // ── POST /fee-context/channel — 미지정 좌석이 채널을 한 번 고른다 (set-once) ──────────
  app.post('/fee-context/channel', rateLimit({ action: 'store_channel_pick', max: 10, windowSec: 3600 }), async (c) => {
    try {
      const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
      if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
      const b = await c.req.json<{ channel?: unknown }>().catch(() => ({} as { channel?: unknown }))
      if (!isStoreChannel(b.channel)) {
        return c.json({ success: false, error: '등록 유형을 선택해주세요 — 직접(내 가게) 또는 중개(관리 대행)' }, 400)
      }
      await ensureSellerMetaTable(c.env.DB)
      const current = pickStoreChannel((await getSellerMeta(c.env.DB, [sellerId])).get(sellerId)?.store_channel)
      if (current.set) {
        // 이미 정해진 매장의 채널은 여기서 바꾸지 않는다 — 수수료가 바뀌는 결정은 어드민이 기록을 남기며 한다.
        return c.json({ success: false, error: '이 매장의 운영 방식은 이미 정해져 있어요. 변경은 고객센터로 요청해주세요.', code: 'CHANNEL_ALREADY_SET', data: { channel: current.channel } }, 409)
      }
      await setSellerMeta(c.env.DB, sellerId, { store_channel: b.channel })
      return c.json({ success: true, data: { channel: b.channel } })
    } catch (err) {
      return safeError(c, err, '운영 방식을 저장하지 못했습니다', '[seller-stores]')
    }
  })
}
