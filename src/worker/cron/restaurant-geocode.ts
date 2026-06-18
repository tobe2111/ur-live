/**
 * 🛡️ 2026-05-19: 식사권 식당 주소 → 좌표 일괄 변환 cron.
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

interface RegionInfo { si: string; gu: string; dong: string; dongCode: string }

/** 좌표 → 행정동(H). 실패 시 null (다음 cron Pass B 가 자연 재시도). */
async function fetchRegion(lng: number, lat: number, key: string): Promise<RegionInfo | null> {
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res.ok) return null
    const data = await res.json() as {
      documents?: Array<{ region_type?: string; code?: string; region_1depth_name?: string; region_2depth_name?: string; region_3depth_name?: string }>
    }
    const docs = data.documents || []
    // 행정동(H) 우선, 없으면 법정동(B) 폴백.
    const doc = docs.find((d) => d.region_type === 'H') || docs.find((d) => d.region_type === 'B') || docs[0]
    const dong = (doc?.region_3depth_name || '').trim()
    if (!doc || !dong) return null
    return {
      si: (doc.region_1depth_name || '').trim(),
      gu: (doc.region_2depth_name || '').trim(),
      dong,
      dongCode: (doc.code || '').trim(),
    }
  } catch {
    return null
  }
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
