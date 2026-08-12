/**
 * 🎟️ 공구 엔진 어드민 조종석 (2026-07-14, STEP 2 선결 — gap A1 해소).
 *   상품별 gb_mode(off/scheduled/live/ended)·gb_price·gb_deadline·gb_promo_pct·gb_link_only 설정 UI 의 백엔드.
 *   저장 = product_supply_meta 의 gb_* 키(컬럼 예산 준수), 로직 SSOT = shared/gb-session.ts(saveGbSession/validateGbSession).
 *   🔴 **2026-08-11 정정 — 공구가는 게이트 뒤가 아니다.** 여기 적혀 있던 *"게이트 OFF 면 저장돼도
 *      소비자/결제엔 무영향"* 은 **사실이 아니었다**: `order.routes` 가 저장값을 곧바로 청구 단가로 쓴다
 *      (2026-07-29 배선). `gb_engine_enabled` 가 가리는 것은 **마켓플레이스/소개비 표면**이고,
 *      공구가를 되돌리는 손잡이는 `gb_pricing_enabled`(기본 ON, `'false'` 로 끔) 다.
 *   ⚠️ 머니 무접촉: gb 설정값만 기록. 결제/정산/커미션/net==5% 로직 전부 무변경.
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import { requireAdmin } from '../../../worker/middleware/auth'
import { intParam } from '../../../shared/pagination'
import { getGbSession, getGbSessions, saveGbSession } from '../../../worker/utils/gb-session-store'
import { validateGbSession, resolveGbStatus, type GbSession, type GbMode } from '../../../shared/gb-session'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

const MODES: readonly GbMode[] = ['off', 'scheduled', 'live', 'ended']

async function gbEngineOn(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'gb_engine_enabled'")
    .first<{ value: string }>().catch(() => null)
  return row?.value === 'true'
}

// GET /api/admin/gb-cockpit/products?q=&limit= — 상품 검색 + 현재 gb 세션 enrich
app.get('/products', async (c) => {
  const db = c.env.DB
  const q = (c.req.query('q') || '').trim().slice(0, 60)
  const limit = Math.min(100, Math.max(1, intParam(c.req.query('limit'), 40)))
  const cols = 'id, name, price, original_price, category, seller_id, restaurant_name, is_active'
  const rows = q
    ? await db.prepare(`SELECT ${cols} FROM products WHERE is_active = 1 AND (name LIKE ? OR restaurant_name LIKE ?) ORDER BY id DESC LIMIT ?`)
        .bind(`%${q}%`, `%${q}%`, limit).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
    : await db.prepare(`SELECT ${cols} FROM products WHERE is_active = 1 ORDER BY id DESC LIMIT ?`)
        .bind(limit).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
  const list = rows.results || []
  const ids = list.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
  const sessions = await getGbSessions(db, ids)
  const nowMs = Date.now()
  const data = list.map((r) => {
    const s = sessions.get(Number(r.id)) || ({ mode: 'off' } as GbSession)
    return { ...r, gb: s, gb_effective_status: resolveGbStatus(s, nowMs) }
  })
  return c.json({ success: true, gb_engine: await gbEngineOn(db), data })
})

// GET /api/admin/gb-cockpit/products/:id — 단일 상품 + gb 세션
app.get('/products/:id', async (c) => {
  const db = c.env.DB
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  const p = await db.prepare('SELECT id, name, price, original_price, category, seller_id, restaurant_name FROM products WHERE id = ?')
    .bind(id).first<Record<string, unknown>>().catch(() => null)
  if (!p) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
  const s = await getGbSession(db, id)
  return c.json({ success: true, gb_engine: await gbEngineOn(db), product: p, gb: s, gb_effective_status: resolveGbStatus(s, Date.now()) })
})

// PUT /api/admin/gb-cockpit/products/:id — gb 설정 저장(서버 검증 후 upsert)
app.put('/products/:id', async (c) => {
  const db = c.env.DB
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  const p = await db.prepare('SELECT id, price FROM products WHERE id = ? AND is_active = 1')
    .bind(id).first<{ id: number; price: number }>().catch(() => null)
  if (!p) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const rawMode = String(b.mode || 'off')
  const mode: GbMode = MODES.includes(rawMode as GbMode) ? (rawMode as GbMode) : 'off'
  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const session: GbSession = {
    mode,
    startAt: typeof b.startAt === 'string' && b.startAt ? b.startAt : null,
    deadline: typeof b.deadline === 'string' && b.deadline ? b.deadline : null,
    target: numOrNull(b.target),
    price: numOrNull(b.price),
    promoPct: numOrNull(b.promoPct),
    linkOnly: b.linkOnly === true || b.linkOnly === '1' || b.linkOnly === 1,
  }
  // 서버 권위 검증(SSOT) — 공구 특가 < 상시가, promo 0~50, 마감 필수·시작 이후.
  const v = validateGbSession(session, Number(p.price))
  if (!v.ok) return c.json({ success: false, error: v.error || '설정값을 확인해주세요' }, 400)

  try {
    await saveGbSession(db, id, session) // gbSessionToMeta → product_supply_meta upsert(off 는 나머지 키 청소)
  } catch {
    return c.json({ success: false, error: '저장 실패' }, 500)
  }
  return c.json({ success: true, gb: session, gb_effective_status: resolveGbStatus(session, Date.now()) })
})

export const gbCockpitRoutes = app
