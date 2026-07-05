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

// 🏙️ 2026-07-04 (상권관 랜딩 — B2G 상권 패키지): 지역코드 → 표시명 해석. 카카오 호출 없이
//   이미 태깅된 product_regions 에서 조회(시군구 5자리 prefix / 행정동 10자리 모두 지원).
//   공개·불변성 높은 데이터라 엣지 캐시. 데이터 없으면 null(페이지가 '우리 동네' 폴백).
publicRegionRoutes.get('/label', async (c) => {
  const code = String(c.req.query('code') || '').trim()
  if (!/^\d{5,12}$/.test(code)) return c.json({ success: false, error: '지역 코드는 숫자 5~12자리' }, 400)
  const row = await c.env.DB.prepare(
    `SELECT region_si, region_gu, region_dong FROM product_regions
      WHERE region_dong_code LIKE ? AND region_gu IS NOT NULL AND region_gu != '' LIMIT 1`,
  ).bind(`${code}%`).first<{ region_si: string | null; region_gu: string | null; region_dong: string | null }>().catch(() => null)
  c.header('Cache-Control', 'public, max-age=300')
  c.header('CDN-Cache-Control', 'public, max-age=3600')
  return c.json({
    success: true,
    data: row ? {
      region_si: row.region_si,
      region_gu: row.region_gu,
      // 행정동 코드(10자리)로 조회한 경우에만 동 표시가 의미 있음 — 시군구(5자리)면 구 단위 라벨.
      region_dong: code.length >= 8 ? row.region_dong : null,
    } : null,
  })
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

// 📊 2026-07-04 (상권 성과 리포트 — B2G 수주처 제출용, 대표 "다음 꺼 해줘"):
//   특정 상권(시군구 5자리/행정동 10자리 prefix)의 매장·딜·이용권 판매/사용·체험단 성과 집계.
//   AdminRevenueAnalytics(기간 집계) + RegionDensity(product_regions 조인) 패턴 합성 — 읽기 전용.
//   GMV 는 vouchers(이용권 발급, applied_price) 기준 — 동네딜 상권 사업의 핵심 지표.
adminRegionRoutes.get('/report', requireAdmin(), async (c) => {
  const { DB } = c.env
  const code = String(c.req.query('region') || '').trim()
  if (!/^\d{5,12}$/.test(code)) return c.json({ success: false, error: 'region 은 지역코드(숫자 5~12자리)' }, 400)
  const days = (() => {
    const n = parseInt(String(c.req.query('days') || '30'), 10)
    return Number.isFinite(n) && n >= 1 && n <= 365 ? n : 30
  })()
  const like = `${code}%`
  const since = `-${days} days`

  // ① 매장/딜 현황 (현재 시점)
  const stores = await DB.prepare(
    `SELECT COUNT(DISTINCT pr.product_id) AS deals,
            COUNT(DISTINCT COALESCE(p.restaurant_name, p.seller_id)) AS stores
       FROM product_regions pr JOIN products p ON p.id = pr.product_id
      WHERE pr.region_dong_code LIKE ? AND p.is_active = 1`,
  ).bind(like).first<{ deals: number; stores: number }>().catch(() => null)

  // ② 이용권 판매(발급)·사용 — 기간 내, KST
  const voucherAgg = await DB.prepare(
    `SELECT COUNT(*) AS issued,
            COALESCE(SUM(v.applied_price), 0) AS issued_amount,
            SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used,
            COALESCE(SUM(CASE WHEN v.status = 'used' THEN v.applied_price ELSE 0 END), 0) AS used_amount
       FROM vouchers v JOIN product_regions pr ON pr.product_id = v.product_id
      WHERE pr.region_dong_code LIKE ?
        AND v.created_at >= datetime('now', ?)`,
  ).bind(like, since).first<{ issued: number; issued_amount: number; used: number; used_amount: number }>().catch(() => null)

  // ③ 체험단(FCFS) — 응모/당첨/결제완료 (기간 내 응모 기준)
  const fcfsAgg = await DB.prepare(
    `SELECT COUNT(*) AS applied,
            SUM(CASE WHEN f.status IN ('selected','paid') THEN 1 ELSE 0 END) AS selected,
            SUM(CASE WHEN f.status = 'paid' THEN 1 ELSE 0 END) AS paid
       FROM fcfs_applications f JOIN product_regions pr ON pr.product_id = f.product_id
      WHERE pr.region_dong_code LIKE ?
        AND f.created_at >= datetime('now', ?)`,
  ).bind(like, since).first<{ applied: number; selected: number; paid: number }>().catch(() => null)

  // ④ 동별 분해 (매장 밀도 + 기간 판매)
  const byDong = await DB.prepare(
    `SELECT pr.region_dong AS dong, pr.region_dong_code AS dong_code,
            COUNT(DISTINCT pr.product_id) AS deals,
            COALESCE(SUM(CASE WHEN v.created_at >= datetime('now', ?) THEN v.applied_price ELSE 0 END), 0) AS issued_amount,
            SUM(CASE WHEN v.created_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS issued
       FROM product_regions pr
       JOIN products p ON p.id = pr.product_id AND p.is_active = 1
       LEFT JOIN vouchers v ON v.product_id = pr.product_id
      WHERE pr.region_dong_code LIKE ? AND pr.region_dong IS NOT NULL AND pr.region_dong != ''
      GROUP BY pr.region_dong_code
      ORDER BY issued_amount DESC, deals DESC
      LIMIT 100`,
  ).bind(since, since, like).all().catch(() => ({ results: [] as unknown[] }))

  // ⑤ 일별 판매 추이 (차트용, KST)
  const daily = await DB.prepare(
    `SELECT DATE(v.created_at, '+9 hours') AS day,
            COUNT(*) AS issued, COALESCE(SUM(v.applied_price), 0) AS amount
       FROM vouchers v JOIN product_regions pr ON pr.product_id = v.product_id
      WHERE pr.region_dong_code LIKE ? AND v.created_at >= datetime('now', ?)
      GROUP BY DATE(v.created_at, '+9 hours') ORDER BY day ASC`,
  ).bind(like, since).all().catch(() => ({ results: [] as unknown[] }))

  // ⑥ 📡 2026-07-05 소스별 유입 퍼널 (시설물 QR ?src= / UTM) — 랜딩 → 가입 → 첫구매.
  //   랜딩: acquisition_landings (이 상권 랜딩 + 상권 미지정 랜딩은 코드 무관 소스로 별도 노출 안 함 —
  //   region_code 가 이 상권이거나 NULL(전역 소스: insta 등)인 것 포함). 가입/첫구매: user_acquisition.
  const { ensureAcquisitionTables } = await import('../utils/acquisition')
  await ensureAcquisitionTables(DB)
  const sources = await DB.prepare(
    `SELECT s.src AS src,
            COALESCE(l.landings, 0) AS landings,
            COALESCE(u.signups, 0) AS signups,
            COALESCE(u.first_purchases, 0) AS first_purchases
       FROM (
         SELECT src FROM acquisition_landings WHERE (region_code LIKE ? OR region_code IS NULL) AND created_at >= datetime('now', ?)
         UNION
         SELECT src FROM user_acquisition WHERE (region_code LIKE ? OR region_code IS NULL) AND claimed_at >= datetime('now', ?)
       ) s
       LEFT JOIN (
         SELECT src, COUNT(*) AS landings FROM acquisition_landings
          WHERE (region_code LIKE ? OR region_code IS NULL) AND created_at >= datetime('now', ?) GROUP BY src
       ) l ON l.src = s.src
       LEFT JOIN (
         SELECT src, COUNT(*) AS signups,
                SUM(CASE WHEN first_order_at IS NOT NULL THEN 1 ELSE 0 END) AS first_purchases
           FROM user_acquisition
          WHERE (region_code LIKE ? OR region_code IS NULL) AND claimed_at >= datetime('now', ?) GROUP BY src
       ) u ON u.src = s.src
      ORDER BY landings DESC, signups DESC
      LIMIT 50`,
  ).bind(like, since, like, since, like, since, like, since).all().catch(() => ({ results: [] as unknown[] }))

  // 라벨
  const label = await DB.prepare(
    `SELECT region_si, region_gu FROM product_regions WHERE region_dong_code LIKE ? AND region_gu != '' LIMIT 1`,
  ).bind(like).first<{ region_si: string | null; region_gu: string | null }>().catch(() => null)

  return c.json({
    success: true,
    data: {
      region: { code, si: label?.region_si ?? null, gu: label?.region_gu ?? null },
      days,
      stores: Number(stores?.stores) || 0,
      deals: Number(stores?.deals) || 0,
      vouchers: {
        issued: Number(voucherAgg?.issued) || 0,
        issued_amount: Number(voucherAgg?.issued_amount) || 0,
        used: Number(voucherAgg?.used) || 0,
        used_amount: Number(voucherAgg?.used_amount) || 0,
      },
      fcfs: {
        applied: Number(fcfsAgg?.applied) || 0,
        selected: Number(fcfsAgg?.selected) || 0,
        paid: Number(fcfsAgg?.paid) || 0,
      },
      by_dong: byDong.results || [],
      daily: daily.results || [],
      sources: sources.results || [],
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 🏙️ 2026-07-05 상권 방문 리워드 캠페인 (B2G 상권 패키지 — 실행계획 "첫 구매 시 무상 딜 지급").
//   지급 트리거/멱등/캡/역전은 worker/utils/visit-reward.ts SSOT — 여기는 어드민 CRUD + 현황만.
// ─────────────────────────────────────────────────────────────────────────

// 캠페인 목록 + 지급 현황 (건수/소진액)
adminRegionRoutes.get('/visit-rewards', requireAdmin(), async (c) => {
  const { DB } = c.env
  const { ensureVisitRewardTables } = await import('../utils/visit-reward')
  await ensureVisitRewardTables(DB)
  const rows = await DB.prepare(
    `SELECT c.id, c.name, c.region_code, c.reward_amount, c.total_budget, c.starts_at, c.ends_at, c.status, c.created_at,
            COALESCE(SUM(CASE WHEN g.status = 'granted' THEN g.amount ELSE 0 END), 0) AS spent,
            SUM(CASE WHEN g.status = 'granted' THEN 1 ELSE 0 END) AS granted_count,
            SUM(CASE WHEN g.status = 'revoked' THEN 1 ELSE 0 END) AS revoked_count
       FROM visit_reward_campaigns c
       LEFT JOIN visit_reward_grants g ON g.campaign_id = c.id
      GROUP BY c.id ORDER BY c.id DESC LIMIT 100`,
  ).all().catch(() => ({ results: [] as unknown[] }))
  return c.json({ success: true, data: rows.results || [] })
})

// 캠페인 생성
adminRegionRoutes.post('/visit-rewards', requireAdmin(), async (c) => {
  const { DB } = c.env
  const body = await c.req.json<{
    name?: string; region_code?: string; reward_amount?: number; total_budget?: number;
    starts_at?: string; ends_at?: string;
  }>().catch(() => ({} as Record<string, never>))
  const name = String(body.name || '').trim().slice(0, 80)
  const regionCode = String(body.region_code || '').trim()
  const rewardAmount = Math.round(Number(body.reward_amount))
  const totalBudget = Math.round(Number(body.total_budget))
  if (!name) return c.json({ success: false, error: '캠페인 이름이 필요합니다' }, 400)
  if (!/^\d{5,12}$/.test(regionCode)) return c.json({ success: false, error: '지역코드는 숫자 5~12자리 (시군구5/행정동10)' }, 400)
  if (!Number.isFinite(rewardAmount) || rewardAmount < 100 || rewardAmount > 100_000) {
    return c.json({ success: false, error: '지급액은 100~100,000딜' }, 400)
  }
  if (!Number.isFinite(totalBudget) || totalBudget < rewardAmount || totalBudget > 100_000_000) {
    return c.json({ success: false, error: '총액 캡은 지급액 이상 ~ 1억딜 이하' }, 400)
  }
  const startsAt = body.starts_at ? String(body.starts_at).slice(0, 25) : null
  const endsAt = body.ends_at ? String(body.ends_at).slice(0, 25) : null
  const { ensureVisitRewardTables } = await import('../utils/visit-reward')
  await ensureVisitRewardTables(DB)
  const r = await DB.prepare(
    `INSERT INTO visit_reward_campaigns (name, region_code, reward_amount, total_budget, starts_at, ends_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
  ).bind(name, regionCode, rewardAmount, totalBudget, startsAt, endsAt).run()
  return c.json({ success: true, data: { id: r.meta?.last_row_id } })
})

// 캠페인 상태 변경 (종료/재활성) — 값 필드 수정은 지급 정합 혼선 방지 위해 미지원(새 캠페인 생성 권장)
adminRegionRoutes.patch('/visit-rewards/:id', requireAdmin(), async (c) => {
  const { DB } = c.env
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 id' }, 400)
  const body = await c.req.json<{ status?: string }>().catch(() => ({} as Record<string, never>))
  const status = String(body.status || '')
  if (status !== 'active' && status !== 'ended') {
    return c.json({ success: false, error: "status 는 'active' | 'ended'" }, 400)
  }
  const { ensureVisitRewardTables } = await import('../utils/visit-reward')
  await ensureVisitRewardTables(DB)
  const r = await DB.prepare('UPDATE visit_reward_campaigns SET status = ? WHERE id = ?')
    .bind(status, id).run().catch(() => null)
  if (!r?.meta?.changes) return c.json({ success: false, error: '캠페인을 찾을 수 없습니다' }, 404)
  return c.json({ success: true })
})
