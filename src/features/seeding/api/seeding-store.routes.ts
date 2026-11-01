/**
 * 🎁 무상 체험 제공 — 사장님(셀러 좌석) · 어드민 라우트 (2026-10-31)
 *
 * 사장님(`/api/seller/seeding`, requireSeller — 좌석 토큰의 매장만):
 *   GET  /offers                    내 이용권 + 제공 설정
 *   GET  /offers/:productId         제공 설정 1건
 *   PUT  /offers/:productId         제공 설정 저장(이용권 등록 직후에도 이걸 부른다)
 *   GET  /requests                  내 매장에 온 신청
 *   POST /requests/:id/respond      승인/거절
 *   POST /requests/:id/pick         희망 일정 확정 → 0원 체험 이용권 발급
 *   POST /requests/:id/no-show      노쇼 신고
 *   POST /requests/:id/cancel       매장 사정으로 취소(보증금 반환)
 *
 * 어드민(`/api/admin/seeding`, requireAdmin): 같은 동작을 대신 한다 + 큐 + 설정.
 *   GET  /applications?status=      신청 큐
 *   POST /applications/:id/send     사장님께 보내기(알림톡)
 *   POST /applications/:id/respond | /pick | /no-show | /cancel | /complete | /reject
 *   GET|PUT /settings               원클릭 자동 전송 · 가입 무료 횟수 · 묶음 · 구매 스위치
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import { requireAdmin, requireSeller, getCurrentUser } from '../../../worker/middleware/auth'
import { safeError } from '../../../worker/utils/safe-error'
import { intParam } from '../../../shared/pagination'
import { APPLICATION_STATUSES, normalizeOffer, parsePassPackages } from '../../../shared/seeding'
import { ensureSeedingTables, loadOffer, saveOffer, setting, transition } from './seeding-db'
import { APP_SELECT, loadApp, markNoShow, pickSlot, respond, sendToStore, storeCancel, type AppRow } from './seeding-actions'

type E = { Bindings: Env }
type Ctx = Parameters<typeof getCurrentUser>[0]
const sellerOf = (c: Ctx) => Number(getCurrentUser(c)?.id) || 0

async function ownsProduct(DB: D1Database, productId: number, sellerId: number): Promise<boolean> {
  const r = await DB.prepare(`SELECT 1 AS x FROM products WHERE id = ? AND seller_id = ?`).bind(productId, sellerId).first().catch(() => null)
  return !!r
}

type Act = (env: unknown, DB: D1Database, a: AppRow, body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; status?: 400 | 404 | 409 }>
const ACTIONS: Record<string, Act> = {
  respond: (env, DB, a, b) => respond(env, DB, a, b.decision === 'reject' ? 'reject' : 'approve'),
  pick: (env, DB, a, b) => pickSlot(env, DB, a, String(b.slot ?? '')),
  'no-show': (env, DB, a) => markNoShow(env, DB, a),
  cancel: (_env, DB, a) => storeCancel(DB, a),
}

// ══════════════════════════ 사장님 ══════════════════════════
export const seedingSellerRoutes = new Hono<E>()

seedingSellerRoutes.get('/offers', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const rows = await DB.prepare(
      `SELECT p.id, p.name, p.price, p.image_url, o.enabled, o.slots_per_month, o.min_followers, o.platforms
       FROM products p LEFT JOIN seeding_offers o ON o.product_id = p.id
       WHERE p.seller_id = ? AND p.is_active = 1 AND COALESCE(p.deal_only, 0) = 0
       ORDER BY p.id DESC LIMIT 100`,
    ).bind(sellerOf(c)).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results ?? [] })
  } catch (err) {
    return safeError(c, err, '이용권 목록을 불러오지 못했어요', '[seeding:offers]')
  }
})

seedingSellerRoutes.get('/offers/:productId', requireSeller(), async (c) => {
  const DB = c.env.DB
  await ensureSeedingTables(DB)
  const pid = Number(c.req.param('productId'))
  if (!(await ownsProduct(DB, pid, sellerOf(c)))) return c.json({ success: false, error: '내 이용권이 아니에요' }, 403)
  const o = await loadOffer(DB, pid)
  return c.json({ success: true, data: o ? { ...o, seller_id: undefined } : normalizeOffer(null) })
})

seedingSellerRoutes.put('/offers/:productId', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const sid = sellerOf(c)
    const pid = Number(c.req.param('productId'))
    if (!(await ownsProduct(DB, pid, sid))) return c.json({ success: false, error: '내 이용권이 아니에요' }, 403)
    const body = await c.req.json().catch(() => ({}))
    const offer = normalizeOffer(body as Record<string, unknown>)
    await saveOffer(DB, pid, sid, offer)
    return c.json({ success: true, data: offer, message: offer.enabled ? '무상 체험 제공을 켰어요' : '무상 체험 제공을 껐어요' })
  } catch (err) {
    return safeError(c, err, '설정을 저장하지 못했어요', '[seeding:offer-save]')
  }
})

seedingSellerRoutes.get('/requests', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    // 운영자 확인 전(pending)은 사장님께 보이지 않는다 — 보낸 것부터.
    const rows = await DB.prepare(
      `${APP_SELECT} WHERE a.seller_id = ? AND a.status <> 'pending' AND a.status <> 'admin_rejected' ORDER BY a.id DESC LIMIT 100`,
    ).bind(sellerOf(c)).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: rows.results ?? [] })
  } catch (err) {
    return safeError(c, err, '신청을 불러오지 못했어요', '[seeding:requests]')
  }
})

seedingSellerRoutes.post('/requests/:id/:action', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    const act = ACTIONS[c.req.param('action') ?? '']
    if (!act) return c.json({ success: false, error: '모르는 동작이에요' }, 404)
    const a = await loadApp(DB, Number(c.req.param('id')))
    if (!a || Number(a.seller_id) !== sellerOf(c)) return c.json({ success: false, error: '신청을 찾을 수 없어요' }, 404)
    if (a.status === 'pending') return c.json({ success: false, error: '아직 운영팀이 확인 중인 신청이에요' }, 409)
    const r = await act(c.env, DB, a, await c.req.json().catch(() => ({})))
    if (!r.ok) return c.json({ success: false, error: r.error }, r.status ?? 400)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '처리하지 못했어요', '[seeding:store-action]')
  }
})

// ══════════════════════════ 어드민 ══════════════════════════
export const seedingAdminRoutes = new Hono<E>()

seedingAdminRoutes.get('/applications', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureSeedingTables(DB)
    const status = c.req.query('status') || ''
    const limit = Math.min(200, Math.max(1, intParam(c.req.query('limit'), 100)))
    const valid = (APPLICATION_STATUSES as readonly string[]).includes(status)
    const rows = await (valid
      ? DB.prepare(`${APP_SELECT} WHERE a.status = ? ORDER BY a.id DESC LIMIT ?`).bind(status, limit)
      : DB.prepare(`${APP_SELECT} ORDER BY a.id DESC LIMIT ?`).bind(limit)
    ).all().catch(() => ({ results: [] }))
    const counts = await DB.prepare(`SELECT status, COUNT(*) AS n FROM seeding_applications GROUP BY status`).all<{ status: string; n: number }>()
      .catch(() => ({ results: [] as { status: string; n: number }[] }))
    return c.json({ success: true, data: { rows: rows.results ?? [], counts: Object.fromEntries((counts.results ?? []).map((r) => [r.status, r.n])) } })
  } catch (err) {
    return safeError(c, err, '신청 큐를 불러오지 못했어요', '[seeding:admin-list]')
  }
})

const ADMIN_ACTIONS: Record<string, Act> = {
  ...ACTIONS,
  send: (env, DB, a) => sendToStore(env, DB, a),
  complete: async (_env, DB, a) => ((await transition(DB, a.id, ['posted'], 'completed')) ? { ok: true } : { ok: false, error: '게시물이 등록된 신청만 완료할 수 있어요', status: 409 }),
  reject: async (_env, DB, a, b) => ((await transition(DB, a.id, ['pending'], 'admin_rejected', { admin_note: String(b.note ?? '').slice(0, 200) || null }))
    ? { ok: true } : { ok: false, error: '확인 대기 중인 신청만 반려할 수 있어요', status: 409 }),
}

seedingAdminRoutes.post('/applications/:id/:action', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    const act = ADMIN_ACTIONS[c.req.param('action') ?? '']
    if (!act) return c.json({ success: false, error: '모르는 동작이에요' }, 404)
    const a = await loadApp(DB, Number(c.req.param('id')))
    if (!a) return c.json({ success: false, error: '신청을 찾을 수 없어요' }, 404)
    const r = await act(c.env, DB, a, await c.req.json().catch(() => ({})))
    if (!r.ok) return c.json({ success: false, error: r.error }, r.status ?? 400)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '처리하지 못했어요', '[seeding:admin-action]')
  }
})

const SETTING_KEYS = ['seeding_auto_send_to_store', 'seeding_free_passes', 'seeding_pass_packages', 'seeding_pass_charge_enabled'] as const

seedingAdminRoutes.get('/settings', requireAdmin(), async (c) => {
  const DB = c.env.DB
  const vals = await Promise.all(SETTING_KEYS.map((k) => setting(DB, k)))
  const v = Object.fromEntries(SETTING_KEYS.map((k, i) => [k, vals[i]]))
  return c.json({
    success: true,
    data: {
      auto_send: v.seeding_auto_send_to_store === 'true',
      free_passes: v.seeding_free_passes ?? '3',
      packages: parsePassPackages(v.seeding_pass_packages),
      charge_enabled: v.seeding_pass_charge_enabled === 'true',
    },
  })
})

seedingAdminRoutes.put('/settings', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    const writes: Array<[string, string]> = []
    if (typeof b.auto_send === 'boolean') writes.push(['seeding_auto_send_to_store', b.auto_send ? 'true' : 'false'])
    if (b.free_passes !== undefined) {
      const n = Math.floor(Number(b.free_passes))
      if (!(n >= 0 && n <= 20)) return c.json({ success: false, error: '무료 횟수는 0~20 사이로 적어 주세요' }, 400)
      writes.push(['seeding_free_passes', String(n)])
    }
    if (typeof b.packages === 'string') {
      const parsed = parsePassPackages(b.packages)
      writes.push(['seeding_pass_packages', parsed.map((p) => `${p.passes}:${p.price}`).join(',')])
    }
    // ⚠️ 구매 스위치는 머니 경로다 — staging 실결제 확인 뒤에만 켤 것(결재).
    if (typeof b.charge_enabled === 'boolean') writes.push(['seeding_pass_charge_enabled', b.charge_enabled ? 'true' : 'false'])
    for (const [k, v] of writes) {
      await DB.prepare(`INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(k, v).run()
    }
    return c.json({ success: true, message: '저장했어요' })
  } catch (err) {
    return safeError(c, err, '설정을 저장하지 못했어요', '[seeding:admin-settings]')
  }
})
