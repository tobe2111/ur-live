/**
 * 🗺️ 2026-06-18: 하이퍼로컬 — 유저 동(洞) 태깅 + 어드민 동별 밀도 보드.
 *
 *  - meRegionRoutes  (/api/me): 유저가 자기 "내 동네"를 설정/조회 (GPS 좌표 또는 수동 동코드).
 *  - adminRegionRoutes (/api/admin/region): 동/구별 활성 딜 밀도 — 영입 타겟 결정용.
 *
 *  매장 태깅(product_regions, restaurant-geocode cron)과 같은 카카오 coord2regioncode SSOT 사용.
 */
import { Hono } from 'hono'
import { requireAuth, requireAdmin, getCurrentUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import type { Env } from '../types/env'
import { fetchRegion, guCodeOf } from '../utils/kakao-region'

const _ensuredUserRegions = new WeakSet<D1Database>()
async function ensureUserRegions(DB: D1Database): Promise<void> {
  if (_ensuredUserRegions.has(DB)) return
  _ensuredUserRegions.add(DB)
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_regions (
         user_id TEXT PRIMARY KEY,
         region_si TEXT,
         region_gu TEXT,
         region_dong TEXT,
         region_dong_code TEXT,
         gu_code TEXT,
         source TEXT,
         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
       )`,
    ).run()
  } catch { /* 이미 존재 */ }
}

export const meRegionRoutes = new Hono<{ Bindings: Env }>()

// 내 동네 조회.
meRegionRoutes.get('/region', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureUserRegions(DB)
  const row = await DB.prepare(
    'SELECT region_si, region_gu, region_dong, region_dong_code, gu_code, source, updated_at FROM user_regions WHERE user_id = ?',
  ).bind(String(user.id)).first().catch(() => null)
  return c.json({ success: true, data: row || null })
})

// 내 동네 설정 — GPS 좌표(lat/lng) 또는 수동 동코드.
meRegionRoutes.post('/region', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureUserRegions(DB)
  const body = await c.req.json<{
    lat?: number; lng?: number;
    region_dong_code?: string; region_dong?: string; region_gu?: string; region_si?: string;
  }>().catch(() => ({} as Record<string, never>))

  let si = '', gu = '', dong = '', dongCode = '', source = 'manual'
  const lat = Number((body as { lat?: number }).lat)
  const lng = Number((body as { lng?: number }).lng)

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const key = (c.env as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY
    if (!key) return c.json({ success: false, error: '위치 서비스가 설정되지 않았어요' }, 503)
    const r = await fetchRegion(lng, lat, key)
    if (!r) return c.json({ success: false, error: '동네를 찾지 못했어요. 다시 시도해주세요.' }, 422)
    si = r.si; gu = r.gu; dong = r.dong; dongCode = r.dongCode; source = 'gps'
  } else if ((body as { region_dong_code?: string }).region_dong_code || (body as { region_dong?: string }).region_dong) {
    dongCode = String((body as { region_dong_code?: string }).region_dong_code || '').trim().slice(0, 12)
    dong = String((body as { region_dong?: string }).region_dong || '').trim().slice(0, 40)
    gu = String((body as { region_gu?: string }).region_gu || '').trim().slice(0, 40)
    si = String((body as { region_si?: string }).region_si || '').trim().slice(0, 40)
    if (!dong && !dongCode) return c.json({ success: false, error: '동네 정보가 필요해요' }, 400)
  } else {
    return c.json({ success: false, error: '위치(lat/lng) 또는 동네 코드가 필요해요' }, 400)
  }

  const guCode = guCodeOf(dongCode)
  await DB.prepare(
    `INSERT INTO user_regions (user_id, region_si, region_gu, region_dong, region_dong_code, gu_code, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       region_si = excluded.region_si, region_gu = excluded.region_gu,
       region_dong = excluded.region_dong, region_dong_code = excluded.region_dong_code,
       gu_code = excluded.gu_code, source = excluded.source, updated_at = datetime('now')`,
  ).bind(String(user.id), si, gu, dong, dongCode, guCode, source).run()

  return c.json({ success: true, data: { region_si: si, region_gu: gu, region_dong: dong, region_dong_code: dongCode, gu_code: guCode, source } })
})

// 🗺️ 공개 — 좌표 → 동네 해석(미저장). 비로그인 "내 동네 자동 감지"용. rate-limit 으로 카카오 한도 보호.
export const publicRegionRoutes = new Hono<{ Bindings: Env }>()

publicRegionRoutes.get('/resolve', rateLimit({ action: 'region_resolve', max: 20, windowSec: 60 }), async (c) => {
  const lat = Number(c.req.query('lat'))
  const lng = Number(c.req.query('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json({ success: false, error: '좌표(lat/lng)가 필요해요' }, 400)
  }
  const key = (c.env as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY
  if (!key) return c.json({ success: false, error: '위치 서비스가 설정되지 않았어요' }, 503)
  const r = await fetchRegion(lng, lat, key)
  if (!r) return c.json({ success: false, error: '동네를 찾지 못했어요' }, 422)
  return c.json({ success: true, data: { region_si: r.si, region_gu: r.gu, region_dong: r.dong, region_dong_code: r.dongCode, gu_code: guCodeOf(r.dongCode) } })
})

export const adminRegionRoutes = new Hono<{ Bindings: Env }>()

// 동/구별 활성 딜 밀도 — "어느 동네에 딜이 깔렸나 / 어디가 비었나" 영입 타겟용.
adminRegionRoutes.get('/density', requireAdmin(), async (c) => {
  const { DB } = c.env
  const byDong = await DB.prepare(
    `SELECT pr.region_si AS region_si, pr.region_gu AS region_gu, pr.region_dong AS region_dong,
            pr.region_dong_code AS region_dong_code, COUNT(*) AS product_count
       FROM product_regions pr
       JOIN products p ON p.id = pr.product_id
      WHERE p.is_active = 1 AND pr.region_dong IS NOT NULL AND pr.region_dong != ''
      GROUP BY pr.region_dong_code
      ORDER BY product_count DESC
      LIMIT 300`,
  ).all().catch(() => ({ results: [] as unknown[] }))
  const byGu = await DB.prepare(
    `SELECT pr.region_si AS region_si, pr.region_gu AS region_gu,
            substr(pr.region_dong_code, 1, 5) AS gu_code, COUNT(*) AS product_count
       FROM product_regions pr
       JOIN products p ON p.id = pr.product_id
      WHERE p.is_active = 1 AND pr.region_gu IS NOT NULL AND pr.region_gu != ''
      GROUP BY substr(pr.region_dong_code, 1, 5)
      ORDER BY product_count DESC
      LIMIT 200`,
  ).all().catch(() => ({ results: [] as unknown[] }))
  return c.json({ success: true, data: { by_dong: byDong.results || [], by_gu: byGu.results || [] } })
})
