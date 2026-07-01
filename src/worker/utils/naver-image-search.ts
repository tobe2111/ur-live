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
  const link = it.link || ''
  if (!link.startsWith('https://')) return false
  const w = parseInt(String(it.sizewidth || '0'), 10) || 0
  const h = parseInt(String(it.sizeheight || '0'), 10) || 0
  if (w < 500 || h < 400) return false // 너무 작음 = 아이콘/썸네일/로고
  const ratio = w / h
  if (ratio < 0.6 || ratio > 2.2) return false // 세로 롱스크린샷/가로 배너 회피 → 카드용 정상 비율만
  return true
}

export async function fetchNaverImageUrl(env: Env, query: string): Promise<string | null> {
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
    // 1) 충분한 크기 + 정상 비율 실사진(https 원본) 우선.
    const proper = items.find(isProperPhoto)
    if (proper?.link) return proper.link
    // 2) 신뢰 폴백: 네이버 CDN 썸네일(항상 로드 — 깨진 이미지 0). 관련도 순 첫 결과.
    const thumb = items.find((i) => i.thumbnail && i.thumbnail.startsWith('https://'))?.thumbnail
    if (thumb) return thumb
    // 3) 최후: https 원본 아무거나.
    return items.find((i) => i.link && i.link.startsWith('https://'))?.link || null
  } catch {
    return null
  }
}
