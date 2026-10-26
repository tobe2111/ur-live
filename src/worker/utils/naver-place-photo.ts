/**
 * 🖼️ 2026-07-21 (대표 "매장들이 메인으로 쓰는 사진이 나와야 해 — 네이버 지도/카카오맵"):
 *   네이버 **지도(플레이스)에 그 매장이 대표로 걸어둔 사진**을 가져온다. 카카오는 og:image 로 대표사진을
 *   얻지만(kakao-place-photos.ts), 카카오에 사진이 없는 매장은 네이버 플레이스 대표사진이 다음 후보.
 *
 * 기법(카카오 og 미러): ① 네이버 플레이스 검색으로 매장 id 확보 → ② 플레이스에 등록된 대표(첫) 사진.
 *   - 1순위: allSearch JSON 의 place list 항목이 대표 썸네일(thumUrl/imageUrl 등)을 직접 주면 1-hop 완료.
 *   - 2순위: 없으면 플레이스 페이지(og:image) 파싱(카카오와 동일).
 *   ⚠️ 네이버 플레이스는 **비공식 경로**라 언젠가 스키마/차단 가능 → **완전 fail-soft**(어떤 에러든 null)
 *      → 호출측(fetchDemoPhotos)이 네이버 이미지검색으로 자동 폴백(무회귀). 이 개발환경에선 네이버 지도
 *      호스트가 egress 차단이라 실측 불가 — 프로덕션(워커)에서 검증. 되면 대표사진 커버, 안 되면 현행 유지.
 */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function cleanNaverImg(u: string | undefined | null): string | null {
  if (!u || typeof u !== 'string') return null
  let url = u.trim()
  if (!url) return null
  if (url.startsWith('//')) url = 'https:' + url
  url = url.replace(/^http:\/\//, 'https://')
  if (!/^https:\/\//.test(url)) return null
  // 스톡/기본아이콘 제외(대표사진 아님).
  if (/(?:static\.map|blank|noimage|no_image|default)/i.test(url)) return null
  return url
}

function stripTags(s: string): string {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}

// allSearch place item 은 필드명이 유동적 → 알려진 이미지 필드 후보를 순서대로 탐색.
function pickItemImage(it: Record<string, unknown>): string | null {
  for (const k of ['thumUrl', 'imageUrl', 'thumbUrl', 'thumbnail', 'imgUrl', 'image']) {
    const v = it[k]
    if (typeof v === 'string') { const c = cleanNaverImg(v); if (c) return c }
    if (Array.isArray(v) && typeof v[0] === 'string') { const c = cleanNaverImg(v[0] as string); if (c) return c }
  }
  return null
}

function nameKeyOf(s: string): string {
  return stripTags(s).replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase()
}

/**
 * 🎯 2026-10-25 (대표 "업체가 직접 올린 사진만"): **이름이 맞는 가게만** 그 가게로 인정한다.
 *   종전엔 이름이 안 맞으면 `list[0]`(검색 첫 결과 = 다른 가게일 수 있다)을 그대로 썼고, 빈 이름의
 *   항목은 `nameKey.includes('')` 가 늘 참이라 아무 가게나 통과했다. 틀린 가게의 사진은 사진이 없는
 *   것보다 나쁘므로, 맞는 가게가 없으면 `null`.
 */
export function pickMatchingPlace(
  list: Array<Record<string, unknown>>,
  name: string,
): Record<string, unknown> | null {
  const want = nameKeyOf(name)
  if (want.length < 2) return null
  return list.find((it) => {
    const got = nameKeyOf(String(it.name || ''))
    return got.length >= 2 && (got.includes(want) || want.includes(got))
  }) || null
}

/** 매장명(+주소 앞 두 마디)으로 네이버 플레이스를 찾는다. 이름이 맞는 항목만. fail-soft → null. */
export async function findNaverPlace(name: string, address?: string | null): Promise<Record<string, unknown> | null> {
  const q = (name + (address ? ' ' + String(address).split(/\s+/).slice(0, 2).join(' ') : '')).trim()
  if (!q || q.length < 2) return null
  try {
    const url = `https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(q)}&type=all&searchCoord=&boundary=`
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', Referer: 'https://map.naver.com/' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: { place?: { list?: Array<Record<string, unknown>> } } }
    return pickMatchingPlace(data?.result?.place?.list || [], name)
  } catch { return null }
}

/** 네이버 플레이스 대표사진 1장. 매장명(+주소)로 검색해 **이름이 맞는** 가게의 대표사진. fail-soft → null. */
export async function fetchNaverPlaceMainPhoto(
  name: string,
  address?: string | null,
): Promise<string | null> {
  const match = await findNaverPlace(name, address)
  if (!match) return null
  const direct = pickItemImage(match)
  if (direct) return direct
  const id = String(match.id || '')
  return /^\d+$/.test(id) ? fetchNaverPlacePageOg(id) : null
}

/**
 * 🏪 업체가 등록한 사진의 CDN — 네이버 플레이스는 업체 등록 사진을 `ldb-phinf` 에 둔다.
 *   방문자 리뷰 사진(`pup-review-phinf`·`myplace-phinf`)·블로그(`blogfiles`·`postfiles`)는 다른 호스트라
 *   이 한 줄이 "업체 사진만" 의 판정이다. ⚠️ 이 가정은 라이브에서 확인해야 한다(이 환경은 네이버 지도 차단).
 */
const BUSINESS_PHOTO_HOST = /^https:\/\/ldb-phinf\.pstatic\.net\//i

/** 업체가 등록한 사진인가 — 대표 썸네일·페이지 추출 양쪽이 이 한 판정을 지난다. */
export function isBusinessPhotoUrl(u: string | null | undefined): boolean {
  return !!u && BUSINESS_PHOTO_HOST.test(u)
}

/** 플레이스 HTML(JSON 상태 포함)에서 업체 사진 주소만 뽑는다. 순수 — 시험 대상. */
export function extractBusinessPhotoUrls(html: string, limit = 8): string[] {
  const text = String(html || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(/https?:\/\/ldb-phinf\.pstatic\.net\/[^"'\s\\<>)]+/gi)) {
    const u = cleanNaverImg(m[0].replace(/[?&]type=[^&]*$/, ''))
    if (!u || !isBusinessPhotoUrl(u)) continue
    // 같은 사진의 크기 변형(쿼리만 다름)은 한 장으로 센다.
    const key = u.split('?')[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 🏪 업체가 직접 올린 사진 여러 장(2026-10-25 대표 승인 "업체 사진을 데모에 쓰는 것 승인").
 *   이름이 맞는 플레이스만, 업체 사진 탭만 읽는다(2026-10-26 홈 긁기 제거). 대표사진(썸네일)이 업체 사진이면 첫 장.
 *   fail-soft — 막히거나 구조가 바뀌면 [] (호출부는 사진을 지어내지 않는다).
 */
export async function fetchNaverPlaceBusinessPhotos(
  name: string,
  address?: string | null,
  count = 5,
): Promise<string[]> {
  const want = Math.max(1, Math.min(8, count))
  const match = await findNaverPlace(name, address)
  if (!match) return []
  const out: string[] = []
  const seen = new Set<string>()
  const push = (u: string | null) => {
    if (!u || !isBusinessPhotoUrl(u)) return
    const key = u.split('?')[0]
    if (seen.has(key)) return
    seen.add(key); out.push(u)
  }
  push(pickItemImage(match))
  const id = String(match.id || '')
  if (!/^\d+$/.test(id)) return out.slice(0, want)
  const filter = encodeURIComponent('업체사진')
  for (const path of [
    `https://m.place.naver.com/place/${id}/photo?filterType=${filter}`,
    `https://m.place.naver.com/restaurant/${id}/photo?filterType=${filter}`,
    // ③ 2026-10-26 (대표 확정): 홈 화면 통째 긁기 제거 — 홈엔 방문자 리뷰·주변 가게 사진이 같은 CDN 으로 섞인다.
  ]) {
    if (out.length >= want) break
    try {
      const res = await fetch(path, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html', Referer: 'https://m.place.naver.com/' },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      for (const u of extractBusinessPhotoUrls(await res.text(), want)) push(u)
    } catch { /* 다음 경로 */ }
  }
  return out.slice(0, want)
}

/** 네이버 플레이스 페이지 og:image(대표사진). fail-soft. */
async function fetchNaverPlacePageOg(placeId: string): Promise<string | null> {
  // type-agnostic 경로 우선, 실패 시 restaurant 폴백.
  for (const path of [`https://m.place.naver.com/place/${placeId}/home`, `https://m.place.naver.com/restaurant/${placeId}/home`]) {
    try {
      const res = await fetch(path, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      const c = cleanNaverImg(m?.[1])
      if (c) return c
    } catch { /* try next */ }
  }
  return null
}
