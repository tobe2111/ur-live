/**
 * 🏢 사장님이 매장 운영을 **에이전시에 맡기기 · 끊기** (에이전시 2단계, 2026-10-11)
 *   등록: `registerAgencyLinkRoutes(app, requireOwner)` — `seller-operators.routes` 의 `/api/seller` 아래.
 *
 *   GET  /agency-link       — 이 매장의 맡김 상태(요청 중 · 운영 중 · 없음)
 *   POST /agency-link       — 에이전시 관리자 이메일로 맡김 요청 { email }
 *   POST /agency-link/end   — 요청 취소 · 운영 끊기(조건 없이, 언제든)
 *   GET  /agency-link/activity — 에이전시가 이 매장에서 한 일 최근 50건
 *
 * 대표 결정(규칙 3): *"정해 둔 기간보단 그냥 매장 사장님이 중개사를 끊을 수 있어야"* → 기간 없음.
 *   끊으면 그 에이전시 직원 전원의 매장 좌석이 **다음 요청부터** 막힌다(`store-seat-guard`).
 *
 * 🔐 셋 다 **현재 매장의 소유자**만 — 운영자·에이전시 직원은 다른 대행을 부르거나 자를 수 없다.
 */
import type { Context, Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { buildSystemEmailHtml, sendSystemEmail } from '@/lib/system-email'
import { ensureAgencyConsoleTables } from '../../agency-console/api/agency-schema'
import { frontendBase, normalizeEmail } from '../../agency-console/api/agency-auth.routes'

type Ctx = Context<{ Bindings: Env }>
type RequireOwner = (c: Ctx) => Promise<{ userId: number; sellerId: number } | Response>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function readLink(DB: D1Database, sellerId: number) {
  return DB.prepare(
    `SELECT l.id, l.status, l.created_at, l.accepted_at, a.name AS agency_name
       FROM agency_store_links l JOIN agency_accounts a ON a.id = l.agency_id
      WHERE l.seller_id = ? AND l.status IN ('pending','active')
      ORDER BY l.id DESC LIMIT 1`,
  ).bind(sellerId).first<{ id: number; status: string; created_at: string; accepted_at: string | null; agency_name: string }>()
}

export function registerAgencyLinkRoutes(app: Hono<{ Bindings: Env }>, requireOwner: RequireOwner): void {
  app.get('/agency-link', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      await ensureAgencyConsoleTables(c.env.DB)
      const l = await readLink(c.env.DB, g.sellerId)
      return c.json({
        success: true,
        data: l ? {
          status: l.status === 'active' ? 'active' : 'pending',
          agencyName: l.agency_name, requestedAt: l.created_at, acceptedAt: l.accepted_at,
        } : null,
      })
    } catch (err) {
      return safeError(c, err, '에이전시 상태를 불러오지 못했어요', '[seller-agency-link]')
    }
  })

  app.post('/agency-link', rateLimit({ action: 'seller_agency_link', max: 10, windowSec: 3600 }), async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }))
      const email = normalizeEmail(body.email)
      if (!EMAIL_RE.test(email) || email.length > 254) return c.json({ success: false, error: '이메일 형식을 확인해 주세요.' }, 400)
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      // 에이전시 **관리자** 이메일로만 찾는다 — 직원 이메일로 요청이 엉뚱한 곳에 가지 않게.
      const agency = await DB.prepare(
        `SELECT a.id, a.name FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id
          WHERE LOWER(s.email) = ? AND s.role = 'admin' AND s.status = 'active' AND a.status = 'active' LIMIT 1`,
      ).bind(email).first<{ id: number; name: string }>()
      if (!agency) {
        return c.json({ success: false, code: 'AGENCY_NOT_FOUND', error: '이 이메일의 에이전시 관리자를 찾지 못했어요. 에이전시에 가입한 이메일인지 확인해 주세요.' }, 404)
      }
      // 한 매장은 한 에이전시에만 — 부분 UNIQUE 인덱스가 동시 요청까지 막는다.
      const ins = await DB.prepare(
        "INSERT OR IGNORE INTO agency_store_links (agency_id, seller_id, status, requested_by_user_id) VALUES (?, ?, 'pending', ?)",
      ).bind(agency.id, g.sellerId, g.userId).run()
      if ((ins.meta?.changes ?? 0) === 0) {
        return c.json({ success: false, code: 'ALREADY_LINKED', error: '이미 맡긴(또는 요청 중인) 에이전시가 있어요. 먼저 끊고 다시 요청해 주세요.' }, 409)
      }
      const store = await DB.prepare('SELECT business_name, name FROM sellers WHERE id = ? LIMIT 1')
        .bind(g.sellerId).first<{ business_name: string | null; name: string | null }>()
      const storeName = store?.business_name || store?.name || '매장'
      // 알림 메일은 덤이다 — 콘솔 '맡은 매장' 에 요청이 바로 뜬다. 메일이 안 나가도 요청은 산다.
      const { results: admins } = await DB.prepare(
        "SELECT email FROM agency_staff WHERE agency_id = ? AND role = 'admin' AND status = 'active' LIMIT 10",
      ).bind(agency.id).all<{ email: string }>()
      for (const a of admins || []) {
        await sendSystemEmail(c.env, a.email, {
          subject: `[유어딜] ${storeName} 사장님이 매장 운영을 맡기셨어요`,
          html: buildSystemEmailHtml({
            title: `${storeName} 운영 요청`, greeting: '안녕하세요.',
            body: `${storeName} 사장님이 ${agency.name} 에이전시에 매장 운영을 맡기셨어요.\n에이전시 화면에서 수락하면 직원 누구나 이 매장을 운영할 수 있어요.`,
            actionLabel: '요청 보기', actionUrl: `${frontendBase(c.env)}/agency`,
          }),
        }, { ignorePreference: true }).catch(() => {})
      }
      return c.json({ success: true, message: `${agency.name} 에이전시에 요청했어요. 수락하면 알려 드릴게요.`, data: { agencyName: agency.name } })
    } catch (err) {
      return safeError(c, err, '요청 중 오류가 발생했어요', '[seller-agency-link]')
    }
  })

  // 📝 에이전시가 이 매장에서 한 일 — 최근 50건(누가·언제·무엇). 끊은 뒤에도 기록은 남는다(분쟁 근거).
  app.get('/agency-link/activity', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      await ensureAgencyConsoleTables(c.env.DB)
      const { results } = await c.env.DB.prepare(
        `SELECT x.id, x.label, x.created_at, a.name AS agency_name, s.name AS staff_name, s.email AS staff_email
           FROM agency_store_activity x
           JOIN agency_accounts a ON a.id = x.agency_id
           LEFT JOIN agency_staff s ON s.id = x.staff_id
          WHERE x.seller_id = ?
          ORDER BY x.id DESC LIMIT 50`,
      ).bind(g.sellerId).all<{ id: number; label: string; created_at: string; agency_name: string; staff_name: string | null; staff_email: string | null }>()
      return c.json({
        success: true,
        data: (results || []).map((r) => ({
          id: r.id, label: r.label, at: r.created_at, agencyName: r.agency_name,
          staff: r.staff_name || (r.staff_email ? r.staff_email.split('@')[0] : '직원'),
        })),
      })
    } catch (err) {
      return safeError(c, err, '활동 기록을 불러오지 못했어요', '[seller-agency-link]')
    }
  })

  app.post('/agency-link/end', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      const r = await DB.prepare(
        `UPDATE agency_store_links
            SET status = 'ended', ended_at = datetime('now'), ended_by = 'owner', ended_by_id = ?, updated_at = datetime('now')
          WHERE seller_id = ? AND status IN ('pending','active')`,
      ).bind(g.userId, g.sellerId).run()
      if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '맡긴 에이전시가 없어요.' }, 404)
      invalidateStoreSeatCache(DB, g.sellerId)
      return c.json({ success: true, message: '끊었어요. 에이전시는 지금부터 이 매장에 들어올 수 없어요.' })
    } catch (err) {
      return safeError(c, err, '처리 중 오류가 발생했어요', '[seller-agency-link]')
    }
  })
}
