/**
 * 🛡️ 2026-05-19: 이용권 식당 주소 → 좌표 일괄 변환 cron.
 * 🗺️ 2026-06-18: 좌표 → 행정동(洞) 자동 태깅 추가 — 하이퍼로컬 "내 동네 딜" 토대.
 *
 *   매일 KST 04:00 (UTC 19:00) 실행:
 *     - Pass A: restaurant_address 있고 lat/lng 없는 매장 → 카카오 주소검색 → 좌표 저장
 *               → 좌표 확보 직후 카카오 coord2regioncode → product_regions 에 동 태깅
 *     - Pass B: 좌표는 있는데 아직 동 태깅 안 된 기존 매장 백필
 *
 *   product_regions 는 별도 테이블(products 컬럼 예산제 회피 + region_dong_code 인덱스로
 *   "동별 매장 수" 집계 / 향후 "내 동네 딜" 피드 조인). 매장당 1행(UPSERT).
 *
 *   안전:
 *     - 카카오 무료 한도(일 300,000) 대비 1회 batch 수백 건 → 안전 마진.
 *     - 실패 row 는 다음 cron 자연 재시도 (status 컬럼 없이, region_dong NULL 이면 Pass B 재처리).
 */
import { fetchRegion, type RegionInfo } from '../utils/kakao-region'

type Env = {
  DB: D1Database
  KAKAO_REST_API_KEY?: string
}

const _ensuredRegions = new WeakSet<D1Database>()
async function ensureProductRegions(DB: D1Database): Promise<void> {
  if (_ensuredRegions.has(DB)) return
  _ensuredRegions.add(DB)
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS product_regions (
         product_id INTEGER PRIMARY KEY,
         region_si TEXT,
         region_gu TEXT,
         region_dong TEXT,
         region_dong_code TEXT,
         lat REAL,
         lng REAL,
         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
       )`,
    ).run()
  } catch { /* 이미 존재 */ }
  try {
    await DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_product_regions_dong_code ON product_regions(region_dong_code)',
    ).run()
  } catch { /* 이미 존재 */ }
}

async function upsertRegion(DB: D1Database, productId: number, lat: number, lng: number, r: RegionInfo): Promise<boolean> {
  try {
    await DB.prepare(
      `INSERT INTO product_regions (product_id, region_si, region_gu, region_dong, region_dong_code, lat, lng, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(product_id) DO UPDATE SET
         region_si = excluded.region_si,
         region_gu = excluded.region_gu,
         region_dong = excluded.region_dong,
         region_dong_code = excluded.region_dong_code,
         lat = excluded.lat,
         lng = excluded.lng,
         updated_at = datetime('now')`,
    ).bind(productId, r.si, r.gu, r.dong, r.dongCode, lat, lng).run()
    return true
  } catch {
    return false
  }
}

/**
 * 🧭 2026-07-02 (대표 승인 "가장 이상적으로"): 상품 **등록/수정 시점** 단일 지오코딩.
 *   일일 cron 전의 갭(당일 등록 딜은 좌표 없음 → 방문자마다 클라 지오코딩 폴백)을 원천 제거 —
 *   등록 직후 waitUntil 로 좌표+동 태깅을 즉시 저장하면 클라 폴백이 애초에 발동하지 않음.
 *
 * - force=false(생성): 좌표가 이미 있으면 skip (클라가 좌표를 함께 보낸 경우 중복 호출 0).
 * - force=true(주소 수정): 기존 좌표를 새 주소 기준으로 재계산·덮어씀 (수정 경로엔 lat/lng
 *   필드가 없어 주소 변경 시 좌표가 영구 stale 이던 갭 해결). 카카오 실패 시 기존 좌표 유지.
 * - fail-soft: 어떤 실패도 등록/수정 자체를 막지 않음 — 좌표 NULL 이면 일일 cron 이 자연 재시도.
 */
export async function geocodeProductNow(env: Env, productId: number, opts?: { force?: boolean }): Promise<boolean> {
  try {
    const key = env.KAKAO_REST_API_KEY
    if (!key || !Number.isFinite(productId) || productId <= 0) return false
    const p = await env.DB.prepare(
      `SELECT restaurant_address AS addr, restaurant_lat AS lat, restaurant_lng AS lng
         FROM products WHERE id = ?`,
    ).bind(productId).first<{ addr: string | null; lat: number | null; lng: number | null }>()
    if (!p?.addr) return false
    if (!opts?.force && p.lat != null && p.lng != null) return false
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(p.addr)}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res.ok) return false
    const data = await res.json() as { documents?: Array<{ x?: string; y?: string }> }
    const doc = data.documents?.[0]
    const lng = Number(doc?.x); const lat = Number(doc?.y)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
    await env.DB.prepare(
      `UPDATE products SET restaurant_lat = ?, restaurant_lng = ?, updated_at = datetime('now') WHERE id = ?`,
    ).bind(lat, lng, productId).run()
    // 동 태깅 (cron Pass A 와 동일 — 하이퍼로컬 "내 동네 딜" 토대). best-effort.
    await ensureProductRegions(env.DB)
    const region = await fetchRegion(lng, lat, key)
    if (region) await upsertRegion(env.DB, productId, lat, lng, region)
    return true
  } catch {
    return false  // fail-soft — 좌표 NULL 이면 일일 cron 이 다음 실행에서 재시도
  }
}

export async function runRestaurantGeocode(env: Env): Promise<{
  total: number; updated: number; failed: number; skipped: number; tagged: number;
}> {
  if (!env.KAKAO_REST_API_KEY) {
    return { total: 0, updated: 0, failed: 0, skipped: 0, tagged: 0 }
  }
  const key = env.KAKAO_REST_API_KEY
  await ensureProductRegions(env.DB)

  let updated = 0
  let failed = 0
  let skipped = 0
  let tagged = 0

  // ── Pass A: 주소 → 좌표 (+ 좌표 → 동 태깅) ──────────────────────────
  const rows = await env.DB.prepare(
    `SELECT id, restaurant_address
       FROM products
      WHERE is_active = 1
        AND restaurant_address IS NOT NULL
        AND restaurant_address != ''
        AND (restaurant_lat IS NULL OR restaurant_lng IS NULL)
      LIMIT 100`,
  ).all<{ id: number; restaurant_address: string }>().catch(() => ({ results: [] as Array<{ id: number; restaurant_address: string }> }))
  const items = rows.results || []

  for (const item of items) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(item.restaurant_address)}`
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
      if (!res.ok) { failed++; continue }
      const data = await res.json() as { documents?: Array<{ x?: string; y?: string }> }
      const doc = data.documents?.[0]
      if (!doc?.x || !doc?.y) { skipped++; continue }
      const lng = Number(doc.x); const lat = Number(doc.y)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue }

      await env.DB.prepare(
        `UPDATE products SET restaurant_lat = ?, restaurant_lng = ?, updated_at = datetime('now')
          WHERE id = ?`,
      ).bind(lat, lng, item.id).run().catch(() => { failed++; return null })
      updated++

      // 좌표 확보 직후 동 태깅 (best-effort — 실패해도 Pass B 가 재시도).
      const region = await fetchRegion(lng, lat, key)
      if (region && (await upsertRegion(env.DB, item.id, lat, lng, region))) tagged++
    } catch {
      failed++
    }
  }

  // ── Pass B: 좌표 있으나 동 태깅 안 된 기존 매장 백필 ────────────────
  const backfill = await env.DB.prepare(
    `SELECT p.id AS id, p.restaurant_lat AS lat, p.restaurant_lng AS lng
       FROM products p
       LEFT JOIN product_regions r ON r.product_id = p.id
      WHERE p.is_active = 1
        AND p.restaurant_lat IS NOT NULL
        AND p.restaurant_lng IS NOT NULL
        AND (r.product_id IS NULL OR r.region_dong IS NULL OR r.region_dong = '')
      LIMIT 120`,
  ).all<{ id: number; lat: number; lng: number }>().catch(() => ({ results: [] as Array<{ id: number; lat: number; lng: number }> }))
  const bItems = backfill.results || []

  for (const b of bItems) {
    const lat = Number(b.lat); const lng = Number(b.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue }
    const region = await fetchRegion(lng, lat, key)
    if (region && (await upsertRegion(env.DB, b.id, lat, lng, region))) tagged++
    else failed++
  }

  return { total: items.length + bItems.length, updated, failed, skipped, tagged }
}
