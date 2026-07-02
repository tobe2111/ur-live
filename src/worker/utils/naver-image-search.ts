/**
 * 🖼️ 네이버 이미지검색 API — 쿼리에 맞는 실사진 URL 1개 반환. graceful(키 없으면 null).
 *
 * 배경(2026-07-01 대표): 동네딜 "데모 채우기"가 picsum(추상 랜덤) 이미지를 써서 실제 매장/음식처럼
 * 안 보였음. 네이버 *장소검색*(search/local)은 사진을 반환하지 않으므로, 실사진은 *이미지검색*
 * (search/image)으로 확보한다. 키는 openapi.naver.com 공용(NAVER_SEARCH_* 우선, 없으면 NAVER_*).
 *
 * 반환 우선순위: https 원본 링크 > 원본 링크 > 네이버 pstatic 썸네일(항상 로드됨) > null.
 * 데모/시드 전용 best-effort — 실패해도 호출측이 기존 이미지로 폴백한다.
 */
import type { Env } from '../types/env'

export async function fetchNaverImageUrl(env: Env, query: string): Promise<string | null> {
  const clientId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret || !query) return null
  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=10&sort=sim&filter=large`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { items?: Array<{ link?: string; thumbnail?: string }> }
    const items = data.items || []
    if (!items.length) return null
    // 🛡️ 2026-07-01 (대표 신고 — mixed content): http:// 원본 채택 금지.
    //   HTTPS 페이지의 http 이미지는 브라우저가 https 로 강제 승격하는데, 네이버 원본 호스트
    //   (imgnews/shop1.phinf 등)는 https 인증서가 안 맞아 ERR_CERT_COMMON_NAME_INVALID 로 깨짐.
    //   → https 원본만 채택, 없으면 네이버 CDN 썸네일(search.pstatic.net, https 안정)로 폴백.
    const httpsLink = items.find((i) => i.link && i.link.startsWith('https://'))?.link
    if (httpsLink) return httpsLink
    const thumb = items.find((i) => i.thumbnail)?.thumbnail || null
    return thumb ? thumb.replace(/^http:/, 'https:') : null
  } catch {
    return null
  }
}
