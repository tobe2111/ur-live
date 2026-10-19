/**
 * 👤 주인이 자기 상품을 볼 때 — 판정 · 숫자 · 판매 중지 (2026-10-18 판정, 2026-10-19 관리 시트 "안 A").
 *
 * 대표: *"안 A로 해주고, 숙소 및 쇼핑 상품에도 관리하기를 넣자"*.
 * 상세 응답은 엣지 캐시라 사람마다 다른 답을 넣을 수 없어 따로 묻는다(`/products/*` 아래에 두면 그 캐시에 걸린다 —
 * 경로를 일부러 비켰다). 판정은 **구매 차단과 같은 함수**(`isSelfOwnedGroupBuy`)다 — 두 벌이면 버튼은 숨겼는데
 * 결제가 막히지 않거나, 반대로 남의 상품을 멈출 수 있는 날이 온다.
 *
 * 이용권·숙소·쇼핑 상품이 전부 `products` 한 테이블이라 엔드포인트는 하나다. 숫자만 종류마다 다르다.
 */
import type { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { swallow } from '@/worker/utils/swallow'
import { VOUCHER_CATEGORY_SET } from '@/shared/constants/voucher-categories'
import type { Env } from '@/worker/types/env'
import { isSelfOwnedGroupBuy } from './gb-purchase-guards'
import { invalidateGroupBuyProductsCache } from './cache-keys'

export type OwnedKind = 'pass' | 'stay' | 'product'

interface OwnedRow { seller_id: number | null; category: string | null; deal_only: number | null; is_active: number | null; status: string | null }

/** 결제 확정 뒤의 쇼핑 주문 상태 — 취소·환불·실패·대기는 판매로 세지 않는다. */
const PAID_ORDER = "('PAID','DONE','PREPARING','SHIPPING','DELIVERED')"

export function ownedKindOf(row: Pick<OwnedRow, 'category' | 'deal_only'>): OwnedKind {
  const cat = String(row.category || '')
  if (cat === 'stay_voucher') return 'stay'
  if (Number(row.deal_only) === 1 || VOUCHER_CATEGORY_SET.has(cat)) return 'pass'
  return 'product'
}

/** 판매·사용 수. 실패한 칸은 null(= 화면이 '—'로 그린다 — 0 으로 위장하지 않는다). */
export async function ownedStats(DB: D1Database, pid: number, kind: OwnedKind): Promise<{ sold: number | null; used: number | null }> {
  const one = async (sql: string) => {
    try { return await DB.prepare(sql).bind(pid).first<{ a: number | null; b: number | null }>() } catch { return null }
  }
  if (kind === 'product') {
    const r = await one(`SELECT COALESCE(SUM(oi.quantity),0) a, NULL b FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = ? AND o.status IN ${PAID_ORDER}`)
    return { sold: r ? Number(r.a ?? 0) : null, used: null }
  }
  const v = await one(`SELECT SUM(CASE WHEN status <> 'refunded' THEN 1 ELSE 0 END) a, SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) b
    FROM vouchers WHERE product_id = ?`)
  if (kind === 'pass') return { sold: v ? Number(v.a ?? 0) : null, used: v ? Number(v.b ?? 0) : null }
  // 숙소 — 날짜 예약(stay_bookings)과 기간 이용권(vouchers) 두 길로 팔린다. 둘을 더한다.
  const s = await one(`SELECT SUM(CASE WHEN status IN ('confirmed','checked_in','checked_out') THEN 1 ELSE 0 END) a,
    SUM(CASE WHEN status IN ('checked_in','checked_out') THEN 1 ELSE 0 END) b FROM stay_bookings WHERE product_id = ?`)
  if (!v && !s) return { sold: null, used: null }
  return { sold: Number(v?.a ?? 0) + Number(s?.a ?? 0), used: Number(v?.b ?? 0) + Number(s?.b ?? 0) }
}

async function readOwned(DB: D1Database, pid: number): Promise<OwnedRow | null> {
  return DB.prepare('SELECT seller_id, category, deal_only, is_active, status FROM products WHERE id = ?')
    .bind(pid).first<OwnedRow>().catch(() => null)
}

export function registerOwnerViewerEndpoints(router: Hono<{ Bindings: Env }>) {
  router.get('/viewer/:id', requireAuth(), async (c) => {
    const user = getCurrentUser(c)
    const pid = Number(c.req.param('id'))
    c.header('Cache-Control', 'private, no-store')
    if (!user || !Number.isInteger(pid) || pid <= 0) return c.json({ success: true, data: { is_owner: false } })
    const uid = await resolveUserIdString(c.env.DB, user.id, user.isDbId)
    const p = await readOwned(c.env.DB, pid)
    const isOwner = await isSelfOwnedGroupBuy(c.env.DB, p?.seller_id, uid)
    // 숫자는 **주인에게만** 준다 — 남의 판매량을 묻는 길이 되면 안 된다.
    if (!isOwner || !p) return c.json({ success: true, data: { is_owner: false } })
    const kind = ownedKindOf(p)
    return c.json({
      success: true,
      data: { is_owner: true, kind, is_active: Number(p.is_active) === 1, stats: await ownedStats(c.env.DB, pid, kind) },
    })
  })

  // 판매 중지 / 다시 판매 — 셀러 상품 수정(`PUT /api/seller/products/:id`)과 같은 값을 쓴다
  //   (`is_active` + `status` HIDDEN/ACTIVE). 삭제된 상품은 되살리지 않는다(복구는 셀러 화면의 일).
  router.post('/viewer/:id/active', requireAuth(), async (c) => {
    const user = getCurrentUser(c)
    const pid = Number(c.req.param('id'))
    c.header('Cache-Control', 'private, no-store')
    if (!user || !Number.isInteger(pid) || pid <= 0) return c.json({ success: false, error: '잘못된 상품입니다' }, 400)
    const body = await c.req.json<{ active?: unknown }>().catch(() => ({} as { active?: unknown }))
    if (typeof body.active !== 'boolean') return c.json({ success: false, error: 'active 값이 필요합니다' }, 400)
    const uid = await resolveUserIdString(c.env.DB, user.id, user.isDbId)
    const p = await readOwned(c.env.DB, pid)
    if (!p || !(await isSelfOwnedGroupBuy(c.env.DB, p.seller_id, uid))) {
      return c.json({ success: false, error: '내 가게 상품만 바꿀 수 있어요' }, 403)
    }
    const r = await c.env.DB.prepare(
      `UPDATE products SET is_active = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND COALESCE(status,'') <> 'DELETED'`,
    ).bind(body.active ? 1 : 0, body.active ? 'ACTIVE' : 'HIDDEN', pid).run()
    if (!r.meta.changes) return c.json({ success: false, error: '삭제된 상품은 여기서 바꿀 수 없어요' }, 409)
    if (VOUCHER_CATEGORY_SET.has(String(p.category || ''))) {
      invalidateGroupBuyProductsCache((c.env as unknown as { SESSION_KV?: KVNamespace }).SESSION_KV).catch(swallow('owner:cache-invalidate'))
      import('../../../worker/utils/group-buy-feed-invalidate').then((m) => m.invalidateGroupBuyFeed(c.env as unknown as Parameters<typeof m.invalidateGroupBuyFeed>[0], new URL(c.req.url).origin, (pr) => c.executionCtx?.waitUntil?.(pr))).catch(swallow('owner:feed-invalidate'))
    }
    return c.json({ success: true, data: { is_active: body.active } })
  })
}
