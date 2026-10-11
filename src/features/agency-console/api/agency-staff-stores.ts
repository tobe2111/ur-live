/**
 * 👥 에이전시 직원별 매장 배정 — 2026-10-11 대표 *"계속 해줘"* (에이전시 2단계의 남은 머니 무관 항목).
 *   `agency-stores.routes.ts` 가 `registerStaffStoreRoutes(agencyStoresRoutes)` 로 얹는다(마운트 추가 없음).
 *
 * ## 무엇을 하나
 *   관리자가 직원마다 **"맡은 매장 전부"** 또는 **"배정한 매장만"** 을 고른다.
 *   기본은 전부(= 이 기능 전의 동작) — 아무것도 안 고르면 오늘과 똑같다.
 *
 * ## 🔐 판정은 한 문장
 *   좌석 발급(`/stores/:id/seat`) · 매 요청 판정(`liveAgencySeat`) · 목록(`GET /stores`)이 모두
 *   `staffStoreAccessSql` 하나를 쓴다. 배정에서 빼면 그 직원이 열어 둔 매장 화면도 **다음 요청부터** 막힌다.
 *
 * ## 정하지 않은 것
 *   - 관리자에게는 배정을 걸 수 없다 — 관리자는 정산·직원·조건을 다루므로 매장을 가리면 일이 안 된다.
 *   - 돈은 안 움직인다.
 */
import type { Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { safeError } from '@/worker/utils/safe-error'
import { invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables, type StaffStoreScope } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }
type Ctx = Context<{ Bindings: Bindings; Variables: Vars }>

/** 한 번에 배정할 수 있는 매장 수 — 목록 상한(200)과 같다. */
export const STAFF_STORE_MAX = 200

/** 본문을 읽어 범위와 매장 id 목록으로 — 실패면 사람이 읽을 문장. 같은 id 는 한 번만 센다. */
export function parseStaffStoreBody(b: unknown): { scope: StaffStoreScope; sellerIds: number[] } | { error: string } {
  const o = (b && typeof b === 'object' ? b : {}) as { scope?: unknown; sellerIds?: unknown }
  if (o.scope !== 'all' && o.scope !== 'assigned') return { error: '범위를 골라 주세요.' }
  if (o.scope === 'all') return { scope: 'all', sellerIds: [] }
  if (!Array.isArray(o.sellerIds)) return { error: '배정할 매장을 골라 주세요.' }
  const ids = [...new Set(o.sellerIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
  if (ids.length === 0) return { error: '배정할 매장을 하나 이상 골라 주세요.' }
  if (ids.length > STAFF_STORE_MAX) return { error: `한 번에 ${STAFF_STORE_MAX}곳까지 배정할 수 있어요.` }
  return { scope: 'assigned', sellerIds: ids }
}

async function loadTarget(c: Ctx) {
  const me = c.get('agencyStaff')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return null
  return c.env.DB.prepare(
    "SELECT id, role, store_scope FROM agency_staff WHERE id = ? AND agency_id = ? AND status IN ('active','invited') LIMIT 1",
  ).bind(id, me.agencyId).first<{ id: number; role: string; store_scope: string | null }>()
}

export function registerStaffStoreRoutes(app: Hono<{ Bindings: Bindings; Variables: Vars }>) {
  // ── 지금 배정 보기 (관리자) ───────────────────────────────────────────────
  app.get('/staff/:id/stores', requireAgencyStaff({ adminOnly: true }), async (c: Ctx) => {
    try {
      const me = c.get('agencyStaff')
      await ensureAgencyConsoleTables(c.env.DB)
      const t = await loadTarget(c)
      if (!t) return c.json({ success: false, error: '직원을 찾을 수 없어요.' }, 404)
      if (t.role === 'admin') return c.json({ success: true, scope: 'all', sellerIds: [], adminAlwaysAll: true })
      const { results } = await c.env.DB.prepare(
        'SELECT seller_id FROM agency_staff_stores WHERE staff_id = ? AND agency_id = ? ORDER BY seller_id',
      ).bind(t.id, me.agencyId).all<{ seller_id: number }>()
      return c.json({
        success: true,
        scope: t.store_scope === 'assigned' ? 'assigned' : 'all',
        sellerIds: (results || []).map((r) => r.seller_id),
      })
    } catch (err) {
      return safeError(c, err, '배정을 불러오지 못했어요', '[agency-console:staff-stores]')
    }
  })

  // ── 배정 바꾸기 (관리자) — 통째로 교체한다 ──────────────────────────────────
  app.put('/staff/:id/stores', cors(), requireAgencyStaff({ adminOnly: true }), async (c: Ctx) => {
    try {
      const me = c.get('agencyStaff')
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      const parsed = parseStaffStoreBody(await c.req.json().catch(() => null))
      if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400)
      const t = await loadTarget(c)
      if (!t) return c.json({ success: false, error: '직원을 찾을 수 없어요.' }, 404)
      if (t.role === 'admin') return c.json({ success: false, error: '관리자는 언제나 맡은 매장 전부를 볼 수 있어요.' }, 400)

      if (parsed.scope === 'assigned') {
        // 🔐 우리 에이전시가 지금 맡고 있는 매장만 — 남의 매장 id 를 넣어 두었다가 나중에 열리는 길을 막는다.
        const marks = parsed.sellerIds.map(() => '?').join(',')
        const { results } = await DB.prepare(
          `SELECT seller_id FROM agency_store_links WHERE agency_id = ? AND status = 'active' AND seller_id IN (${marks})`,
        ).bind(me.agencyId, ...parsed.sellerIds).all<{ seller_id: number }>()
        const ok = new Set((results || []).map((r) => r.seller_id))
        if (parsed.sellerIds.some((id) => !ok.has(id))) {
          return c.json({ success: false, error: '우리 에이전시가 운영 중인 매장만 배정할 수 있어요.' }, 400)
        }
      }

      await DB.batch([
        DB.prepare('DELETE FROM agency_staff_stores WHERE staff_id = ? AND agency_id = ?').bind(t.id, me.agencyId),
        ...parsed.sellerIds.map((sid) => DB.prepare(
          'INSERT OR IGNORE INTO agency_staff_stores (agency_id, staff_id, seller_id, created_by_staff_id) VALUES (?, ?, ?, ?)',
        ).bind(me.agencyId, t.id, sid, me.staffId)),
        DB.prepare("UPDATE agency_staff SET store_scope = ?, updated_at = datetime('now') WHERE id = ? AND agency_id = ?")
          .bind(parsed.scope, t.id, me.agencyId),
      ])
      // 배정에서 빠진 매장 화면은 지금 끊는다(같은 isolate 즉시 · 다른 isolate 는 15초 안에).
      invalidateStoreSeatCache(DB)
      return c.json({
        success: true,
        scope: parsed.scope,
        sellerIds: parsed.sellerIds,
        message: parsed.scope === 'all' ? '맡은 매장 전부에 들어갈 수 있게 했어요.' : `매장 ${parsed.sellerIds.length}곳을 배정했어요.`,
      })
    } catch (err) {
      return safeError(c, err, '배정을 바꾸지 못했어요', '[agency-console:staff-stores]')
    }
  })
}
