/**
 * Agency Message Templates Routes (Q2)
 *
 * 마운트: /api/agency/messages
 * 마이그레이션: 0214_agency_message_templates.sql
 *
 * Endpoints:
 *   GET    /templates                  — 템플릿 목록 (category 필터)
 *   POST   /templates                  — 템플릿 생성
 *   PATCH  /templates/:id              — 템플릿 수정
 *   DELETE /templates/:id              — 템플릿 비활성화 (soft)
 *   POST   /send                       — 템플릿 + 셀러 ID 배열로 in-app 알림 일괄 발송
 *   GET    /sends                      — 발송 이력
 *
 * 변수 치환: {{seller_name}}, {{agency_name}}, {{commission_rate}}
 *
 * 1차: in-app 알림 (agency_notifications 와는 다름 — sellers 에게 가는 알림)
 *      현재 우리는 셀러용 dashboard_notifications 테이블 사용.
 *
 * 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q2)
 */

import { Hono, type Next } from 'hono'
import { verify } from 'hono/jwt'
import { parseSessionCookie } from '@/worker/utils/session'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'

type AgencyCtx = {
  Bindings: Env
  Variables: { agency: { id: number; email?: string; name?: string } }
}

const app = new Hono<AgencyCtx>()

// ── auth (sub-app 부모 미들웨어 미상속) ──
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
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' }
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

app.use('*', requireAgency)

const VALID_CATEGORIES = ['invite', 'follow_up', 'reactivation', 'announcement', 'general'] as const
type Category = typeof VALID_CATEGORIES[number]

interface TemplateRow {
  id: number
  agency_id: number
  name: string
  body: string
  category: string
  is_active: number
  usage_count: number
  created_at: string
  updated_at: string
}

// ── GET /templates ─────────────────────────────────────
app.get('/templates', async (c) => {
  const agencyId = c.get('agency').id
  const category = c.req.query('category')
  const includeInactive = c.req.query('include_inactive') === 'true'

  let where = 'agency_id = ?'
  const binds: unknown[] = [agencyId]
  if (!includeInactive) {
    where += ' AND is_active = 1'
  }
  if (category && (VALID_CATEGORIES as readonly string[]).includes(category)) {
    where += ' AND category = ?'
    binds.push(category)
  }

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM agency_message_templates WHERE ${where} ORDER BY usage_count DESC, id DESC LIMIT 200`
    ).bind(...binds).all<TemplateRow>()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: false, error: 'agency_message_templates 미존재 — migration 0214 필요', data: [] })
  }
})

// ── POST /templates ────────────────────────────────────
app.post('/templates', async (c) => {
  const agencyId = c.get('agency').id
  const body = await c.req.json<{
    name: string; body: string; category?: Category;
  }>().catch(() => null)

  if (!body || !body.name || !body.body) {
    return c.json({ success: false, error: 'name, body 필수' }, 400)
  }
  if (body.name.length > 100) return c.json({ success: false, error: 'name 100자 이하' }, 400)
  if (body.body.length > 2000) return c.json({ success: false, error: 'body 2000자 이하' }, 400)

  const cat = (body.category && (VALID_CATEGORIES as readonly string[]).includes(body.category))
    ? body.category : 'general'

  const result = await c.env.DB.prepare(`
    INSERT INTO agency_message_templates (agency_id, name, body, category)
    VALUES (?, ?, ?, ?)
  `).bind(agencyId, body.name, body.body, cat).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── PATCH /templates/:id ──────────────────────────────
app.patch('/templates/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  type UpdateBody = Partial<Omit<TemplateRow, 'is_active'>> & { is_active?: boolean }
  const body = await c.req.json<UpdateBody>().catch(() => ({} as UpdateBody))
  const sets: string[] = []
  const binds: unknown[] = []

  if (body.name !== undefined) {
    if (String(body.name).length > 100) return c.json({ success: false, error: 'name 100자 이하' }, 400)
    sets.push('name = ?'); binds.push(body.name)
  }
  if (body.body !== undefined) {
    if (String(body.body).length > 2000) return c.json({ success: false, error: 'body 2000자 이하' }, 400)
    sets.push('body = ?'); binds.push(body.body)
  }
  if (body.category !== undefined) {
    if (!(VALID_CATEGORIES as readonly string[]).includes(body.category as string)) {
      return c.json({ success: false, error: 'invalid category' }, 400)
    }
    sets.push('category = ?'); binds.push(body.category)
  }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); binds.push(body.is_active ? 1 : 0) }

  if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
  sets.push("updated_at = datetime('now')")
  binds.push(id, agencyId)

  const r = await c.env.DB.prepare(
    `UPDATE agency_message_templates SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`
  ).bind(...binds).run()
  if ((r.meta.changes ?? 0) === 0) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true })
})

// ── DELETE /templates/:id (soft) ──────────────────────
app.delete('/templates/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)
  await c.env.DB.prepare(
    "UPDATE agency_message_templates SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND agency_id = ?"
  ).bind(id, agencyId).run()
  return c.json({ success: true })
})

// ── POST /send — 본인 소속 셀러 N명에게 in-app 알림 발송 ──
//
// body: { template_id, seller_ids[], custom_link? }
// 변수 치환: {{seller_name}} (각 셀러별), {{agency_name}}
app.post('/send', async (c) => {
  const agencyId = c.get('agency').id
  const body = await c.req.json<{
    template_id: number; seller_ids: number[]; custom_link?: string;
  }>().catch(() => null)

  if (!body || !Number.isFinite(body.template_id) || !Array.isArray(body.seller_ids) || body.seller_ids.length === 0) {
    return c.json({ success: false, error: 'template_id + seller_ids[] 필수' }, 400)
  }
  if (body.seller_ids.length > 200) {
    return c.json({ success: false, error: '한 번에 최대 200명' }, 400)
  }

  // 1) 템플릿 조회 (자기 에이전시 것만)
  const tmpl = await c.env.DB.prepare(
    'SELECT id, name, body FROM agency_message_templates WHERE id = ? AND agency_id = ? AND is_active = 1'
  ).bind(body.template_id, agencyId).first<{ id: number; name: string; body: string }>()
  if (!tmpl) return c.json({ success: false, error: 'template not found' }, 404)

  // 2) 자기 소속 셀러만 필터
  const ph = body.seller_ids.map(() => '?').join(',')
  const { results: ownedSellers } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name
    FROM agency_sellers ag
    INNER JOIN sellers s ON s.id = ag.seller_id
    WHERE ag.agency_id = ? AND ag.seller_id IN (${ph})
  `).bind(agencyId, ...body.seller_ids).all<{ seller_id: number; seller_name: string }>()

  // 3) 에이전시 정보
  const agency = await c.env.DB.prepare('SELECT name, commission_rate FROM agencies WHERE id = ?')
    .bind(agencyId).first<{ name: string; commission_rate: number }>()
  const agencyName = agency?.name || '에이전시'
  const commissionRate = agency?.commission_rate ?? 2.0

  let sent = 0
  let failed = 0
  const link = body.custom_link || '/seller'

  for (const seller of (ownedSellers || [])) {
    const rendered = tmpl.body
      .replace(/\{\{seller_name\}\}/g, seller.seller_name || '')
      .replace(/\{\{agency_name\}\}/g, agencyName)
      .replace(/\{\{commission_rate\}\}/g, String(commissionRate))

    try {
      // in-app 알림 (셀러용 dashboard_notifications)
      await c.env.DB.prepare(`
        INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
        VALUES ('seller', ?, 'agency_message', ?, ?, ?, datetime('now'))
      `).bind(String(seller.seller_id), `${agencyName} 으로부터 메시지`, rendered, link).run()

      // 발송 이력
      await c.env.DB.prepare(`
        INSERT INTO agency_message_sends (agency_id, template_id, channel, recipient_seller_id, rendered_body, status)
        VALUES (?, ?, 'in_app', ?, ?, 'sent')
      `).bind(agencyId, tmpl.id, seller.seller_id, rendered).run().catch(swallow('agency:msg-send-log'))

      sent++
    } catch (e) {
      failed++
      console.error(`[agency:messages:send] seller=${seller.seller_id} failed:`, e)
    }
  }

  // 사용 횟수 증가
  if (sent > 0) {
    await c.env.DB.prepare(
      'UPDATE agency_message_templates SET usage_count = usage_count + ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(sent, tmpl.id).run().catch(swallow('agency:msg-template-usage'))
  }

  return c.json({
    success: true,
    data: {
      template_id: tmpl.id,
      requested: body.seller_ids.length,
      eligible: ownedSellers?.length ?? 0,
      sent,
      failed,
    },
  })
})

// ── GET /sends — 발송 이력 ──────────────────────────────
app.get('/sends', async (c) => {
  const agencyId = c.get('agency').id
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT s.*, t.name AS template_name
      FROM agency_message_sends s
      LEFT JOIN agency_message_templates t ON t.id = s.template_id
      WHERE s.agency_id = ?
      ORDER BY s.sent_at DESC
      LIMIT ?
    `).bind(agencyId, limit).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: false, data: [] })
  }
})

export const agencyMessagesRoutes = app
