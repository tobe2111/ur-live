/**
 * 🏬 2026-06-09 도매몰 멀티-몰 테넌시 — 어드민 몰 관리 CRUD (v1, 검토 필요).
 *
 * 슈퍼-어드민이 카테고리별 도매몰(식품/패션 등)을 생성/수정/비활성. 한 운영자, 몰별 회원가입(모델 B).
 *   - GET    /api/admin/wholesale-malls       — 전체 몰 목록
 *   - POST   /api/admin/wholesale-malls       — 몰 생성
 *   - PATCH  /api/admin/wholesale-malls/:id    — 몰 수정
 *
 * ⚠️ adminApp(IP whitelist + requireAdmin + audit) 체인. 기본 몰(id=1)은 비활성/삭제 금지(가드).
 *    캐시 무효화: 변경 후 invalidateMallCache 로 즉시 반영.
 * 마운트: app.route('/api/admin/wholesale-malls', adminWholesaleMallRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { ensureMallSchema, invalidateMallCache, DEFAULT_MALL_ID } from './wholesale-malls'

const app = new Hono<{ Bindings: Env }>()
app.use('*', adminIpWhitelist())
app.use('*', requireAdmin())
app.use('*', adminAuditMiddleware())

// slug: 소문자/숫자/하이픈만 (host 라우팅·URL 안전). 길이 cap. 미충족 시 null.
function cleanSlug(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().slice(0, 40)
  if (!s || !/^[a-z0-9-]+$/.test(s)) return null
  return s
}
// host: 다중 호스트 'a.com,b.com' 허용. 소문자·공백제거. 길이 cap. 빈 값 → null.
function cleanHost(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().slice(0, 300)
  return s || null
}
function cleanText(raw: unknown, max: number): string | null {
  const s = String(raw ?? '').trim().slice(0, max)
  return s || null
}

// ── GET / — 전체 몰 목록 ──────────────────────────────────────────────────────
app.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureMallSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, active, created_at
       FROM wholesale_malls ORDER BY id ASC LIMIT 200`
    ).all()
    return c.json({ success: true, malls: results ?? [] })
  } catch (err) {
    return safeError(c, err, '몰 목록 조회 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

// ── POST / — 몰 생성 ──────────────────────────────────────────────────────────
app.post('/', rateLimit({ action: 'admin-wholesale-mall-create', max: 20, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  try {
    await ensureMallSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const slug = cleanSlug(body.slug)
    if (!slug) return c.json({ success: false, error: 'slug 는 영소문자/숫자/하이픈만 사용할 수 있습니다' }, 400)
    const name = cleanText(body.name, 80)
    if (!name) return c.json({ success: false, error: '몰 이름을 입력해주세요' }, 400)
    const host = cleanHost(body.host)
    const brand_name = cleanText(body.brand_name, 80)
    const brand_color = cleanText(body.brand_color, 20)
    const logo_url = cleanText(body.logo_url, 1000)
    const deposit_account = cleanText(body.deposit_account, 500)
    const commission_rate = Number.isFinite(Number(body.commission_rate)) ? Number(body.commission_rate) : null
    const categories_json = cleanText(body.categories_json, 4000)
    const active = Number(body.active) === 0 ? 0 : 1

    // slug 중복 차단 (UNIQUE 와 정합 — 친절한 메시지).
    const dupe = await DB.prepare('SELECT id FROM wholesale_malls WHERE slug = ?').bind(slug).first<{ id: number }>().catch(() => null)
    if (dupe) return c.json({ success: false, error: '이미 사용 중인 slug 입니다' }, 409)

    const ins = await DB.prepare(
      `INSERT INTO wholesale_malls (slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, active).run()
    const id = Number(ins.meta?.last_row_id)
    if (!id) return c.json({ success: false, error: '몰 생성 중 오류가 발생했습니다' }, 500)
    invalidateMallCache(DB)
    return c.json({ success: true, id })
  } catch (err) {
    return safeError(c, err, '몰 생성 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

// ── PATCH /:id — 몰 수정 ──────────────────────────────────────────────────────
app.patch('/:id', rateLimit({ action: 'admin-wholesale-mall-update', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 몰 ID' }, 400)
  try {
    await ensureMallSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const binds: (string | number | null)[] = []
    if ('slug' in body) {
      const s = cleanSlug(body.slug)
      if (!s) return c.json({ success: false, error: 'slug 는 영소문자/숫자/하이픈만 사용할 수 있습니다' }, 400)
      // slug 중복(다른 몰) 차단.
      const dupe = await DB.prepare('SELECT id FROM wholesale_malls WHERE slug = ? AND id <> ?').bind(s, id).first<{ id: number }>().catch(() => null)
      if (dupe) return c.json({ success: false, error: '이미 사용 중인 slug 입니다' }, 409)
      sets.push('slug = ?'); binds.push(s)
    }
    if ('name' in body) { const v = cleanText(body.name, 80); if (!v) return c.json({ success: false, error: '몰 이름을 입력해주세요' }, 400); sets.push('name = ?'); binds.push(v) }
    if ('host' in body) { sets.push('host = ?'); binds.push(cleanHost(body.host)) }
    if ('brand_name' in body) { sets.push('brand_name = ?'); binds.push(cleanText(body.brand_name, 80)) }
    if ('brand_color' in body) { sets.push('brand_color = ?'); binds.push(cleanText(body.brand_color, 20)) }
    if ('logo_url' in body) { sets.push('logo_url = ?'); binds.push(cleanText(body.logo_url, 1000)) }
    if ('deposit_account' in body) { sets.push('deposit_account = ?'); binds.push(cleanText(body.deposit_account, 500)) }
    if ('commission_rate' in body) { sets.push('commission_rate = ?'); binds.push(Number.isFinite(Number(body.commission_rate)) ? Number(body.commission_rate) : null) }
    if ('categories_json' in body) { sets.push('categories_json = ?'); binds.push(cleanText(body.categories_json, 4000)) }
    if ('active' in body) {
      const act = Number(body.active) === 0 ? 0 : 1
      // 🔒 INVARIANT 가드: 기본 몰(id=1)은 비활성 금지(전 데이터의 기본 몰 — 비활성 시 카탈로그/배너 전멸).
      if (id === DEFAULT_MALL_ID && act === 0) return c.json({ success: false, error: '기본 몰은 비활성화할 수 없습니다' }, 400)
      sets.push('active = ?'); binds.push(act)
    }
    if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
    binds.push(id)
    const up = await DB.prepare(`UPDATE wholesale_malls SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '몰을 찾을 수 없습니다' }, 404)
    invalidateMallCache(DB)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '몰 수정 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

export { app as adminWholesaleMallRoutes }
