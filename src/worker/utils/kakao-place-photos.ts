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
 * 🥇 대표(메인) 사진 1장 — 플레이스 페이지 og:image (서버렌더, 실측 검증 경로).
 *   사진 미등록 매장은 og:image 가 staticmap(지도 썸네일) 폴백이라 제외. fail-soft — 실패 시 null.
 */
export async function fetchKakaoPlaceMainPhoto(placeUrlOrId: string | null | undefined): Promise<string | null> {
  const id = extractKakaoPlaceId(placeUrlOrId)
  if (!id) return null
  try {
    const res = await fetch(`https://place.map.kakao.com/${id}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // 속성 순서 양방향 허용: property 먼저 / content 먼저.
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    let u = m?.[1]
    if (!u) return null
    if (u.startsWith('//')) u = 'https:' + u
    if (/staticmap\.kakao\.com/i.test(u)) return null // 사진 없음 — 지도 썸네일 폴백은 사진이 아님
    // cthumb 리사이즈 래퍼(img1.kakaocdn.net/cthumb/local/…?fname=<원본>)면 원본 URL 추출(고화질).
    const fm = u.match(/[?&]fname=([^&"']+)/)
    if (fm) {
      try {
        const orig = decodeURIComponent(fm[1])
        if (/^https?:\/\//i.test(orig)) u = orig
      } catch { /* decode 실패 — 래퍼 URL 그대로 사용 */ }
    }
    return cleanKakaoUrl(u)
  } catch {
    return null
  }
}

/**
 * placeId 의 등록 사진 URL 최대 `count` 장 — **1번째 = 카카오맵 대표(메인) 사진**(og:image).
 *   구 JSON 엔드포인트는 og 실패 시에만 보조 시도(현재 404 — 부활 시 다중 사진 자동 회수).
 *   fail-soft — 실패 시 [].
 */
export async function fetchKakaoPlacePhotos(placeUrlOrId: string | null | undefined, count = 5): Promise<string[]> {
  const id = extractKakaoPlaceId(placeUrlOrId)
  if (!id) return []
  const want = Math.max(1, Math.min(8, count))
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | undefined | null) => {
    const u = cleanKakaoUrl(raw || undefined)
    if (u && !seen.has(u)) { seen.add(u); out.push(u) }
  }
  // ① 대표(메인) 사진 — og:image (실측 검증된 현행 경로).
  const main = await fetchKakaoPlaceMainPhoto(id)
  push(main)
  // ② og 실패 시에만 구 JSON 시도 — 예산 순증 0(기존에도 이 fetch 1회는 쓰고 있었음).
  //    스키마 부활 시 대표+등록 사진 리스트를 자동 회수.
  if (out.length === 0) {
    try {
      const res = await fetch(`https://place.map.kakao.com/main/v/${id}`, {
        headers: {
          // 카카오맵 웹과 동일 컨텍스트 — Referer 없으면 빈 응답을 줄 수 있음.
          Referer: `https://place.map.kakao.com/${id}`,
          'User-Agent': BROWSER_UA,
          Accept: 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) {
        const data = (await res.json()) as KakaoPlaceDetail
        if (data && data.isExist !== false) {
          push(data.basicInfo?.mainphotourl)
          for (const grp of data.photo?.photoList || []) {
            for (const p of grp.list || []) {
              push(p.orgurl || p.url || p.photoUrl)
              if (out.length >= want) break
            }
            if (out.length >= want) break
          }
        }
      }
    } catch { /* fail-soft — 호출측이 네이버 스코어링으로 폴백 */ }
  }
  return out.slice(0, want)
}
