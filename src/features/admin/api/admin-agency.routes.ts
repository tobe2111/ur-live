/**
 * Admin Agency Management Routes
 *
 * GET    /agencies                      - 에이전시 목록
 * POST   /agencies                      - 에이전시 생성
 * PATCH  /agencies/:id                  - 에이전시 정보 수정
 * DELETE /agencies/:id                  - 에이전시 삭제
 * POST   /agencies/:id/reset-password   - 에이전시 비밀번호 재설정
 * GET    /agencies/:id/sellers          - 에이전시 소속 셀러
 * POST   /agencies/:id/sellers          - 셀러 소속 추가
 * DELETE /agencies/:id/sellers/:sellerId - 셀러 소속 제거
 */

import { Hono } from 'hono'
import { hashPassword } from '@/lib/password'
import { requireAdmin } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'

import { swallow } from '@/worker/utils/swallow';
const app = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-04-22: 명시적 requireAdmin 적용 (depth-in-defense).
// 이전: adminApp 래퍼에만 의존 → 라우터 마운트 변경 시 우회 가능
// 수정: 각 라우터에도 명시적 requireAdmin 추가
app.use('*', requireAdmin())

async function ensureAgencyTables(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('admin:api:admin-agency'))

  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )
  `).run().catch(swallow('admin:api:admin-agency'))
}

// ── GET /agencies ─────────────────────────────────────────────
app.get('/', async (c) => {
  await ensureAgencyTables(c.env.DB)
  // linked_user_id 는 컬럼 없을 수도 있어 try-catch 로 graceful fallback
  let rows
  try {
    rows = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.contact_name, a.email, a.phone, a.status, a.created_at,
             COALESCE(a.commission_rate, 2.0) AS commission_rate,
             a.linked_user_id,
             COUNT(ag.seller_id) AS seller_count
      FROM agencies a
      LEFT JOIN agency_sellers ag ON ag.agency_id = a.id
      GROUP BY a.id ORDER BY a.created_at DESC
    `).all()
  } catch {
    rows = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.contact_name, a.email, a.phone, a.status, a.created_at,
             COALESCE(a.commission_rate, 2.0) AS commission_rate,
             COUNT(ag.seller_id) AS seller_count
      FROM agencies a
      LEFT JOIN agency_sellers ag ON ag.agency_id = a.id
      GROUP BY a.id ORDER BY a.created_at DESC
    `).all()
  }
  return c.json({ success: true, data: rows.results })
})

// ── POST /agencies ────────────────────────────────────────────
app.post('/', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { name, contact_name, email, password, phone } = await c.req.json<{
    name: string; contact_name: string; email: string; password: string; phone?: string
  }>()

  if (!name || !contact_name || !email || !password) {
    return c.json({ success: false, error: 'name, contact_name, email, password 필수' }, 400)
  }

  // 🛡️ 길이 제한 (DB bloat 방지)
  if (typeof name !== 'string' || name.length > 100) return c.json({ success: false, error: 'name 100자 이하' }, 400)
  if (typeof contact_name !== 'string' || contact_name.length > 50) return c.json({ success: false, error: 'contact_name 50자 이하' }, 400)
  if (typeof email !== 'string' || email.length > 255 || !email.includes('@')) return c.json({ success: false, error: 'email 형식 오류' }, 400)
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return c.json({ success: false, error: 'password 8~128자' }, 400)
  if (phone && (typeof phone !== 'string' || phone.length > 20)) return c.json({ success: false, error: 'phone 20자 이하' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM agencies WHERE email = ?').bind(email).first()
  if (existing) return c.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, 409)

  const hash = await hashPassword(password)
  const result = await c.env.DB.prepare(`
    INSERT INTO agencies (name, contact_name, email, password_hash, phone)
    VALUES (?, ?, ?, ?, ?)
  `).bind(name, contact_name, email, hash, phone || null).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── PATCH /agencies/:id ───────────────────────────────────────
app.patch('/:id', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const id = Number(c.req.param('id'))
  const { name, contact_name, phone, status, password, commission_rate, tier, tier_locked, auto_settle } = await c.req.json<{
    name?: string; contact_name?: string; phone?: string; status?: string; password?: string;
    commission_rate?: number;
    tier?: 'new'|'junior'|'senior';        // Q1 — 어드민 수동 등급 변경
    tier_locked?: boolean;                  // Q1 — true 면 자동 평가 무시
    auto_settle?: boolean;                  // P0 #3 — 자동 정산 ON/OFF
  }>()

  const existing = await c.env.DB.prepare('SELECT id FROM agencies WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)

  if (password) {
    const hash = await hashPassword(password)
    await c.env.DB.prepare(
      'UPDATE agencies SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(hash, id).run()
  }

  // commission_rate 컬럼 보장
  await c.env.DB.prepare("ALTER TABLE agencies ADD COLUMN commission_rate REAL DEFAULT 2.0").run().catch(swallow('admin:api:admin-agency'))

  if (tier !== undefined && !['new', 'junior', 'senior'].includes(tier)) {
    return c.json({ success: false, error: 'tier must be new/junior/senior' }, 400)
  }

  await c.env.DB.prepare(`
    UPDATE agencies SET
      name = COALESCE(?, name),
      contact_name = COALESCE(?, contact_name),
      phone = COALESCE(?, phone),
      status = COALESCE(?, status),
      commission_rate = COALESCE(?, commission_rate),
      tier = COALESCE(?, tier),
      tier_locked = COALESCE(?, tier_locked),
      tier_evaluated_at = CASE WHEN ? IS NOT NULL THEN datetime('now') ELSE tier_evaluated_at END,
      auto_settle = COALESCE(?, auto_settle),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    name ?? null, contact_name ?? null, phone ?? null, status ?? null, commission_rate ?? null,
    tier ?? null,
    tier_locked === undefined ? null : (tier_locked ? 1 : 0),
    tier ?? null,                                              // tier_evaluated_at 갱신 트리거
    auto_settle === undefined ? null : (auto_settle ? 1 : 0),
    id,
  ).run().catch(async (err) => {
    // tier / tier_locked / auto_settle 컬럼 미존재 (마이그레이션 0212/0208 미적용) → fallback
    if (import.meta.env.DEV) console.warn('[admin:agency:patch] new columns missing, fallback:', err)
    await c.env.DB.prepare(`
      UPDATE agencies SET
        name = COALESCE(?, name),
        contact_name = COALESCE(?, contact_name),
        phone = COALESCE(?, phone),
        status = COALESCE(?, status),
        commission_rate = COALESCE(?, commission_rate),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name ?? null, contact_name ?? null, phone ?? null, status ?? null, commission_rate ?? null, id).run()
  })

  return c.json({ success: true })
})

// ── DELETE /agencies/:id ──────────────────────────────────────
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM agency_sellers WHERE agency_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM agencies WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── POST /agencies/:id/reset-password ─────────────────────────
app.post('/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'))
  const { newPassword } = await c.req.json<{ newPassword: string }>()
  if (!newPassword || newPassword.length < 8) {
    return c.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, 400)
  }
  const existing = await c.env.DB.prepare('SELECT id, email FROM agencies WHERE id = ?').bind(id).first<{ id: number; email: string }>()
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)
  const hash = await hashPassword(newPassword)
  await c.env.DB.prepare(
    'UPDATE agencies SET password_hash = ?, status = \'active\', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(hash, id).run()
  return c.json({ success: true, message: `${existing.email} 비밀번호가 초기화되었고 상태가 active로 변경되었습니다.` })
})

// ── GET /agencies/:id/sellers ─────────────────────────────────
app.get('/:id/sellers', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const agencyId = Number(c.req.param('id'))
  const rows = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.email, s.business_name, s.phone, s.status, s.commission_rate, s.created_at
    FROM sellers s
    INNER JOIN agency_sellers ag ON ag.seller_id = s.id
    WHERE ag.agency_id = ?
    ORDER BY s.created_at DESC
  `).bind(agencyId).all()
  return c.json({ success: true, data: rows.results })
})

// ── POST /agencies/:id/sellers ────────────────────────────────
app.post('/:id/sellers', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const agencyId = Number(c.req.param('id'))
  const { seller_id } = await c.req.json<{ seller_id: number }>()
  if (!seller_id) return c.json({ success: false, error: 'seller_id 필수' }, 400)

  const agency = await c.env.DB.prepare('SELECT id FROM agencies WHERE id = ?').bind(agencyId).first()
  if (!agency) return c.json({ success: false, error: '에이전시를 찾을 수 없습니다.' }, 404)

  const seller = await c.env.DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(seller_id).first()
  if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다.' }, 404)

  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id) VALUES (?, ?)'
  ).bind(agencyId, seller_id).run()

  return c.json({ success: true })
})

// ── DELETE /agencies/:id/sellers/:sellerId ────────────────────
app.delete('/:id/sellers/:sellerId', async (c) => {
  const agencyId = Number(c.req.param('id'))
  const sellerId = Number(c.req.param('sellerId'))
  await c.env.DB.prepare(
    'DELETE FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).run()
  return c.json({ success: true })
})

// ── GET unassigned sellers ─────────────────────────────────────
app.get('/unassigned-sellers', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const rows = await c.env.DB.prepare(`
    SELECT id, name, email, business_name FROM sellers
    WHERE id NOT IN (SELECT seller_id FROM agency_sellers)
    AND status = 'approved'
    ORDER BY name
  `).all()
  return c.json({ success: true, data: rows.results })
})

export { app as adminAgencyRoutes }
