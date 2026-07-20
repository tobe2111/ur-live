/**
 * 🖼️ 2026-07-20 (대표 "카카오 플레이스 사진 API 도 함께 — 가장 이상적으로"): 카카오 플레이스에
 *   **그 매장에 실제로 등록된 사진**을 가져온다. 네이버 이미지검색은 매장명 스코어링을 해도 결국
 *   "그 이름으로 검색된 웹 이미지"라 오매칭 가능성이 남지만, 카카오 플레이스 사진은 **바로 그 place id
 *   의 등록 사진**이라 관련도가 근본적으로 100%.
 *
 * 구현: 카카오맵 공개 상세 JSON(`place.map.kakao.com/main/v/{placeId}`) — 카카오맵 웹이 실제로 쓰는
 *   엔드포인트. 공식 REST Local API 는 사진을 주지 않으므로 이 경로 사용(데모 시드 전용 best-effort).
 *   ⚠️ 비공식이라 언젠가 스키마가 바뀔 수 있음 → **완전 fail-soft**(어떤 에러든 [] 반환) → 호출측이
 *   네이버 스코어링으로 자동 폴백(회귀 0). 반환 URL 은 카카오/다음 CDN(핫링크 허용, https 정상).
 */

// place id 만 필요 — placeUrl(`https://place.map.kakao.com/{id}`) 또는 순수 id 둘 다 허용.
export function extractKakaoPlaceId(placeUrlOrId: string | null | undefined): string | null {
  if (!placeUrlOrId) return null
  const s = String(placeUrlOrId).trim()
  const m = s.match(/(\d{6,})/) // place id 는 6자리+ 숫자
  return m ? m[1] : null
}

interface KakaoPhotoListEntry { orgurl?: string; url?: string; photoUrl?: string }
interface KakaoPhotoGroup { list?: KakaoPhotoListEntry[] }
interface KakaoPlaceDetail {
  isExist?: boolean
  basicInfo?: { mainphotourl?: string }
  photo?: { photoList?: KakaoPhotoGroup[] }
}

function cleanKakaoUrl(u: string | undefined): string | null {
  if (!u || typeof u !== 'string') return null
  let url = u.trim()
  if (!url) return null
  if (url.startsWith('//')) url = 'https:' + url
  url = url.replace(/^http:\/\//, 'https://') // 카카오/다음 CDN 은 https 정상 → 혼합콘텐츠 방지
  if (!/^https:\/\//.test(url)) return null
  // 축소판 파라미터(?original / C{w}x{h}) 는 보존 — 원본이 과대할 때 카카오가 리사이즈.
  return url
}

/**
 * placeId 의 등록 사진 URL 최대 `count` 장(대표 사진 우선). fail-soft — 실패 시 [].
 */
export async function fetchKakaoPlacePhotos(placeUrlOrId: string | null | undefined, count = 5): Promise<string[]> {
  const id = extractKakaoPlaceId(placeUrlOrId)
  if (!id) return []
  const want = Math.max(1, Math.min(8, count))
  try {
    const res = await fetch(`https://place.map.kakao.com/main/v/${id}`, {
      headers: {
        // 카카오맵 웹과 동일 컨텍스트 — Referer 없으면 빈 응답을 줄 수 있음.
        Referer: `https://place.map.kakao.com/${id}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as KakaoPlaceDetail
    if (!data || data.isExist === false) return []
    const out: string[] = []
    const seen = new Set<string>()
    const push = (raw: string | undefined) => {
      const u = cleanKakaoUrl(raw)
      if (u && !seen.has(u)) { seen.add(u); out.push(u) }
    }
    // 1) 대표 사진(있으면 커버로 우선).
    push(data.basicInfo?.mainphotourl)
    // 2) 등록 사진 리스트 순회.
    for (const grp of data.photo?.photoList || []) {
      for (const p of grp.list || []) {
        push(p.orgurl || p.url || p.photoUrl)
        if (out.length >= want) break
      }
      if (out.length >= want) break
    }
    return out.slice(0, want)
  } catch {
    return []
  }
}
