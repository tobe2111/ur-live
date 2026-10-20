/**
 * 🤝 2026-06-10 (사용자 요청): 광고/제휴 문의 — 공개 접수 + 어드민 접수함.
 *
 * 마운트 (worker/index.ts):
 *   app.route('/api/partnership', partnershipPublicRoutes)              — POST /inquiry (공개, rate limit)
 *   app.route('/api/admin/partnership-inquiries', adminPartnershipRoutes) — 어드민 목록/처리
 *
 * 테이블: partnership_inquiries (lazy DDL + repair-schema 동일 등록)
 * 접수 시 어드민 벨 알림(createDashboardNotification) — 놓치지 않게.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

type D1Database = Env['DB']

const VALID_TYPE = new Set(['ad', 'partnership', 'store', 'supply', 'other'])
const TYPE_LABEL: Record<string, string> = { ad: '광고', partnership: '제휴', store: '매장 입점', supply: '상품 공급', other: '기타' }
const VALID_STATUS = new Set(['new', 'in_progress', 'done'])

let _ensured = false
async function ensureSchema(DB: D1Database): Promise<void> {
  if (_ensured) return
  _ensured = true
  await DB.prepare(`CREATE TABLE IF NOT EXISTS partnership_inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'partnership',
    company TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    admin_memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  )`).run().catch(swallow('partnership:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_partnership_inquiries_status ON partnership_inquiries(status, id DESC)').run().catch(swallow('partnership:idx'))
}

// ── 공개 — 접수 ──────────────────────────────────────────────
const pub = new Hono<{ Bindings: Env }>()

pub.post('/inquiry', rateLimit({ action: 'partnership-inquiry', max: 5, windowSec: 600 }), async (c) => {
  const { DB } = c.env
  try {
    await ensureSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const type = String(body.type || 'partnership').trim()
    if (!VALID_TYPE.has(type)) return c.json({ success: false, error: '문의 유형이 올바르지 않습니다' }, 400)
    const name = String(body.name || '').trim().slice(0, 60)
    const company = String(body.company || '').trim().slice(0, 100) || null
    const phone = String(body.phone || '').trim().slice(0, 30) || null
    const email = String(body.email || '').trim().slice(0, 120) || null
    const message = String(body.message || '').trim().slice(0, 4000)
    if (!name) return c.json({ success: false, error: '성함(담당자)을 입력해주세요' }, 400)
    if (!message) return c.json({ success: false, error: '문의 내용을 입력해주세요' }, 400)
    if (!phone && !email) return c.json({ success: false, error: '연락처 또는 이메일 중 하나는 입력해주세요' }, 400)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ success: false, error: '이메일 형식이 올바르지 않습니다' }, 400)

    const ins = await DB.prepare(
      'INSERT INTO partnership_inquiries (type, company, name, phone, email, message) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(type, company, name, phone, email, message).run()

    // 어드민 벨 — fail-soft (알림 실패가 접수를 막으면 안 됨)
    createDashboardNotification(
      DB, 'admin', null, 'partnership_inquiry', '새 광고/제휴 문의',
      `${TYPE_LABEL[type] || type} · ${company || name} · ${message.slice(0, 60)}`, '/admin/partnership',
    ).catch(swallow('partnership:notify-admin'))

    return c.json({ success: true, id: Number(ins.meta?.last_row_id) })
  } catch (err) {
    return safeError(c, err, '문의 접수 중 오류가 발생했습니다', '[partnership]')
  }
})

// ── 어드민 — 접수함 ──────────────────────────────────────────
const adm = new Hono<{ Bindings: Env }>()
adm.use('*', adminIpWhitelist())
adm.use('*', requireAdmin())
adm.use('*', adminAuditMiddleware())

adm.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureSchema(DB)
    const status = String(c.req.query('status') || '')
    const conds: string[] = []
    const binds: string[] = []
    if (VALID_STATUS.has(status)) { conds.push('status = ?'); binds.push(status) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const { results } = await DB.prepare(
      `SELECT * FROM partnership_inquiries ${where} ORDER BY id DESC LIMIT 200`
    ).bind(...binds).all()
    return c.json({ success: true, inquiries: results ?? [] })
  } catch (err) {
    return safeError(c, err, '문의 목록 조회 중 오류가 발생했습니다', '[admin-partnership]')
  }
})

adm.patch('/:id', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
  try {
    await ensureSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const binds: (string | number | null)[] = []
    if (body.status !== undefined) {
      const v = String(body.status)
      if (!VALID_STATUS.has(v)) return c.json({ success: false, error: '상태값 오류 (new/in_progress/done)' }, 400)
      sets.push('status = ?'); binds.push(v)
    }
    if (body.admin_memo !== undefined) { sets.push('admin_memo = ?'); binds.push(String(body.admin_memo).trim().slice(0, 2000) || null) }
    if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
    sets.push("updated_at = datetime('now')")
    binds.push(id)
    const r = await DB.prepare(`UPDATE partnership_inquiries SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '문의가 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '문의 처리 중 오류가 발생했습니다', '[admin-partnership]')
  }
})

export { pub as partnershipPublicRoutes, adm as adminPartnershipRoutes }
