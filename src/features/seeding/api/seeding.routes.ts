/**
 * 🎁 무상 체험 제공 — 인플루언서(유저) 라우트 + SNS 연동 콜백 (2026-10-31)
 *
 *   GET    /api/seeding/offer/:productId          공개 — 제공 여부·조건·이번 달 남은 자리
 *   GET    /api/seeding/offer/:productId/me       [유저] 내 자격(연동한 SNS 로 자동 판정)
 *   GET    /api/seeding/me                        [유저] 연동 · 신청권 · 내 신청 · 패널티
 *   POST   /api/seeding/apply                     [유저] 무료 체험 신청
 *   POST   /api/seeding/applications/:id/schedule [유저] 보증금(신청권 1장) + 희망 일정
 *   POST   /api/seeding/applications/:id/post     [유저] 게시물 링크 제출
 *   POST   /api/seeding/applications/:id/cancel   [유저] 취소
 *   POST   /api/seeding/passes/charge|confirm     [유저] 신청권 묶음 구매(토스, 게이트 뒤)
 *   GET    /api/seeding/sns/:platform/start       [유저] 연동 시작 URL
 *   DELETE /api/seeding/sns/:platform             [유저] 연동 해제
 *   GET    /api/sns-link/:platform/callback       공개 — 플랫폼 로그인 뒤 돌아오는 자리
 *
 * 💳 신청권 구매는 `confirmTossPayment`(Toss V2 SSOT)만 부른다 — 직접 fetch 금지.
 *   🚦 `seeding_pass_charge_enabled = 'true'` 일 때만(staging 실결제 확인 전엔 꺼 둔다).
 *   그 전에도 가입 혜택 3회는 쓸 수 있다.
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth'
import { rateLimit } from '../../../worker/middleware/rate-limit'
import { safeError } from '../../../worker/utils/safe-error'
import { cancelTossPayment, confirmTossPayment, decideTossFlow } from '../../../worker/utils/toss-gateway'
import {
  OPEN_STATUSES, SEEDING_TPL, SLOT_COUNTED_STATUSES, checkEligibility, isSeedingPlatform, msgSlotsStore,
  normalizeVisitSlots, parsePassPackages, sqlIn, validPostUrl,
} from '../../../shared/seeding'
import {
  chargePasses, claimPurchaseCancel, ensureSeedingTables, listPurchases, revertPurchaseCancel, grantSignupPasses, loadOffer, monthKeyKst, passBalance, passHistory,
  penaltyState, setting, spendPass, transition,
} from './seeding-db'
import {
  authorizeUrlFor, exchangeAndFetch, listSnsLinks, platformAvailability, safeSnsReturn, saveSnsLink, signSnsState,
  verifySnsState, SNS_ORIGIN,
} from './sns-link'
import { APP_SELECT, influencerCancel, loadApp, sendToStore } from './seeding-actions'
import { toStore } from './seeding-notify'

type E = { Bindings: Env }
const uid = (c: Parameters<typeof getCurrentUser>[0]) => Number(getCurrentUser(c)?.id) || 0

async function usedSlots(DB: D1Database, productId: number): Promise<number> {
  const r = await DB.prepare(
    `SELECT COUNT(*) AS n FROM seeding_applications WHERE product_id = ? AND month_key = ? AND status IN ${sqlIn(SLOT_COUNTED_STATUSES)}`,
  ).bind(productId, monthKeyKst()).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

async function eligibilityFor(DB: D1Database, userId: number, productId: number) {
  const offer = await loadOffer(DB, productId)
  if (!offer) return { offer: null, eligibility: null }
  const [links, used, open, pen] = await Promise.all([
    listSnsLinks(DB, userId),
    usedSlots(DB, productId),
    DB.prepare(`SELECT 1 AS x FROM seeding_applications WHERE product_id = ? AND user_id = ? AND status IN ${sqlIn(OPEN_STATUSES)} LIMIT 1`)
      .bind(productId, userId).first().catch(() => null),
    penaltyState(DB, userId),
  ])
  const eligibility = checkEligibility({ offer, links, usedSlotsThisMonth: used, hasOpenApplication: !!open, blockedUntil: pen.blocked_until })
  return { offer, eligibility, links, used }
}

export const seedingRoutes = new Hono<E>()

seedingRoutes.get('/offer/:productId', async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const pid = Number(c.req.param('productId'))
    if (!(pid > 0)) return c.json({ success: false, error: '이용권을 찾을 수 없어요' }, 400)
    const offer = await loadOffer(DB, pid)
    const used = offer?.enabled ? await usedSlots(DB, pid) : 0
    c.header('Cache-Control', 'public, max-age=30')
    return c.json({
      success: true,
      data: offer
        ? { ...offer, seller_id: undefined, slots_left: Math.max(0, offer.slots_per_month - used) }
        : { enabled: false },
    })
  } catch (err) {
    return safeError(c, err, '체험 정보를 불러오지 못했어요', '[seeding:offer]')
  }
})

seedingRoutes.get('/offer/:productId/me', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const me = uid(c)
    await grantSignupPasses(DB, me)
    const r = await eligibilityFor(DB, me, Number(c.req.param('productId')))
    return c.json({
      success: true,
      data: {
        eligibility: r.eligibility, links: r.links ?? [], passes: await passBalance(DB, me),
        available: await platformAvailability(c.env),
      },
    })
  } catch (err) {
    return safeError(c, err, '신청 자격을 확인하지 못했어요', '[seeding:offer-me]')
  }
})

seedingRoutes.get('/me', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const me = uid(c)
    await grantSignupPasses(DB, me)
    const [links, available, passes, history, pen, apps, packagesRaw, chargeOn] = await Promise.all([
      listSnsLinks(DB, me), platformAvailability(c.env), passBalance(DB, me), passHistory(DB, me), penaltyState(DB, me),
      DB.prepare(`${APP_SELECT} WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 50`).bind(me).all().catch(() => ({ results: [] })),
      setting(DB, 'seeding_pass_packages'), setting(DB, 'seeding_pass_charge_enabled'),
    ])
    return c.json({
      success: true,
      data: {
        links, available, passes, history, penalty: pen, applications: apps.results ?? [],
        packages: parsePassPackages(packagesRaw), charge_enabled: chargeOn === 'true',
      },
    })
  } catch (err) {
    return safeError(c, err, '내 체험 정보를 불러오지 못했어요', '[seeding:me]')
  }
})

seedingRoutes.post('/apply', requireAuth(), rateLimit({ action: 'seeding_apply', max: 20, windowSec: 600 }), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const me = uid(c)
    const body = await c.req.json<{ product_id?: number }>().catch(() => ({} as { product_id?: number }))
    const pid = Number(body.product_id)
    if (!(pid > 0)) return c.json({ success: false, error: '이용권을 골라 주세요' }, 400)
    const product = await DB.prepare(`SELECT id, seller_id FROM products WHERE id = ? AND is_active = 1`).bind(pid).first<{ id: number; seller_id: number | null }>()
    if (!product) return c.json({ success: false, error: '판매 중인 이용권이 아니에요' }, 404)
    if (product.seller_id) {
      const own = await DB.prepare(`SELECT 1 AS x FROM sellers WHERE id = ? AND linked_user_id = ?`).bind(product.seller_id, me).first().catch(() => null)
      if (own) return c.json({ success: false, error: '내 가게 이용권에는 신청할 수 없어요' }, 400)
    }
    const r = await eligibilityFor(DB, me, pid)
    // 서버가 다시 판정한다 — 화면이 "가능" 이라 해도 그 사이 자리가 찼을 수 있다.
    if (!r.eligibility?.ok) {
      return c.json({ success: false, error: r.eligibility?.message || '이 이용권은 무상 체험을 제공하지 않아요', code: r.eligibility?.reason || 'offer_off' }, 400)
    }
    const link = (r.links ?? []).find((l) => l.platform === r.eligibility!.platform)
    const ins = await DB.prepare(
      `INSERT INTO seeding_applications (product_id, seller_id, user_id, platform, sns_username, follower_count, status, month_key)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`,
    ).bind(pid, product.seller_id, me, r.eligibility.platform, link?.username || link?.display_name || null, r.eligibility.follower_count, monthKeyKst())
      .first<{ id: number }>()
    // 🤖 원클릭 자동화 — 어드민 스위치가 켜져 있으면 운영자 확인 없이 바로 사장님께 보낸다.
    let autoSent = false
    if (ins?.id && (await setting(DB, 'seeding_auto_send_to_store')) === 'true') {
      const app = await loadApp(DB, ins.id)
      if (app) autoSent = (await sendToStore(c.env, DB, app)).ok
    }
    return c.json({
      success: true,
      data: { id: ins?.id, status: autoSent ? 'sent' : 'pending' },
      message: autoSent ? '신청했어요. 사장님께 바로 전달했어요' : '신청했어요. 확인 후 사장님께 전달해 드릴게요',
    })
  } catch (err) {
    return safeError(c, err, '신청하지 못했어요', '[seeding:apply]')
  }
})

async function ownApp(DB: D1Database, id: string, me: number) {
  const a = await loadApp(DB, Number(id))
  return a && Number(a.user_id) === me ? a : null
}

seedingRoutes.post('/applications/:id/schedule', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const a = await ownApp(c.env.DB, c.req.param('id') ?? '', uid(c))
    if (!a) return c.json({ success: false, error: '신청을 찾을 수 없어요' }, 404)
    const body = await c.req.json<{ slots?: unknown }>().catch(() => ({} as { slots?: unknown }))
    const slots = normalizeVisitSlots(body.slots)
    if (!slots.length) return c.json({ success: false, error: '내일 이후 방문 희망 일정을 1~3개 골라 주세요' }, 400)
    // ① 상태를 먼저 잡는다(claim) — 두 번 눌러도 신청권은 한 장만 빠진다.
    if (!(await transition(DB, a.id, ['approved'], 'scheduling', { visit_slots: JSON.stringify(slots) }))) {
      return c.json({ success: false, error: '이미 처리됐거나 지금 일정을 낼 수 없는 상태예요' }, 409)
    }
    // ② 노쇼 방지 보증금 — 신청권 1장(무료 칸부터).
    const bucket = await spendPass(DB, a.user_id, a.id)
    if (!bucket) {
      await transition(DB, a.id, ['scheduling'], 'approved', { visit_slots: null })
      return c.json({ success: false, error: '신청권이 없어요. 신청권을 산 뒤 다시 시도해 주세요', code: 'NO_PASS' }, 402)
    }
    await DB.prepare(`UPDATE seeding_applications SET pass_bucket = ? WHERE id = ?`).bind(bucket, a.id).run().catch(() => null)
    await toStore(c.env, DB, { sellerId: a.seller_id, productId: a.product_id, appId: a.id }, SEEDING_TPL.slotsStore,
      msgSlotsStore({ store: a.store_name || '매장', product: a.product_name || '이용권', handle: a.sns_username || '-', slots: slots.join(' / ') }),
      '체험 방문 희망 일정이 도착했어요')
    return c.json({ success: true, data: { passes: await passBalance(DB, a.user_id), bucket }, message: '희망 일정을 사장님께 보냈어요' })
  } catch (err) {
    return safeError(c, err, '일정을 보내지 못했어요', '[seeding:schedule]')
  }
})

seedingRoutes.post('/applications/:id/post', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    const a = await ownApp(c.env.DB, c.req.param('id') ?? '', uid(c))
    if (!a) return c.json({ success: false, error: '신청을 찾을 수 없어요' }, 404)
    const body = await c.req.json<{ url?: string }>().catch(() => ({} as { url?: string }))
    const url = validPostUrl(body.url, a.platform)
    if (!url) return c.json({ success: false, error: '신청한 플랫폼의 게시물 주소(https)를 붙여 넣어 주세요' }, 400)
    if (!(await transition(DB, a.id, ['scheduled'], 'posted', { post_url: url }))) {
      return c.json({ success: false, error: '방문이 확정된 신청에만 게시물을 등록할 수 있어요' }, 409)
    }
    return c.json({ success: true, message: '게시물을 등록했어요. 확인 후 완료 처리돼요' })
  } catch (err) {
    return safeError(c, err, '게시물을 등록하지 못했어요', '[seeding:post]')
  }
})

seedingRoutes.post('/applications/:id/cancel', requireAuth(), async (c) => {
  try {
    const a = await ownApp(c.env.DB, c.req.param('id') ?? '', uid(c))
    if (!a) return c.json({ success: false, error: '신청을 찾을 수 없어요' }, 404)
    const r = await influencerCancel(c.env.DB, a)
    if (!r.ok) return c.json({ success: false, error: r.error }, r.status)
    return c.json({ success: true, message: r.refunded ? '취소했어요. 신청권 1장을 돌려드렸어요' : '취소했어요' })
  } catch (err) {
    return safeError(c, err, '취소하지 못했어요', '[seeding:cancel]')
  }
})

// ── 신청권 구매(노쇼 방지 보증금) ─────────────────────────────────

const ORDER_RE = /^SDP-(\d{1,10})-(p\d{1,3})-\d{10,16}$/

seedingRoutes.post('/passes/charge', requireAuth(), rateLimit({ action: 'seeding_charge', max: 10, windowSec: 600 }), async (c) => {
  try {
    const DB = c.env.DB
    if ((await setting(DB, 'seeding_pass_charge_enabled')) !== 'true') {
      return c.json({ success: false, error: '신청권 구매는 곧 열려요. 지금은 가입 혜택 무료 신청권을 써 주세요', code: 'CHARGE_CLOSED' }, 503)
    }
    const body = await c.req.json<{ package_key?: string }>().catch(() => ({} as { package_key?: string }))
    const pkg = parsePassPackages(await setting(DB, 'seeding_pass_packages')).find((p) => p.key === body.package_key)
    if (!pkg) return c.json({ success: false, error: '묶음을 골라 주세요' }, 400)
    const { flow, flowReason } = decideTossFlow(c.env.TOSS_CLIENT_KEY)
    if (flow === 'invalid') return c.json({ success: false, error: '결제 시스템이 설정되지 않았어요', _debug: flowReason }, 503)
    return c.json({
      success: true,
      data: { orderId: `SDP-${uid(c)}-${pkg.key}-${Date.now()}`, amount: pkg.price, orderName: `체험 신청권 ${pkg.label}`, clientKey: c.env.TOSS_CLIENT_KEY, flow },
    })
  } catch (err) {
    return safeError(c, err, '구매를 시작하지 못했어요', '[seeding:charge]')
  }
})

seedingRoutes.post('/passes/confirm', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const me = uid(c)
    const body = await c.req.json<{ paymentKey?: string; orderId?: string; amount?: number }>()
      .catch(() => ({} as { paymentKey?: string; orderId?: string; amount?: number }))
    const paymentKey = String(body.paymentKey || '')
    const orderId = String(body.orderId || '')
    const m = ORDER_RE.exec(orderId)
    if (!paymentKey || !m || Number(m[1]) !== me) return c.json({ success: false, error: '결제 정보가 올바르지 않아요' }, 400)
    const pkg = parsePassPackages(await setting(DB, 'seeding_pass_packages')).find((p) => p.key === m[2])
    if (!pkg) return c.json({ success: false, error: '묶음 정보를 확인할 수 없어요' }, 400)
    // 금액의 진실은 서버 묶음 가격 — 클라 값이 다르면 승인하지 않는다.
    if (Number(body.amount) !== pkg.price) return c.json({ success: false, error: '결제 금액이 묶음 가격과 달라요' }, 400)
    const done = await DB.prepare(`SELECT 1 AS x FROM seeding_pass_tx WHERE kind = 'charge' AND ref = ?`).bind(`pay:${paymentKey}`).first()
    if (done) return c.json({ success: true, data: { passes: await passBalance(DB, me) }, message: '이미 처리된 결제예요' })
    const toss = await confirmTossPayment({
      env: c.env, paymentKey, orderId, amount: pkg.price, idempotencyKey: `sdp_${orderId}`, circuitName: 'toss-confirm-seeding-pass',
    })
    if (!toss.ok) return c.json({ success: false, error: toss.message, code: toss.code }, 400)
    const added = await chargePasses(DB, me, pkg.passes, paymentKey, pkg.price, `체험 신청권 ${pkg.label} (${orderId})`)
    return c.json({ success: true, data: { passes: await passBalance(DB, me) }, message: added ? `신청권 ${pkg.passes}장을 받았어요` : '이미 처리된 결제예요' })
  } catch (err) {
    return safeError(c, err, '구매를 완료하지 못했어요', '[seeding:confirm]')
  }
})

seedingRoutes.get('/passes/purchases', requireAuth(), async (c) => {
  await ensureSeedingTables(c.env.DB)
  return c.json({ success: true, data: await listPurchases(c.env.DB, uid(c)) })
})

/**
 * 💳 구매 취소(청약철회) — 산 지 7일 안 · 그 묶음 장수가 아직 남아 있을 때만.
 * 순서: 원장 cancel 줄 + 유료 칸 CAS 차감(선점) → 토스 전액 취소 → 실패하면 선점을 되돌린다.
 * 토스 취소는 `cancelTossPayment`(V2 SSOT) 호출만 — 직접 fetch 금지.
 */
seedingRoutes.post('/passes/purchases/:paymentKey/cancel', requireAuth(), rateLimit({ action: 'seeding_pass_cancel', max: 5, windowSec: 600 }), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const me = uid(c)
    const pk = String(c.req.param('paymentKey') ?? '')
    if (!/^[A-Za-z0-9_-]{8,200}$/.test(pk)) return c.json({ success: false, error: '결제 정보를 찾을 수 없어요' }, 400)
    const claim = await claimPurchaseCancel(DB, me, pk)
    const msg: Record<string, string> = {
      not_found: '결제 정보를 찾을 수 없어요', done: '이미 취소된 구매예요',
      expired: '구매 후 7일이 지나 취소할 수 없어요', spent: '이 묶음의 신청권을 이미 써서 취소할 수 없어요',
    }
    if (claim.status !== 'ok') return c.json({ success: false, error: msg[claim.status], code: claim.status.toUpperCase() }, claim.status === 'done' ? 409 : 400)
    const toss = await cancelTossPayment({
      env: c.env, paymentKey: pk, cancelReason: '체험 신청권 구매 취소(청약철회)', idempotencyKey: `sdp_cancel_${pk}`, circuitName: 'toss-cancel-seeding-pass',
    })
    if (!toss.ok) {
      await revertPurchaseCancel(DB, me, pk, claim.passes ?? 0)
      return c.json({ success: false, error: toss.message || '결제를 취소하지 못했어요', code: toss.code }, 400)
    }
    return c.json({ success: true, data: { passes: await passBalance(DB, me) }, message: `구매를 취소했어요. ${claim.price?.toLocaleString('ko-KR')}원이 환불돼요` })
  } catch (err) {
    return safeError(c, err, '구매를 취소하지 못했어요', '[seeding:cancel-purchase]')
  }
})

// ── SNS 연동 ──────────────────────────────────────────────────────

seedingRoutes.get('/sns/:platform/start', requireAuth(), async (c) => {
  try {
    const p = c.req.param('platform')
    if (!isSeedingPlatform(p)) return c.json({ success: false, error: '모르는 플랫폼이에요' }, 400)
    if (!c.env.JWT_SECRET) return c.json({ success: false, error: '연동 설정이 없어요' }, 503)
    const state = await signSnsState(c.env.JWT_SECRET, { u: uid(c), p, r: safeSnsReturn(c.req.query('return')) })
    const url = await authorizeUrlFor(c.env, p, state)
    if (!url) return c.json({ success: false, error: '이 플랫폼 연동은 준비 중이에요', code: 'NOT_CONFIGURED' }, 503)
    return c.json({ success: true, data: { url } })
  } catch (err) {
    return safeError(c, err, '연동을 시작하지 못했어요', '[seeding:sns-start]')
  }
})

seedingRoutes.delete('/sns/:platform', requireAuth(), async (c) => {
  const p = c.req.param('platform')
  if (!isSeedingPlatform(p)) return c.json({ success: false, error: '모르는 플랫폼이에요' }, 400)
  await c.env.DB.prepare(`DELETE FROM user_sns_links WHERE user_id = ? AND platform = ?`).bind(uid(c), p).run().catch(() => null)
  return c.json({ success: true, message: '연동을 해제했어요' })
})

export const snsLinkCallbackRoutes = new Hono<E>()

snsLinkCallbackRoutes.get('/api/sns-link/:platform/callback', async (c) => {
  let back = '/my-seeding'
  const go = (result: string, reason?: string) => {
    const q = new URLSearchParams({ sns: result })
    if (reason) q.set('reason', reason)
    return c.redirect(`${SNS_ORIGIN}${back}?${q}`, 302)
  }
  try {
    const p = c.req.param('platform')
    const st = await verifySnsState(c.env.JWT_SECRET, c.req.query('state'))
    if (!st || st.p !== p) return go('error', '연동 요청이 만료됐어요. 다시 시도해 주세요')
    back = st.r
    if (c.req.query('error')) return go('cancelled')
    const code = c.req.query('code')
    if (!code) return go('error', '승인 코드를 받지 못했어요')
    await ensureSeedingTables(c.env.DB)
    const r = await exchangeAndFetch(c.env, st.p, code)
    if (!r.ok) return go('error', r.error)
    const saved = await saveSnsLink(c.env, st.u, st.p, r.account)
    if (!saved.ok) return go('error', saved.error)
    return go(r.account.follower_count === null ? 'connected_nocount' : 'connected')
  } catch (err) {
    console.error('[seeding:sns-callback]', (err as Error).message)
    return go('error', '연동 중 오류가 났어요')
  }
})
