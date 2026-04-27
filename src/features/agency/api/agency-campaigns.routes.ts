/**
 * Agency Campaigns Routes (Agency P0 #4)
 *
 * 에이전시가 직접 캠페인(이벤트)을 생성/관리하고, 참여 셀러별 KPI/보너스를 설정.
 * 마이그레이션: 0209_agency_campaigns.sql
 *
 * 마운트: /api/agency/campaigns
 *
 * Endpoints:
 *   GET    /                       — 캠페인 목록 (status 필터)
 *   POST   /                       — 캠페인 생성
 *   GET    /:id                    — 캠페인 상세 (참여 셀러 포함)
 *   PATCH  /:id                    — 캠페인 수정 (이름/기간/인센티브율)
 *   POST   /:id/cancel             — 캠페인 취소
 *   POST   /:id/participants       — 셀러 참여 추가 (배열)
 *   DELETE /:id/participants/:sid  — 셀러 참여 제거
 *   PATCH  /:id/participants/:sid  — 셀러 KPI/보너스 수정
 *   POST   /:id/refresh            — 누적 매출 강제 재집계 (cron 외 수동 트리거)
 *
 * 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #4)
 */

import { Hono, type Next } from 'hono'
import { verify } from 'hono/jwt'
import { parseSessionCookie } from '@/worker/utils/session'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'
import { requireAgencyPermission } from './agency-role-guard'

type AgencyCtx = {
  Bindings: Env
  Variables: { agency: { id: number; name?: string; email?: string } }
}

const app = new Hono<AgencyCtx>()

// ── auth (agency.routes 와 동일 로직; sub-app 은 부모 미들웨어 상속 안 됨) ──
function getBearerToken(h?: string | null): string | null {
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch {
    return null
  }
}

const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '')
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) {
        payload = { id: Number(sess.userId), email: sess.email || '' }
      }
    } catch { /* cookie parse failure */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

app.use('*', requireAgency)

interface CampaignRow {
  id: number
  agency_id: number
  name: string
  description: string | null
  start_date: string
  end_date: string
  status: string
  base_incentive_rate: number | null
  target_amount: number | null
  category: string | null
  created_at: string
  updated_at: string
}

interface ParticipantRow {
  id: number
  campaign_id: number
  seller_id: number
  target_amount: number | null
  bonus_rate: number | null
  status: string
  current_amount: number
  current_orders: number
  last_aggregated_at: string | null
  joined_at: string
  // joined
  seller_name?: string
  seller_email?: string
}

// ── helpers ─────────────────────────────────────────────────
async function loadOwnedCampaign(
  db: D1Database,
  agencyId: number,
  campaignId: number,
): Promise<CampaignRow | null> {
  return await db
    .prepare('SELECT * FROM agency_campaigns WHERE id = ? AND agency_id = ?')
    .bind(campaignId, agencyId)
    .first<CampaignRow>()
}

async function recomputeParticipants(
  db: D1Database,
  campaign: CampaignRow,
): Promise<void> {
  // 캠페인 기간 동안의 PAID/DONE 주문을 셀러별 집계 후 participants 테이블에 반영
  const { results: rows } = await db.prepare(`
    SELECT o.seller_id,
           COUNT(*) AS order_count,
           COALESCE(SUM(o.total_amount), 0) AS revenue
    FROM orders o
    INNER JOIN agency_campaign_participants p
      ON p.seller_id = o.seller_id AND p.campaign_id = ?
    WHERE o.status IN ('PAID','DONE')
      AND date(o.created_at) BETWEEN date(?) AND date(?)
    GROUP BY o.seller_id
  `).bind(campaign.id, campaign.start_date, campaign.end_date).all<{
    seller_id: number; order_count: number; revenue: number
  }>()

  const now = new Date().toISOString()
  for (const row of (rows || [])) {
    await db.prepare(`
      UPDATE agency_campaign_participants
      SET current_amount = ?, current_orders = ?, last_aggregated_at = ?
      WHERE campaign_id = ? AND seller_id = ?
    `).bind(row.revenue, row.order_count, now, campaign.id, row.seller_id).run()
  }
}

// ── GET / — 캠페인 목록 ────────────────────────────────────
app.get('/', async (c) => {
  const agencyId = c.get('agency').id
  const status = c.req.query('status') || 'all'
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)

  let where = 'agency_id = ?'
  const binds: unknown[] = [agencyId]
  if (status !== 'all') {
    where += ' AND status = ?'
    binds.push(status)
  }
  binds.push(limit)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM agency_campaign_participants p WHERE p.campaign_id = c.id AND p.status='active') AS participant_count,
        (SELECT COALESCE(SUM(p.current_amount), 0) FROM agency_campaign_participants p WHERE p.campaign_id = c.id) AS total_revenue
      FROM agency_campaigns c
      WHERE ${where}
      ORDER BY c.start_date DESC
      LIMIT ?
    `).bind(...binds).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    // 마이그레이션 0209 미적용
    return c.json({ success: false, error: 'campaigns 테이블 미존재 — migration 0209 필요', data: [] })
  }
})

// ── POST / — 캠페인 생성 ───────────────────────────────────
// 🛡️ 2026-04-27: campaign 권한 필요 (agent/analyst 차단)
app.post('/', requireAgencyPermission('campaign'), async (c) => {
  const agencyId = c.get('agency').id
  const body = await c.req.json<{
    name: string
    description?: string
    start_date: string  // YYYY-MM-DD
    end_date: string
    base_incentive_rate?: number
    target_amount?: number
    category?: string
    seller_ids?: number[]   // 함께 참여 등록할 셀러
  }>().catch(() => null)

  if (!body || !body.name || !body.start_date || !body.end_date) {
    return c.json({ success: false, error: '이름, 시작일, 종료일은 필수' }, 400)
  }
  if (body.name.length > 100) return c.json({ success: false, error: '캠페인 이름은 100자 이하' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(body.end_date)) {
    return c.json({ success: false, error: '날짜는 YYYY-MM-DD 형식' }, 400)
  }
  if (body.end_date < body.start_date) {
    return c.json({ success: false, error: '종료일은 시작일 이후여야 함' }, 400)
  }
  const rate = body.base_incentive_rate
  if (rate !== undefined && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return c.json({ success: false, error: '인센티브율은 0~100 사이' }, 400)
  }

  const today = new Date().toISOString().slice(0, 10)
  const initStatus = body.start_date <= today ? 'active' : 'scheduled'

  const result = await c.env.DB.prepare(`
    INSERT INTO agency_campaigns (agency_id, name, description, start_date, end_date, status, base_incentive_rate, target_amount, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    agencyId, body.name, body.description || null,
    body.start_date, body.end_date, initStatus,
    rate ?? 0, body.target_amount ?? null, body.category ?? null,
  ).run()

  const campaignId = result.meta.last_row_id

  // 함께 셀러 등록 (옵션)
  if (body.seller_ids?.length) {
    // 자기 에이전시 소속 셀러만 허용
    const ph = body.seller_ids.map(() => '?').join(',')
    const { results: owned } = await c.env.DB.prepare(
      `SELECT seller_id FROM agency_sellers WHERE agency_id = ? AND seller_id IN (${ph})`
    ).bind(agencyId, ...body.seller_ids).all<{ seller_id: number }>()

    for (const r of (owned || [])) {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO agency_campaign_participants (campaign_id, seller_id) VALUES (?, ?)`
      ).bind(campaignId, r.seller_id).run()
    }
  }

  return c.json({ success: true, data: { id: campaignId, status: initStatus } }, 201)
})

// ── GET /:id — 상세 + 참여 셀러 ────────────────────────────
app.get('/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const campaign = await loadOwnedCampaign(c.env.DB, agencyId, id)
  if (!campaign) return c.json({ success: false, error: 'not found' }, 404)

  const { results: participants } = await c.env.DB.prepare(`
    SELECT p.*, s.name AS seller_name, s.email AS seller_email
    FROM agency_campaign_participants p
    LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE p.campaign_id = ?
    ORDER BY p.current_amount DESC
  `).bind(id).all<ParticipantRow>()

  return c.json({ success: true, data: { campaign, participants: participants || [] } })
})

// ── PATCH /:id — 수정 ──────────────────────────────────────
app.patch('/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const existing = await loadOwnedCampaign(c.env.DB, agencyId, id)
  if (!existing) return c.json({ success: false, error: 'not found' }, 404)
  if (existing.status === 'cancelled' || existing.status === 'ended') {
    return c.json({ success: false, error: '종료/취소된 캠페인은 수정 불가' }, 409)
  }

  type PatchBody = Partial<{
    name: string; description: string; end_date: string;
    base_incentive_rate: number; target_amount: number; category: string;
  }>
  const body = await c.req.json<PatchBody>().catch(() => ({} as PatchBody))

  const sets: string[] = []
  const binds: unknown[] = []
  if (body.name !== undefined) { sets.push('name = ?'); binds.push(body.name.slice(0, 100)) }
  if (body.description !== undefined) { sets.push('description = ?'); binds.push(body.description) }
  if (body.end_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.end_date) || body.end_date < existing.start_date) {
      return c.json({ success: false, error: '종료일이 잘못됨' }, 400)
    }
    sets.push('end_date = ?'); binds.push(body.end_date)
  }
  if (body.base_incentive_rate !== undefined) {
    if (!Number.isFinite(body.base_incentive_rate) || body.base_incentive_rate < 0 || body.base_incentive_rate > 100) {
      return c.json({ success: false, error: '인센티브율 범위 오류' }, 400)
    }
    sets.push('base_incentive_rate = ?'); binds.push(body.base_incentive_rate)
  }
  if (body.target_amount !== undefined) { sets.push('target_amount = ?'); binds.push(body.target_amount) }
  if (body.category !== undefined) { sets.push('category = ?'); binds.push(body.category) }

  if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
  sets.push("updated_at = datetime('now')")
  binds.push(id, agencyId)

  await c.env.DB.prepare(`UPDATE agency_campaigns SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`)
    .bind(...binds).run()
  return c.json({ success: true })
})

// ── POST /:id/cancel — 취소 ────────────────────────────────
app.post('/:id/cancel', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)
  const r = await c.env.DB.prepare(
    "UPDATE agency_campaigns SET status='cancelled', updated_at=datetime('now') WHERE id = ? AND agency_id = ? AND status IN ('scheduled','active')"
  ).bind(id, agencyId).run()
  if ((r.meta.changes ?? 0) === 0) return c.json({ success: false, error: '취소할 수 없는 상태' }, 409)
  return c.json({ success: true })
})

// ── POST /:id/participants — 셀러 참여 추가 ────────────────
app.post('/:id/participants', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  const campaign = await loadOwnedCampaign(c.env.DB, agencyId, id)
  if (!campaign) return c.json({ success: false, error: 'not found' }, 404)

  const body = await c.req.json<{ seller_ids: number[] }>().catch(() => ({ seller_ids: [] as number[] }))
  if (!Array.isArray(body.seller_ids) || body.seller_ids.length === 0) {
    return c.json({ success: false, error: 'seller_ids 필요' }, 400)
  }

  const ph = body.seller_ids.map(() => '?').join(',')
  const { results: owned } = await c.env.DB.prepare(
    `SELECT seller_id FROM agency_sellers WHERE agency_id = ? AND seller_id IN (${ph})`
  ).bind(agencyId, ...body.seller_ids).all<{ seller_id: number }>()

  let added = 0
  for (const r of (owned || [])) {
    const ins = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO agency_campaign_participants (campaign_id, seller_id) VALUES (?, ?)`
    ).bind(id, r.seller_id).run()
    if ((ins.meta.changes ?? 0) > 0) added++
  }
  return c.json({ success: true, data: { added, requested: body.seller_ids.length } })
})

// ── DELETE /:id/participants/:sid — 셀러 제거 ─────────────
app.delete('/:id/participants/:sid', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  const sid = parseInt(c.req.param('sid'))
  if (!Number.isFinite(id) || !Number.isFinite(sid)) return c.json({ success: false, error: 'invalid id' }, 400)

  // 자기 캠페인 확인
  const campaign = await loadOwnedCampaign(c.env.DB, agencyId, id)
  if (!campaign) return c.json({ success: false, error: 'not found' }, 404)

  await c.env.DB.prepare(
    "UPDATE agency_campaign_participants SET status='removed' WHERE campaign_id = ? AND seller_id = ?"
  ).bind(id, sid).run()
  return c.json({ success: true })
})

// ── PATCH /:id/participants/:sid — KPI/보너스 수정 ───────
app.patch('/:id/participants/:sid', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  const sid = parseInt(c.req.param('sid'))
  if (!Number.isFinite(id) || !Number.isFinite(sid)) return c.json({ success: false, error: 'invalid id' }, 400)

  const campaign = await loadOwnedCampaign(c.env.DB, agencyId, id)
  if (!campaign) return c.json({ success: false, error: 'not found' }, 404)

  type UpdateBody = { target_amount?: number; bonus_rate?: number }
  const body = await c.req.json<UpdateBody>().catch(() => ({} as UpdateBody))
  const sets: string[] = []
  const binds: unknown[] = []
  if (body.target_amount !== undefined) {
    if (body.target_amount < 0) return c.json({ success: false, error: 'target_amount 음수 불가' }, 400)
    sets.push('target_amount = ?'); binds.push(body.target_amount)
  }
  if (body.bonus_rate !== undefined) {
    if (body.bonus_rate < 0 || body.bonus_rate > 100) return c.json({ success: false, error: 'bonus_rate 범위 0~100' }, 400)
    sets.push('bonus_rate = ?'); binds.push(body.bonus_rate)
  }
  if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
  binds.push(id, sid)
  await c.env.DB.prepare(
    `UPDATE agency_campaign_participants SET ${sets.join(', ')} WHERE campaign_id = ? AND seller_id = ?`
  ).bind(...binds).run()
  return c.json({ success: true })
})

// ── POST /:id/refresh — 누적 매출 강제 재집계 ────────────
app.post('/:id/refresh', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)
  const campaign = await loadOwnedCampaign(c.env.DB, agencyId, id)
  if (!campaign) return c.json({ success: false, error: 'not found' }, 404)

  try {
    await recomputeParticipants(c.env.DB, campaign)
    return c.json({ success: true })
  } catch (e) {
    if (import.meta.env.DEV) console.error('[campaign:refresh]', e)
    return c.json({ success: false, error: '재집계 실패' }, 500)
  }
})

export const agencyCampaignsRoutes = app

// ── 외부 export: cron 에서 사용 (모든 active 캠페인 일괄 재집계) ──
export async function recomputeAllActiveCampaigns(DB: D1Database, swallowFn = swallow): Promise<{ processed: number }> {
  let processed = 0
  try {
    const today = new Date().toISOString().slice(0, 10)

    // 시작일이 도래한 scheduled → active
    await DB.prepare(
      "UPDATE agency_campaigns SET status='active', updated_at=datetime('now') WHERE status='scheduled' AND date(start_date) <= date(?)"
    ).bind(today).run()
    // 종료일 지난 active → ended
    await DB.prepare(
      "UPDATE agency_campaigns SET status='ended', updated_at=datetime('now') WHERE status='active' AND date(end_date) < date(?)"
    ).bind(today).run()

    const { results: actives } = await DB.prepare(
      "SELECT * FROM agency_campaigns WHERE status='active'"
    ).all<CampaignRow>()

    for (const c of (actives || [])) {
      try {
        await recomputeParticipants(DB, c)
        processed++
      } catch (e) {
        console.error(`[cron:campaigns] campaign=${c.id} recompute failed:`, e)
      }
    }
  } catch (e) {
    // agency_campaigns 테이블 미존재 (migration 0209 미적용) — silent
    swallowFn('cron:campaigns:bootstrap')(e)
  }
  return { processed }
}
