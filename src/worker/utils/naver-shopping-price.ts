/**
 * 🛒 2026-06-12 (사용자 요청): 네이버쇼핑 최저가 자동 대조.
 *
 *   목적: 제조사가 도매몰에 상품을 올릴 때 "시중(네이버쇼핑) 최저가" 를 바로 보여줘
 *   공급가/권장가가 시장에서 통하는 수준인지 스스로 확인하게 함 — 공급가 앵커링 견제의
 *   두 번째 축 (채널 안내 = 채널 관점, 최저가 대조 = 시장 가격 관점).
 *
 *   API: 네이버 검색 오픈API '쇼핑' (developers.naver.com — 커머스API와 별개, 일 25,000회 무료)
 *     GET https://openapi.naver.com/v1/search/shop.json?query=&display=&sort=asc
 *     헤더: X-Naver-Client-Id / X-Naver-Client-Secret
 *
 *   fail-soft: 키 미설정 → NOT_CONFIGURED (UI 자동 숨김). 호출 실패 → 에러 메시지만.
 *   캐시: 동일 검색어 10분 모듈 캐시 (할당량 보호 — isolate 수명).
 */

export interface NaverPriceItem {
  title: string
  lprice: number
  mallName: string
  link: string
  brand?: string
}

export interface NaverPriceCheckResult {
  ok: boolean
  configured: boolean
  items?: NaverPriceItem[]
  lowest?: number | null
  error?: string
}

/** 네이버 응답 title 의 <b></b> 강조 태그 + HTML 엔티티 제거 (순수 — 테스트 가능). */
export function stripNaverTitle(title: string): string {
  return title
    .replace(/<\/?b>/gi, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim()
}

/** 검색어 정제 — 괄호/특수문자 제거로 매칭률 ↑ (순수 — 테스트 가능). */
export function normalizePriceQuery(name: string): string {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // [브랜드] (옵션) 제거
    .replace(/[^\w가-힣a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

// 동일 검색어 10분 캐시 — 일 25,000회 할당량 보호.
const _cache = new Map<string, { at: number; result: NaverPriceCheckResult }>()
const CACHE_TTL = 10 * 60_000
const CACHE_MAX = 500

export async function checkNaverLowestPrice(
  clientId: string | undefined,
  clientSecret: string | undefined,
  rawQuery: string,
): Promise<NaverPriceCheckResult> {
  if (!clientId || !clientSecret) return { ok: false, configured: false, error: 'NOT_CONFIGURED' }
  const query = normalizePriceQuery(rawQuery)
  if (query.length < 2) return { ok: false, configured: true, error: '검색어가 너무 짧습니다' }

  const hit = _cache.get(query)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result

  // 가격 오름차순 5건 — 최저가 + 비교 표본.
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=5&sort=asc`
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
  }).catch(() => null)
  if (!res) return { ok: false, configured: true, error: '네이버 API 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as {
    items?: Array<{ title?: string; lprice?: string; mallName?: string; link?: string; brand?: string }>
    errorMessage?: string
  } | null
  if (!res.ok) {
    return { ok: false, configured: true, error: data?.errorMessage || `네이버 API 오류 (HTTP ${res.status})` }
  }

  const items: NaverPriceItem[] = (data?.items || [])
    .map(item => ({
      title: stripNaverTitle(String(item.title || '')),
      lprice: Math.floor(Number(item.lprice)) || 0,
      mallName: String(item.mallName || ''),
      link: String(item.link || ''),
      brand: item.brand ? String(item.brand) : undefined,
    }))
    .filter(item => item.lprice > 0)

  const result: NaverPriceCheckResult = {
    ok: true,
    configured: true,
    items,
    lowest: items.length > 0 ? Math.min(...items.map(i => i.lprice)) : null,
  }
  if (_cache.size >= CACHE_MAX) _cache.clear() // 단순 cap — isolate 수명이라 충분
  _cache.set(query, { at: Date.now(), result })
  return result
}
