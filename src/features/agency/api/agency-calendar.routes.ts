/**
 * Agency Live Calendar + Notes Routes (M5)
 *
 * 마운트: /api/agency/calendar
 * 마이그레이션: 0218_agency_live_notes.sql
 *
 * Endpoints:
 *   GET    /                       — 월별 캘린더 (라이브 일정 + 노트 카운트)
 *   GET    /streams/:id            — 단건 라이브 상세 (스트림 + 노트 목록)
 *   POST   /streams/:id/notes      — 노트 추가
 *   PATCH  /notes/:id              — 노트 수정 (작성자 본인 또는 owner)
 *   DELETE /notes/:id              — 노트 삭제
 *   POST   /notes/:id/mark-read    — 셀러용 읽음 처리 (visible_to_seller=1 한 노트만)
 *
 * 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (D), TikTok Backstage 5.2
 */

import { Hono, type Next } from 'hono'
import { verify } from 'hono/jwt'
import { parseSessionCookie } from '@/worker/utils/session'
import type { Env } from '@/worker/types/env'

import { swallow } from '@/worker/utils/swallow';
type AgencyCtx = {
  Bindings: Env
  Variables: { agency: { id: number; email?: string } }
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
  } catch { return null }
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

// ── GET / — 월별 캘린더 ────────────────────────────
//
// query: month=YYYY-MM (default: 이번 달)
// 반환: 일별 라이브 일정 + 각 라이브의 노트 카운트
app.get('/', async (c) => {
  const agencyId = c.get('agency').id
  const month = c.req.query('month') ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'month 형식: YYYY-MM' }, 400)
  }

  const [year, mon] = month.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const endDate = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}-01`

  // 라이브 일정 (소속 셀러 한정) + 노트 카운트
  const { results } = await c.env.DB.prepare(`
    SELECT
      ls.id,
      ls.title,
      ls.status,
      ls.scheduled_at,
      ls.started_at,
      ls.ended_at,
      ls.current_viewers,
      ls.peak_viewers,
      ls.seller_id,
      s.name AS seller_name,
      s.business_name AS seller_business_name,
      (SELECT COUNT(*) FROM agency_live_notes n
        WHERE n.live_stream_id = ls.id AND n.agency_id = ?) AS note_count,
      (SELECT COUNT(*) FROM agency_live_notes n
        WHERE n.live_stream_id = ls.id AND n.agency_id = ? AND n.type = 'issue') AS issue_count
    FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    LEFT JOIN sellers s ON s.id = ls.seller_id
    WHERE ag.agency_id = ?
      AND (
        (ls.scheduled_at >= ? AND ls.scheduled_at < ?) OR
        (ls.started_at  >= ? AND ls.started_at  < ?) OR
        (ls.created_at  >= ? AND ls.created_at  < ?)
      )
    ORDER BY COALESCE(ls.scheduled_at, ls.started_at, ls.created_at) ASC
  `).bind(
    agencyId, agencyId, agencyId,
    startDate, endDate,
    startDate, endDate,
    startDate, endDate,
  ).all().catch(() => ({ results: [] as any[] }))

  return c.json({ success: true, data: results || [], month })
})

// ── GET /streams/:id — 라이브 상세 + 노트 ──────────
app.get('/streams/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  // 자기 소속 셀러의 라이브인지 확인
  const stream = await c.env.DB.prepare(`
    SELECT ls.*, s.name AS seller_name, s.business_name AS seller_business_name
    FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    LEFT JOIN sellers s ON s.id = ls.seller_id
    WHERE ls.id = ? AND ag.agency_id = ?
  `).bind(id, agencyId).first<Record<string, unknown>>()

  if (!stream) return c.json({ success: false, error: 'not found' }, 404)

  // 노트 목록
  interface NoteRow {
    id: number; agency_id: number; live_stream_id: number;
    agent_member_id: number | null; type: string; content: string;
    live_timestamp_seconds: number | null; visible_to_seller: number;
    read_by_seller_at: string | null; created_at: string;
    author_email: string | null;
  }
  let notes: NoteRow[] = []
  try {
    const r = await c.env.DB.prepare(`
      SELECT n.*, m.email AS author_email
      FROM agency_live_notes n
      LEFT JOIN agency_members m ON m.id = n.agent_member_id
      WHERE n.live_stream_id = ? AND n.agency_id = ?
      ORDER BY n.created_at DESC
    `).bind(id, agencyId).all<NoteRow>()
    notes = r.results || []
  } catch {
    // 마이그레이션 0218 미적용
  }

  return c.json({ success: true, data: { stream, notes } })
})

// ── POST /streams/:id/notes — 노트 추가 ───────────
app.post('/streams/:id/notes', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  const body = await c.req.json<{
    content: string;
    type?: 'guidance' | 'issue' | 'highlight' | 'reminder';
    live_timestamp_seconds?: number;
    visible_to_seller?: boolean;
  }>().catch(() => null)

  if (!body || !body.content?.trim()) {
    return c.json({ success: false, error: 'content 필수' }, 400)
  }
  if (body.content.length > 2000) {
    return c.json({ success: false, error: 'content 2000자 이하' }, 400)
  }
  const type = body.type || 'guidance'
  if (!['guidance', 'issue', 'highlight', 'reminder'].includes(type)) {
    return c.json({ success: false, error: 'invalid type' }, 400)
  }

  // 자기 소속 라이브 검증
  const owned = await c.env.DB.prepare(`
    SELECT 1 FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    WHERE ls.id = ? AND ag.agency_id = ? LIMIT 1
  `).bind(id, agency.id).first()
  if (!owned) return c.json({ success: false, error: 'not your live' }, 403)

  // 작성자 ID (agency_members 에서 본인 찾기)
  let memberId: number | null = null
  try {
    const m = await c.env.DB.prepare(
      "SELECT id FROM agency_members WHERE agency_id = ? AND email = ? AND status = 'active' LIMIT 1"
    ).bind(agency.id, agency.email || '').first<{ id: number }>()
    if (m) memberId = m.id
  } catch { /* M4 미적용 */ }

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO agency_live_notes
        (agency_id, live_stream_id, agent_member_id, type, content, live_timestamp_seconds, visible_to_seller)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agency.id, id, memberId, type, body.content.trim(),
      body.live_timestamp_seconds ?? null,
      body.visible_to_seller ? 1 : 0,
    ).run()

    // 셀러에게 보일 노트면 알림
    if (body.visible_to_seller) {
      const seller = await c.env.DB.prepare("SELECT seller_id FROM live_streams WHERE id = ?").bind(id).first<{ seller_id: number }>()
      if (seller?.seller_id) {
        await c.env.DB.prepare(`
          INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
          VALUES ('seller', ?, 'agency_note', '에이전시 노트', ?, ?, datetime('now'))
        `).bind(
          String(seller.seller_id),
          body.content.trim().slice(0, 100),
          `/seller/streams/${id}`,
        ).run().catch(swallow('agency:api:agency-calendar'))
      }
    }

    return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
  } catch (e) {
    return c.json({ success: false, error: 'agency_live_notes 미존재 — migration 0218 필요' }, 500)
  }
})

// ── PATCH /notes/:id ──────────────────────────────
app.patch('/notes/:id', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  type PatchBody = { content?: string; type?: string; visible_to_seller?: boolean }
  const body = await c.req.json<PatchBody>().catch(() => ({} as PatchBody))

  const existing = await c.env.DB.prepare(
    'SELECT * FROM agency_live_notes WHERE id = ? AND agency_id = ?'
  ).bind(id, agency.id).first<{ id: number; content: string }>()
  if (!existing) return c.json({ success: false, error: 'not found' }, 404)

  const sets: string[] = []
  const binds: unknown[] = []
  if (body.content !== undefined) {
    if (!body.content.trim()) return c.json({ success: false, error: 'content 비어있음' }, 400)
    if (body.content.length > 2000) return c.json({ success: false, error: 'content 2000자 이하' }, 400)
    sets.push('content = ?'); binds.push(body.content.trim())
  }
  if (body.type !== undefined) {
    if (!['guidance', 'issue', 'highlight', 'reminder'].includes(body.type)) {
      return c.json({ success: false, error: 'invalid type' }, 400)
    }
    sets.push('type = ?'); binds.push(body.type)
  }
  if (body.visible_to_seller !== undefined) {
    sets.push('visible_to_seller = ?'); binds.push(body.visible_to_seller ? 1 : 0)
  }
  if (sets.length === 0) return c.json({ success: false, error: '변경 없음' }, 400)
  sets.push("updated_at = datetime('now')")
  binds.push(id, agency.id)

  await c.env.DB.prepare(
    `UPDATE agency_live_notes SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`
  ).bind(...binds).run()
  return c.json({ success: true })
})

// ── DELETE /notes/:id ─────────────────────────────
app.delete('/notes/:id', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  await c.env.DB.prepare(
    'DELETE FROM agency_live_notes WHERE id = ? AND agency_id = ?'
  ).bind(id, agency.id).run()
  return c.json({ success: true })
})

// ── POST /notes/:id/mark-read — 셀러가 읽음 처리 ──
//
// ⚠️ 이 엔드포인트는 에이전시 인증 미들웨어 사용 중 — 향후 셀러 전용 변종 필요.
// 임시: visible_to_seller=1 인 노트의 read_by_seller_at 업데이트.
app.post('/notes/:id/mark-read', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  await c.env.DB.prepare(
    "UPDATE agency_live_notes SET read_by_seller_at = datetime('now') WHERE id = ? AND visible_to_seller = 1 AND read_by_seller_at IS NULL"
  ).bind(id).run()
  return c.json({ success: true })
})

export const agencyCalendarRoutes = app
