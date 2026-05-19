/**
 * 🛡️ 2026-05-19: 식사권 식당 주소 → 좌표 일괄 변환 cron.
 *
 *   매일 KST 04:00 (UTC 19:00) 실행:
 *     - products.restaurant_address 있지만 lat/lng 비어있는 row 찾기
 *     - 카카오 주소 검색 API 로 좌표 획득
 *     - products UPDATE lat, lng
 *
 *   효과: /restaurant-map 페이지 클라이언트에서 매번 카카오 API 호출 제거.
 *         사용자 1명당 ~10 호출 절약 → 일 트래픽 1000명 기준 10,000 호출/일 절감.
 *
 *   안전:
 *     - 1회 batch 100건 한도 (Kakao 무료 한도 300,000/일 안전 마진)
 *     - 실패 row 는 다음 cron 에서 재시도 (status 컬럼 없이 자연 retry)
 */
type Env = {
  DB: D1Database
  KAKAO_REST_API_KEY?: string
}

export async function runRestaurantGeocode(env: Env): Promise<{
  total: number; updated: number; failed: number; skipped: number;
}> {
  if (!env.KAKAO_REST_API_KEY) {
    return { total: 0, updated: 0, failed: 0, skipped: 0 }
  }

  // 좌표 없는 식사권 식당 조회.
  const rows = await env.DB.prepare(
    `SELECT id, restaurant_address
       FROM products
      WHERE is_active = 1
        AND restaurant_address IS NOT NULL
        AND restaurant_address != ''
        AND (restaurant_lat IS NULL OR restaurant_lng IS NULL)
      LIMIT 100`
  ).all<{ id: number; restaurant_address: string }>().catch(() => ({ results: [] }))

  const items = rows.results || []
  if (items.length === 0) return { total: 0, updated: 0, failed: 0, skipped: 0 }

  let updated = 0
  let failed = 0
  let skipped = 0

  for (const item of items) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(item.restaurant_address)}`
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` },
      })
      if (!res.ok) { failed++; continue }
      const data = await res.json() as { documents?: Array<{ x?: string; y?: string }> }
      const doc = data.documents?.[0]
      if (!doc?.x || !doc?.y) { skipped++; continue }
      const lng = Number(doc.x); const lat = Number(doc.y)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue }

      await env.DB.prepare(
        `UPDATE products SET restaurant_lat = ?, restaurant_lng = ?, updated_at = datetime('now')
          WHERE id = ?`
      ).bind(lat, lng, item.id).run().catch(() => { failed++; return null })
      updated++
    } catch {
      failed++
    }
  }

  return { total: items.length, updated, failed, skipped }
}
