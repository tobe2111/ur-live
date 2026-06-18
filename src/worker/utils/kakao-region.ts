/**
 * 🗺️ 2026-06-18: 카카오 좌표 → 행정동(洞) 변환 SSOT.
 *
 * 매장 태깅 cron(restaurant-geocode) + 유저 동 태깅(region.routes) 양쪽이 공유.
 * 카카오 `coord2regioncode`: 좌표(x=lng, y=lat) → 행정구역. 행정동(H) 우선, 법정동(B) 폴백.
 * region_dong_code(행정동 10자리)의 앞 5자리 = 시군구 코드 → "내 지역(구)" 필터에 사용.
 */

export interface RegionInfo {
  si: string
  gu: string
  dong: string
  dongCode: string
}

/** 좌표 → 행정동(H). 실패/빈 응답 시 null. */
export async function fetchRegion(lng: number, lat: number, key: string): Promise<RegionInfo | null> {
  if (!key || !Number.isFinite(lng) || !Number.isFinite(lat)) return null
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res.ok) return null
    const data = await res.json() as {
      documents?: Array<{ region_type?: string; code?: string; region_1depth_name?: string; region_2depth_name?: string; region_3depth_name?: string }>
    }
    const docs = data.documents || []
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

/** 행정동 코드(10자리) → 시군구 코드(앞 5자리). 빈/짧으면 ''. */
export function guCodeOf(dongCode: string | null | undefined): string {
  const c = String(dongCode || '').trim()
  return c.length >= 5 ? c.slice(0, 5) : ''
}
