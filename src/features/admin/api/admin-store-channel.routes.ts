/**
 * 🏪 매장 등록 채널(직접 / 대행사) — **어드민 지정** (2026-08-27).
 *
 * ## 왜 필요했나
 * 채널은 요율을 정한다(직접 10% / 대행사 5%). 그런데 지금까지 채널을 바꿀 수 있는 사람은
 * **매장 소유자뿐**이었다(`POST /api/seller/stores/:id/channel`). 그래서 라이브 실측에서
 * **활성 매장 7곳 중 6곳이 미기록**이었고, 미기록은 종전 요율 경로로 떨어진다 —
 * 즉 대표가 확정한 가격 모델이 **적용될 수 없는 상태**였다.
 *
 * 매장이 직접 왔는지 대행사가 데려왔는지는 **유어딜이 아는 사실**이다(계약 주체가 다르다).
 * 그러니 이건 소유자에게만 맡길 값이 아니라 어드민이 확정할 수 있어야 한다.
 *
 * ## 요율이 바뀌는 결정이라 감사 로그를 남긴다
 * 변경 전/후를 `writeAuditLog` 로 기록한다 — "누가 언제 이 매장을 대행으로 바꿨나"를
 * 나중에 물을 수 있어야 한다(돈이 달라지는 값이다).
 *
 * ⚠️ 이 엔드포인트가 **요율을 즉시 바꾸지는 않는다**: 채널이 실제로 요율에 반영되려면
 *   `platform_settings.fee_channel_rates_enabled = 'true'` 여야 한다(기본 OFF). 그래서 응답에
 *   현재 게이트 상태를 함께 돌려준다 — 채널만 찍어 두고 "적용됐겠지" 하는 오해를 막는다.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta'
import { safeError } from '@/worker/utils/safe-error'
import { DEFAULT_FEE_RATES } from '@/worker/utils/fee-resolver'
import { DEFAULT_PG_RESERVE_PCT } from '@/worker/utils/commission-budget'
import { COMMISSION_DEFAULTS } from '@/shared/constants/policy'

const adminStoreChannelRoutes = new Hono<{ Bindings: Env }>()

/** 채널은 이 둘뿐이다. 문자열을 자유롭게 받으면 요율 조회가 조용히 '미지정'으로 떨어진다. */
const CHANNELS = ['direct', 'brokered'] as const
type Channel = (typeof CHANNELS)[number]
const isChannel = (v: unknown): v is Channel => CHANNELS.includes(v as Channel)

async function channelGateOn(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'fee_channel_rates_enabled'")
    .first<{ value: string }>().catch(() => null)
  return row?.value === 'true'
}

/**
 * 돈 갈림표에 쓰는 요율 묶음. 전부 `platform_settings` 이고 어드민이 조정한다.
 * 조회 실패는 기본값으로 떨어진다 — 표가 안 뜨는 것보다 기본값으로라도 보이는 게 낫다.
 */
async function loadSplitRates(DB: D1Database): Promise<{
  direct_pct: number; brokered_pct: number; pg_reserve_pct: number; store_intro_pct: number
}> {
  const read = async (key: string, fallback: number): Promise<number> => {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(key).first<{ value: string }>().catch(() => null)
    const n = Number(row?.value)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }
  return {
    direct_pct: await read('platform_fee_pct_direct', DEFAULT_FEE_RATES.platformPctDirect),
    brokered_pct: await read('platform_fee_pct_brokered', DEFAULT_FEE_RATES.platformPct),
    pg_reserve_pct: await read('pg_reserve_pct', DEFAULT_PG_RESERVE_PCT),
    store_intro_pct: await read('influencer_store_intro_pct', COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT),
  }
}

/** GET /api/admin/sellers/:id/channel — 현재 채널 + 게이트 상태 */
adminStoreChannelRoutes.get('/sellers/:id/channel', cors(), async (c) => {
  try {
    const sellerId = Number(c.req.param('id'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return c.json({ success: false, error: '매장 ID 가 올바르지 않습니다' }, 400)
    }
    const meta = (await getSellerMeta(c.env.DB, [sellerId])).get(sellerId)
    return c.json({
      success: true,
      data: {
        seller_id: sellerId,
        // null = 미지정. 이 상태는 종전 요율 경로로 떨어진다(채널이 요율을 안 정한다).
        channel: isChannel(meta?.store_channel) ? meta.store_channel : null,
        channel_rates_active: await channelGateOn(c.env.DB),
        // 💰 2026-08-31 대표 요구 — 어드민 매장 카드가 "이 설정이면 돈이 어떻게 갈리나"를
        //   그 자리에서 보여주기 위한 요율. 화면이 직접 platform_settings 를 캐지 않게 여기서 준다.
        //   ⚠️ **어드민 전용이다**(대표: "3번 결과는 운영자인 나만 보여야 해") — PG 준비금과
        //   유어딜 마진이 들어 있어 매장·소개자에게 보일 성질이 아니다. 셀러 API 에 넣지 말 것.
        rates: await loadSplitRates(c.env.DB),
      },
    })
  } catch (err) {
    return safeError(c, err, '채널 조회 중 오류가 발생했습니다', '[admin:store-channel]')
  }
})

/** PATCH /api/admin/sellers/:id/channel — 채널 확정 (요율이 바뀌는 결정) */
adminStoreChannelRoutes.patch('/sellers/:id/channel', cors(), async (c) => {
  try {
    // 🔑 입력 검증을 **DB 를 만지기 전에** 끝낸다. 잘못된 입력은 아무 일도 하지 않고 400 으로 돌아가야
    //   하고, 그래야 "요율이 바뀌는 값"에 쓰레기가 들어갈 창이 열리지 않는다.
    const sellerId = Number(c.req.param('id'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return c.json({ success: false, error: '매장 ID 가 올바르지 않습니다' }, 400)
    }
    const body = await c.req.json<{ channel?: unknown }>().catch(() => ({} as { channel?: unknown }))
    if (!isChannel(body.channel)) {
      return c.json({ success: false, error: "채널은 'direct' 또는 'brokered' 입니다" }, 400)
    }
    const { DB } = c.env
    // 실재 확인 — 없는 매장에 메타를 심으면 조용한 고아 행이 남는다.
    const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ id: number }>().catch(() => null)
    if (!seller) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)

    const before = (await getSellerMeta(DB, [sellerId])).get(sellerId)?.store_channel ?? null
    await setSellerMeta(DB, sellerId, { store_channel: body.channel })
    await writeAuditLog(c, {
      action: 'change_store_channel',
      targetType: 'seller',
      targetId: String(sellerId),
      before: { store_channel: before },
      after: { store_channel: body.channel },
    }).catch(() => { /* 감사 로그 실패가 변경을 되돌리지는 않는다 */ })

    const gateOn = await channelGateOn(DB)
    return c.json({
      success: true,
      data: { seller_id: sellerId, channel: body.channel, channel_rates_active: gateOn },
      // ⚠️ 게이트가 꺼져 있으면 채널을 찍어도 요율은 안 바뀐다 — 그 사실을 숨기지 않는다.
      message: gateOn
        ? `채널을 ${body.channel === 'direct' ? '직접 입점' : '대행사 경유'}(으)로 지정했습니다`
        : `채널을 지정했습니다. 다만 채널 요율 스위치(fee_channel_rates_enabled)가 꺼져 있어 아직 요율에는 반영되지 않습니다`,
    })
  } catch (err) {
    return safeError(c, err, '채널 변경 중 오류가 발생했습니다', '[admin:store-channel]')
  }
})

export { adminStoreChannelRoutes }
export default adminStoreChannelRoutes
