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

/** 네이버 플레이스 대표사진 1장. 매장명(+주소)로 검색해 첫 매칭의 대표사진. fail-soft → null. */
export async function fetchNaverPlaceMainPhoto(
  name: string,
  address?: string | null,
): Promise<string | null> {
  const q = (name + (address ? ' ' + String(address).split(/\s+/).slice(0, 2).join(' ') : '')).trim()
  if (!q || q.length < 2) return null
  const nameKey = stripTags(name).replace(/\s+/g, '').toLowerCase()

  // ① allSearch(JSON) — place list + 대표 썸네일.
  try {
    const url = `https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(q)}&type=all&searchCoord=&boundary=`
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', Referer: 'https://map.naver.com/' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const data = (await res.json()) as { result?: { place?: { list?: Array<Record<string, unknown>> } } }
      const list = data?.result?.place?.list || []
      // 매장명 일치 우선(정규화 포함), 없으면 첫 결과.
      const match = list.find((it) => stripTags(String(it.name || '')).replace(/\s+/g, '').toLowerCase().includes(nameKey) || nameKey.includes(stripTags(String(it.name || '')).replace(/\s+/g, '').toLowerCase())) || list[0]
      if (match) {
        const direct = pickItemImage(match)
        if (direct) return direct
        // ② 대표 썸네일이 없으면 플레이스 페이지 og:image.
        const id = String(match.id || '')
        if (/^\d+$/.test(id)) {
          const og = await fetchNaverPlacePageOg(id)
          if (og) return og
        }
      }
    }
  } catch { /* fail-soft → null */ }
  return null
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
