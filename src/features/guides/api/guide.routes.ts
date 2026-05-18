/**
 * Operation Guide Routes — admin editable, role-scoped read access
 *
 * 🛡️ 2026-04-23 배치 174: 어드민/셀러/에이전시 3종 운영 가이드
 *
 * - 어드민만 수정 가능 (PATCH)
 * - 각 역할은 자기 가이드만 조회 가능 + 어드민은 전체 조회 가능
 * - 최초 배포 시 자동 시드 (sections 비어있으면 seedDefaults 실행)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { executeQuery } from '@/worker/utils/database'
// 🛡️ 2026-05-18: GUIDE_SEEDS (87KB) 는 dynamic import — 본 모듈에 정적 포함 X (worker bundle 축소).

export const guideRoutes = new Hono<{ Bindings: Env }>()

type GuideType = 'admin' | 'seller' | 'agency'

interface GuideSection {
  id?: number
  guide_type: GuideType
  section_key: string
  section_icon: string
  section_title: string
  section_order: number
  content_md: string
  updated_at?: string
}

async function requireRole(c: any, roles: string[]): Promise<{ id: number; type: string } | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.slice(7), c.env.JWT_SECRET, 'HS256') as { id?: number; type?: string }
    if (payload?.type && roles.includes(payload.type)) return { id: payload.id || 0, type: payload.type }
    return null
  } catch { return null }
}

async function ensureSeeded(DB: D1Database, guideType: GuideType): Promise<void> {
  const existing = await DB.prepare(
    'SELECT COUNT(*) as n FROM operation_guides WHERE guide_type = ?'
  ).bind(guideType).first<{ n: number }>()
  if ((existing?.n ?? 0) > 0) return

  // 🛡️ 2026-05-18: 87KB GUIDE_SEEDS dynamic import — worker bundle 에서 제외.
  //   첫 진입 시 1회만 fetch (operation_guides 비어있을 때).
  const { GUIDE_SEEDS } = await import('./guide-seed')
  const seed = GUIDE_SEEDS[guideType] || []
  for (const s of seed) {
    try {
      await DB.prepare(
        `INSERT OR IGNORE INTO operation_guides
         (guide_type, section_key, section_icon, section_title, section_order, content_md, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(guideType, s.key, s.icon, s.title, s.order, s.content).run()
    } catch { /* non-critical */ }
  }
}

// ── GET /api/guides/:type — 역할별 가이드 조회 (읽기) ─────────────
guideRoutes.get('/:type', cors(), async (c) => {
  const type = c.req.param('type') as GuideType
  if (!['admin', 'seller', 'agency'].includes(type)) {
    return c.json({ success: false, error: 'Invalid guide type' }, 400)
  }

  // 권한 체크: 어드민은 모두 / 셀러는 seller / 에이전시는 agency 만
  const allowedRoles: Record<GuideType, string[]> = {
    admin: ['admin'],
    seller: ['admin', 'seller'],
    agency: ['admin', 'agency'],
  }
  const user = await requireRole(c, allowedRoles[type])
  if (!user) return c.json({ success: false, error: '인증이 필요합니다' }, 401)

  try {
    await ensureSeeded(c.env.DB, type)
    const rows = await executeQuery<GuideSection>(c.env.DB,
      `SELECT id, guide_type, section_key, section_icon, section_title, section_order, content_md, updated_at
       FROM operation_guides WHERE guide_type = ? ORDER BY section_order ASC`,
      [type]
    )
    return c.json({ success: true, data: rows })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── PATCH /api/guides/:type/:sectionKey — 관리자 전용 수정 ────────
guideRoutes.patch('/:type/:sectionKey', async (c) => {
  const type = c.req.param('type') as GuideType
  const sectionKey = c.req.param('sectionKey')
  if (!['admin', 'seller', 'agency'].includes(type)) {
    return c.json({ success: false, error: 'Invalid guide type' }, 400)
  }

  const user = await requireRole(c, ['admin'])
  if (!user) return c.json({ success: false, error: '관리자만 수정 가능합니다' }, 403)

  try {
    const body = await c.req.json<{
      section_title?: string
      section_icon?: string
      section_order?: number
      content_md?: string
    }>()

    // 섹션 존재 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM operation_guides WHERE guide_type = ? AND section_key = ?'
    ).bind(type, sectionKey).first<{ id: number }>()

    if (!existing) {
      // 신규 섹션 생성
      if (!body.section_title || !body.content_md) {
        return c.json({ success: false, error: 'section_title, content_md 필수' }, 400)
      }
      await c.env.DB.prepare(
        `INSERT INTO operation_guides
         (guide_type, section_key, section_icon, section_title, section_order, content_md, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(type, sectionKey, body.section_icon || '📄', body.section_title,
             body.section_order ?? 999, body.content_md, user.id).run()
      return c.json({ success: true, message: '섹션이 생성되었습니다' }, 201)
    }

    const sets: string[] = ['updated_at = datetime(\'now\')', 'updated_by = ?']
    const params: unknown[] = [user.id]
    if (body.section_title !== undefined) { sets.push('section_title = ?'); params.push(body.section_title) }
    if (body.section_icon !== undefined) { sets.push('section_icon = ?'); params.push(body.section_icon) }
    if (body.section_order !== undefined) { sets.push('section_order = ?'); params.push(body.section_order) }
    if (body.content_md !== undefined) { sets.push('content_md = ?'); params.push(body.content_md) }
    params.push(type, sectionKey)

    await c.env.DB.prepare(
      `UPDATE operation_guides SET ${sets.join(', ')} WHERE guide_type = ? AND section_key = ?`
    ).bind(...params).run()
    return c.json({ success: true, message: '저장되었습니다' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── DELETE /api/guides/:type/:sectionKey — 관리자 전용 삭제 ───────
guideRoutes.delete('/:type/:sectionKey', async (c) => {
  const type = c.req.param('type') as GuideType
  const sectionKey = c.req.param('sectionKey')

  const user = await requireRole(c, ['admin'])
  if (!user) return c.json({ success: false, error: '관리자만 삭제 가능합니다' }, 403)

  try {
    await c.env.DB.prepare(
      'DELETE FROM operation_guides WHERE guide_type = ? AND section_key = ?'
    ).bind(type, sectionKey).run()
    return c.json({ success: true, message: '삭제되었습니다' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

export default guideRoutes
