/**
 * 🖼️ 네이버 이미지검색 API — 쿼리에 맞는 "제대로 된" 실사진 URL 1개 반환. graceful(키 없으면 null).
 *
 * 배경(2026-07-01 대표): 동네딜 "데모 채우기" 실사진. 네이버 *장소검색*(search/local)은 사진을
 * 반환하지 않으므로 *이미지검색*(search/image) 사용. 키는 openapi.naver.com 공용(NAVER_SEARCH_* 우선).
 *
 * ⚠️ "이상한 이미지" 방지(대표 지시): 첫 링크를 무조건 쓰지 않고 —
 *   1) 충분히 큰 실사진(가로/세로 ≥ 임계) + 정상 비율(아이콘/배너/롱스크린샷 제외)만 채택,
 *   2) https 원본 링크 우선(품질), 없으면
 *   3) 네이버 자체 CDN 썸네일(search.pstatic.net — 핫링크 차단 없어 항상 로드)로 폴백.
 * 데모/시드 전용 best-effort — 실패하면 호출측이 기존 이미지로 폴백.
 */
import type { Env } from '../types/env'

interface NaverImageItem { link?: string; thumbnail?: string; sizewidth?: string; sizeheight?: string }

function isProperPhoto(it: NaverImageItem): boolean {
  // 원본 스킴 무관 — 반환 전 search.pstatic 프록시로 감싸므로(서버측 fetch) http 도 안전.
  const link = it.link || ''
  if (!/^https?:\/\//.test(link)) return false
  const w = parseInt(String(it.sizewidth || '0'), 10) || 0
  const h = parseInt(String(it.sizeheight || '0'), 10) || 0
  if (w < 500 || h < 400) return false // 너무 작음 = 아이콘/썸네일/로고
  const ratio = w / h
  if (ratio < 0.6 || ratio > 2.2) return false // 세로 롱스크린샷/가로 배너 회피 → 카드용 정상 비율만
  return true
}

/**
 * @param pickIndex 후보 로테이션 인덱스(기본 0 = 기존과 동일). 데모 누적 시드처럼 같은 쿼리를
 *   반복 호출할 때 배치마다 다른 사진을 고르게 → 동일 카드 중복 노출 완화. 후보 수로 mod.
 */
export async function fetchNaverImageUrl(env: Env, query: string, pickIndex = 0): Promise<string | null> {
  const clientId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret || !query) return null
  try {
    // display 넉넉히(30) 받아 필터 통과분 확보. filter=large 로 저해상도 원천 배제 + sort=sim(관련도).
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=30&sort=sim&filter=large`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { items?: NaverImageItem[] }
    const items = data.items || []
    if (!items.length) return null
    // 🛡️ 2026-07-02 (대표 "영구적으로 해결"): 네이버 원본 호스트는 https 여도 인증서 불일치
    //    (shop1.phinf.naver.net ERR_CERT_COMMON_NAME_INVALID)로 깨짐 → **원본 직접 채택 전면 금지**.
    //    모든 단계를 search.pstatic.net 프록시(toNaverSafeImageUrl, 네이버 검색 자체가 쓰는 CDN —
    //    인증서 정상·서버측 fetch 라 항상 로드)로 변환해 반환. pickIndex = 후보 로테이션.
    const { toNaverSafeImageUrl } = await import('../../shared/naver-safe-image')
    // 1) 충분한 크기 + 정상 비율 실사진 우선 → 프록시 랩.
    const propers = items.filter(isProperPhoto)
    if (propers.length) {
      const it = propers[pickIndex % propers.length]
      const safe = toNaverSafeImageUrl(it.link, it.thumbnail)
      if (safe) return safe
    }
    // 2) 썸네일 보유 항목 → 프록시 type 상향.
    const thumbs = items.filter((i) => i.thumbnail)
    if (thumbs.length) {
      const it = thumbs[pickIndex % thumbs.length]
      const safe = toNaverSafeImageUrl(it.link, it.thumbnail)
      if (safe) return safe
    }
    // 3) 최후: 링크만 있는 항목 → 프록시 랩.
    const links = items.filter((i) => i.link)
    if (links.length) {
      const it = links[pickIndex % links.length]
      return toNaverSafeImageUrl(it.link, it.thumbnail)
    }
    return null
  } catch {
    return null
  }
}
