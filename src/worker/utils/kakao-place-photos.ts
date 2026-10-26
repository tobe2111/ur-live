/**
 * 🖼️ 2026-07-20 (대표 "카카오 플레이스 사진 API 도 함께 — 가장 이상적으로"): 카카오 플레이스에
 *   **그 매장에 실제로 등록된 사진**을 가져온다. 네이버 이미지검색은 매장명 스코어링을 해도 결국
 *   "그 이름으로 검색된 웹 이미지"라 오매칭 가능성이 남지만, 카카오 플레이스 사진은 **바로 그 place id
 *   의 등록 사진**이라 관련도가 근본적으로 100%.
 *
 * 🚑 2026-07-21 v2 (대표 "가장 메인이 되는 사진을 뽑아오질 않고 있어" — 라이브 실측): 기존 유일 경로였던
 *   비공식 JSON(`place.map.kakao.com/main/v/{id}`)이 **스키마 개편으로 404**(nginx, 실측) → 사진이 항상
 *   0장 → 커버가 네이버 웹검색 결과로 대체되고 있었음. 신 JSON(`place-api.map.kakao.com/places/panel3`)은
 *   전 헤더 조합 406(WAF 게이트, 실측)이라 사용 불가. **새 1순위 = 플레이스 페이지 HTML 의 og:image** —
 *   카카오가 자기 링크 공유용으로 서버렌더하는 값이라 안정적(3.6KB 경량, 실측 200)이고, 그 값이 곧
 *   카카오맵이 정한 **그 매장의 대표(메인) 사진**. cthumb 래퍼면 fname 원본(t1.daumcdn.net)을 풀어서 반환.
 *   구 JSON 은 og 실패 시에만 시도(부활 시 다중 사진 자동 회수 — 서브리퀘스트 예산 순증 0). 전부 fail-soft.
 *
 * 🔁 2026-10-26: og 경로도 Cloudflare 에서 403 이 되어 지웠다 — 아래 업체 사진 탭 JSON 하나만 쓴다.
 */

// place id 만 필요 — placeUrl(`https://place.map.kakao.com/{id}`) 또는 순수 id 둘 다 허용.
export function extractKakaoPlaceId(placeUrlOrId: string | null | undefined): string | null {
  if (!placeUrlOrId) return null
  const s = String(placeUrlOrId).trim()
  const m = s.match(/(\d{6,})/) // place id 는 6자리+ 숫자
  return m ? m[1] : null
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

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
 * 🏪 2026-10-26 (대표 "업체가 올린 사진이 가장 좋잖아" — 라이브 실측): 카카오 플레이스 **업체 사진만**.
 *   og:image 경로는 Cloudflare 에서 **403**(진단 2484)이라 라이브 수집이 0장이었다. 대신 사진 탭 JSON
 *   (`place-api.map.kakao.com/places/tab/photos/{id}?tag=…`)은 200 이고 **분류 태그**로 거를 수 있다.
 *   업체 사진 = `MYSTORE`(매장주 제공) · `VENDOR`(제휴사 제공). 그 밖의 태그(FOOD·MENU 등)는
 *   **손님 리뷰·블로그 사진이 섞인다**(실측: tag=MENU 응답이 전부 `type: BLOG`) ⇒ 쓰지 않는다.
 *   응답의 `type` 이 요청한 태그와 같은 것만 받는다(태그 필터가 풀리는 날에도 손님 사진이 안 섞이게).
 *   ⚠️ 비공식 API — 헤더(pf·Origin·Referer)가 없으면 거절된다. 대문자 태그만 받는다(소문자 400).
 *   서브리퀘스트: MYSTORE 1회 + (VENDOR 가 있다고 응답이 말할 때만) 1회. fail-soft — 실패 시 [].
 */
const KAKAO_PHOTO_HEADERS = {
  pf: 'web',
  Origin: 'https://place.map.kakao.com',
  Referer: 'https://place.map.kakao.com/',
  'User-Agent': BROWSER_UA,
  Accept: 'application/json',
}

interface KakaoTabPhoto { url?: string; type?: string; media_type?: string }
interface KakaoTabPhotos { counts?: { mystore?: number; vendor?: number }; photos?: KakaoTabPhoto[] }

async function fetchKakaoTabPhotos(id: string, tag: 'MYSTORE' | 'VENDOR'): Promise<KakaoTabPhotos | null> {
  try {
    const res = await fetch(`https://place-api.map.kakao.com/places/tab/photos/${id}?tag=${tag}&page=1`, {
      headers: KAKAO_PHOTO_HEADERS,
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    return (await res.json()) as KakaoTabPhotos
  } catch {
    return null
  }
}

/** 업체 사진(매장주·제휴사 제공)만 최대 `count` 장. 손님·블로그 사진은 받지 않는다. */
export async function fetchKakaoPlacePhotos(placeUrlOrId: string | null | undefined, count = 5): Promise<string[]> {
  const id = extractKakaoPlaceId(placeUrlOrId)
  if (!id) return []
  const want = Math.max(1, Math.min(8, count))
  const out: string[] = []
  const seen = new Set<string>()
  const take = (data: KakaoTabPhotos | null, tag: string) => {
    for (const p of data?.photos || []) {
      if (out.length >= want) break
      if (p.type !== tag) continue
      if (p.media_type && p.media_type !== 'PHOTO') continue
      const u = cleanKakaoUrl(p.url)
      if (u && !seen.has(u)) { seen.add(u); out.push(u) }
    }
  }
  const mine = await fetchKakaoTabPhotos(id, 'MYSTORE')
  take(mine, 'MYSTORE')
  if (out.length < want && (mine?.counts?.vendor ?? 0) > 0) take(await fetchKakaoTabPhotos(id, 'VENDOR'), 'VENDOR')
  return out
}
