/**
 * 💸 에이전시 몫 지급 — 에이전시 쪽(잔액·신청) + 어드민 쪽(지급 처리·옛 중개 매장 이전) (2026-11-01)
 *   로직 SSOT: `@/worker/utils/agency-share-payout`. 게이트 `agency_share_payout_enabled` 기본 OFF.
 *   마운트(워커 무수정): 에이전시 = `registerAgencyPayoutRoutes(agencyStoresRoutes)` → `/api/agency-console/payouts*`
 *                         어드민 = `registerAdminAgencyPayoutRoutes(agencyAdminRoutes)` → `/api/admin/agency-payouts*`
 *
 * ## 옛 중개 매장 이전(결재 3단계 ①, 2026-11-01 `AskUserQuestion` "대표 계정을 에이전시로")
 *   중개사(카카오 유저)의 매장들을 그 사람의 에이전시로 옮긴다. **dry_run 기본** — 실행은 `dry_run:false` 를 명시할 때만.
 *   ① 그 유저에 이어진 에이전시가 없으면 카카오 에이전시를 만든다(혼자 쓰는 계정 — `/kakao/create` 와 같은 모양)
 *   ② 매장마다 맡김 active · 이용권 전부 그 에이전시가 맡음(기간 시작) · `broker_share_pct` → `agency_share_terms`
 *   ③ 실행 전 `seller_operators` · `seller_meta`(중개 키) 를 `agency_migration_snapshots` 에 남긴다(롤백 근거).
 *   🔒 옛 중개 좌석과 `broker_*` 메타는 **지우지 않는다** — 에이전시 몫이 붙는 판매엔 중개사 몫이 안 붙으므로
 *      이중으로 떼이지 않는다(`creditBrokerShare` 의 `matched`). 되돌리기 = 맡김을 끊는 것 하나.
 */
import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import { safeError } from '@/worker/utils/safe-error'
import { kakaoStaffEmail } from '@/shared/agency-kakao'
import { ensureAgencyConsoleTables } from './agency-schema'
import { requireAgencyStaff } from './agency-session'
import { setAgencyShare, validateSharePct } from './agency-share'
import { startAgencyProduct } from './channel-sales'
import {
  ensureAgencyShareTables, isAgencySharePayoutEnabled, markAgencyPayoutPaid, readAgencyShareBalance,
  rejectAgencyPayout, requestAgencyPayout, AGENCY_PAYOUT_MIN,
} from '@/worker/utils/agency-share-payout'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHono = Hono<any>

export function registerAgencyPayoutRoutes(app: AnyHono): void {
  app.get('/payouts', requireAgencyStaff(), async (c) => {
    try {
      const me = c.get('agencyStaff') as { agencyId: number }
      const DB = c.env.DB as D1Database
      const enabled = await isAgencySharePayoutEnabled(DB)
      if (!enabled) return c.json({ success: true, enabled: false, balance: null, payouts: [] })
      await ensureAgencyShareTables(DB)
      const balance = await readAgencyShareBalance(DB, me.agencyId)
      const { results } = await DB.prepare(
        `SELECT id, gross_amount, withholding_amount, net_amount, tax_mode, status, created_at, paid_at
           FROM agency_share_payouts WHERE agency_id = ? AND status != 'rejected' ORDER BY id DESC LIMIT 50`,
      ).bind(me.agencyId).all()
      return c.json({ success: true, enabled: true, minAmount: AGENCY_PAYOUT_MIN, balance, payouts: results || [] })
    } catch (err) {
      return safeError(c, err, '정산 내역을 불러오지 못했어요', '[agency-console:payouts]')
    }
  })

  // 지급 신청은 관리자만 — 회사 돈이다.
  app.post('/payouts/request', cors(), requireAgencyStaff({ adminOnly: true }), async (c) => {
    try {
      const me = c.get('agencyStaff') as { agencyId: number; staffId: number }
      const r = await requestAgencyPayout(c.env.DB as D1Database, me.agencyId, me.staffId ?? null)
      return r.ok ? c.json({ success: true, ...r }) : c.json({ success: false, error: r.error }, 400)
    } catch (err) {
      return safeError(c, err, '지급 신청 중 오류가 발생했어요', '[agency-console:payouts:request]')
    }
  })
}

const posInt = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null }

export function registerAdminAgencyPayoutRoutes(app: AnyHono): void {
  app.get('/agency-payouts', async (c) => {
    try {
      const DB = c.env.DB as D1Database
      await ensureAgencyConsoleTables(DB)
      await ensureAgencyShareTables(DB)
      const { results } = await DB.prepare(
        `SELECT p.id, p.agency_id, a.name AS agency_name, a.kind, a.business_number, p.gross_amount, p.withholding_amount,
                p.net_amount, p.tax_mode, p.status, p.created_at, p.paid_at, p.memo
           FROM agency_share_payouts p LEFT JOIN agency_accounts a ON a.id = p.agency_id
          ORDER BY CASE p.status WHEN 'requested' THEN 0 ELSE 1 END, p.id DESC LIMIT 200`,
      ).all()
      return c.json({ success: true, enabled: await isAgencySharePayoutEnabled(DB), data: results || [] })
    } catch (err) {
      return safeError(c, err, '에이전시 지급 목록을 불러오지 못했어요', '[admin:agency-payouts]')
    }
  })

  app.post('/agency-payouts/:id/paid', async (c) => {
    try {
      const id = posInt(c.req.param('id'))
      if (!id) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
      const body = await c.req.json<{ memo?: string }>().catch(() => ({} as { memo?: string }))
      const admin = c.get('user') as { id?: number } | undefined
      const ok = await markAgencyPayoutPaid(c.env.DB as D1Database, id, Number(admin?.id) || 0, (body.memo || '').slice(0, 200) || undefined)
      return ok ? c.json({ success: true }) : c.json({ success: false, error: '이미 처리된 신청이에요.' }, 409)
    } catch (err) {
      return safeError(c, err, '지급 처리 중 오류가 발생했어요', '[admin:agency-payouts:paid]')
    }
  })

  app.post('/agency-payouts/:id/reject', async (c) => {
    try {
      const id = posInt(c.req.param('id'))
      if (!id) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
      const body = await c.req.json<{ memo?: string }>().catch(() => ({} as { memo?: string }))
      const admin = c.get('user') as { id?: number } | undefined
      const ok = await rejectAgencyPayout(c.env.DB as D1Database, id, Number(admin?.id) || 0, (body.memo || '').slice(0, 200) || undefined)
      return ok ? c.json({ success: true }) : c.json({ success: false, error: '이미 처리된 신청이에요.' }, 409)
    } catch (err) {
      return safeError(c, err, '반려 처리 중 오류가 발생했어요', '[admin:agency-payouts:reject]')
    }
  })

  app.post('/agency-accounts/migrate-broker', async (c) => {
    try {
      const DB = c.env.DB as D1Database
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
      const brokerUserId = posInt(body.broker_user_id)
      const dryRun = body.dry_run !== false
      if (!brokerUserId) return c.json({ success: false, error: 'broker_user_id 가 필요해요.' }, 400)
      const r = await migrateBrokerStores(DB, {
        brokerUserId, dryRun,
        agencyName: typeof body.agency_name === 'string' ? body.agency_name.trim().slice(0, 40) : '',
        kind: body.kind === 'business' ? 'business' : 'individual',
        adminId: Number((c.get('user') as { id?: number } | undefined)?.id) || null,
      })
      return r.ok ? c.json({ success: true, dryRun, ...r }) : c.json({ success: false, error: r.error }, 400)
    } catch (err) {
      return safeError(c, err, '매장 이전 중 오류가 발생했어요', '[admin:agency-migrate-broker]')
    }
  })
}

export interface MigrationStorePlan { sellerId: number; sharePct: number; productIds: number[]; alreadyLinked: boolean }

/** 옛 중개 매장 → 에이전시. 순서·멱등이 시험 대상이라 함수로 뺐다. */
export async function migrateBrokerStores(DB: D1Database, p: {
  brokerUserId: number; dryRun: boolean; agencyName: string; kind: 'business' | 'individual'; adminId: number | null
}): Promise<{ ok: true; agencyId: number | null; created: boolean; stores: MigrationStorePlan[] } | { ok: false; error: string }> {
  await ensureAgencyConsoleTables(DB)
  // 이 사람이 지금 좌석을 가진(회수 안 된) 중개 매장만 — 회수된 매장을 되살리지 않는다.
  const { results: rows } = await DB.prepare(
    `SELECT m.seller_id AS seller_id,
            (SELECT value FROM seller_meta x WHERE x.seller_id = m.seller_id AND x.key = 'broker_share_pct') AS pct
       FROM seller_meta m
       JOIN seller_operators o ON o.seller_id = m.seller_id AND o.user_id = ? AND o.revoked_at IS NULL
      WHERE m.key = 'broker_user_id' AND m.value = ?`,
  ).bind(p.brokerUserId, String(p.brokerUserId)).all<{ seller_id: number; pct: string | null }>()
  if (!rows?.length) return { ok: false, error: '이 사람이 맡은 중개 매장이 없어요.' }

  const existing = await DB.prepare(
    `SELECT s.agency_id AS id FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id
      WHERE s.user_id = ? AND s.status = 'active' AND a.status = 'active' LIMIT 1`,
  ).bind(p.brokerUserId).first<{ id: number }>().catch(() => null)
  let agencyId: number | null = existing?.id ?? null

  const stores: MigrationStorePlan[] = []
  for (const r of rows) {
    const sellerId = Number(r.seller_id)
    const { results: prods } = await DB.prepare('SELECT id FROM products WHERE seller_id = ? AND COALESCE(is_active, 1) = 1')
      .bind(sellerId).all<{ id: number }>()
    const linked = agencyId
      ? !!(await DB.prepare("SELECT 1 FROM agency_store_links WHERE seller_id = ? AND agency_id = ? AND status = 'active'")
          .bind(sellerId, agencyId).first().catch(() => null))
      : false
    const pct = validateSharePct(Number(r.pct) || 0)
    stores.push({ sellerId, sharePct: pct.ok ? pct.pct : 0, productIds: (prods || []).map((x) => Number(x.id)), alreadyLinked: linked })
  }
  if (p.dryRun) return { ok: true, agencyId, created: false, stores }

  let created = false
  if (!agencyId) {
    if (!p.agencyName) return { ok: false, error: '에이전시 이름(agency_name)을 적어 주세요.' }
    const u = await DB.prepare('SELECT name FROM users WHERE id = ? LIMIT 1').bind(p.brokerUserId).first<{ name: string | null }>()
    const acc = await DB.prepare("INSERT INTO agency_accounts (name, kind, status) VALUES (?, ?, 'active')").bind(p.agencyName, p.kind).run()
    agencyId = Number(acc.meta?.last_row_id)
    await DB.prepare(
      "INSERT INTO agency_staff (agency_id, email, name, role, is_owner, status, user_id) VALUES (?, ?, ?, 'admin', 1, 'active', ?)",
    ).bind(agencyId, kakaoStaffEmail(p.brokerUserId), (u?.name || '').slice(0, 40) || null, p.brokerUserId).run()
    created = true
  }

  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_migration_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, agency_id INTEGER NOT NULL,
    broker_user_id INTEGER NOT NULL, snapshot TEXT NOT NULL, admin_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`).run()

  for (const s of stores) {
    if (s.alreadyLinked) continue // 멱등 — 두 번 눌러도 기간·% 를 겹쳐 쓰지 않는다
    const ops = await DB.prepare('SELECT user_id, role, revoked_at FROM seller_operators WHERE seller_id = ?').bind(s.sellerId).all()
    const meta = await DB.prepare("SELECT key, value FROM seller_meta WHERE seller_id = ? AND key IN ('broker_user_id','broker_share_pct','influencer_pct_cap','store_channel')")
      .bind(s.sellerId).all()
    await DB.prepare('INSERT INTO agency_migration_snapshots (seller_id, agency_id, broker_user_id, snapshot, admin_id) VALUES (?, ?, ?, ?, ?)')
      .bind(s.sellerId, agencyId, p.brokerUserId, JSON.stringify({ operators: ops.results || [], meta: meta.results || [] }), p.adminId).run()
    await DB.prepare(
      `INSERT OR IGNORE INTO agency_store_links (agency_id, seller_id, status, requested_by_user_id, accepted_at)
       VALUES (?, ?, 'active', ?, datetime('now'))`,
    ).bind(agencyId, s.sellerId, p.brokerUserId).run()
    for (const pid of s.productIds) await startAgencyProduct(DB, pid, s.sellerId, agencyId!, null)
    if (s.sharePct > 0) await setAgencyShare(DB, s.sellerId, agencyId!, s.sharePct, p.adminId)
  }
  return { ok: true, agencyId, created, stores }
}
