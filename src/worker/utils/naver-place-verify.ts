/**
 * 🛡️ 2026-05-27 (사용자 결정): Naver Local API 로 매장 진위 추가 검증.
 *
 * 사업자번호 (NTS) 외 — 실제 영업 중인 매장인지 검증.
 * - 무료 (네이버 개발자센터 가입 + Client ID/Secret)
 * - 일 25,000 호출 무료
 *
 * 사용:
 *   - 가입 시 또는 admin recheck 시 매장명 + 주소로 search
 *   - 결과: 일치 / 유사 / 미발견
 *
 * graceful: NAVER_CLIENT_ID/SECRET 없으면 skip (기존 동작).
 */

export interface NaverPlaceVerifyResult {
  ok: boolean
  /** 일치 / 유사 / 미발견 */
  match: 'exact' | 'fuzzy' | 'none' | null
  /** 발견된 매장 (best match) */
  found?: {
    title: string
    address: string
    roadAddress: string
    category: string
    telephone: string
    link: string
  }
  message: string
}

export async function naverPlaceVerify(
  clientId: string | undefined,
  clientSecret: string | undefined,
  input: { name: string; address?: string },
): Promise<NaverPlaceVerifyResult> {
  if (!clientId || !clientSecret) {
    return { ok: false, match: null, message: 'NAVER_CLIENT_ID/SECRET 미설정 — skip' }
  }
  const q = (input.name + (input.address ? ' ' + input.address.slice(0, 50) : '')).trim()
  if (!q || q.length < 2) {
    return { ok: false, match: null, message: '매장명 너무 짧음' }
  }

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5&sort=random`
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, match: null, message: `Naver API HTTP ${res.status}` }
    }
    const data = await res.json() as {
      items?: Array<{
        title: string
        address: string
        roadAddress: string
        category: string
        telephone: string
        link: string
      }>
    }
    const items = data.items || []
    if (items.length === 0) {
      return { ok: true, match: 'none', message: '검색 결과 없음' }
    }

    // 매장명 정확 일치 (HTML tag 제거) 검사
    const cleanName = input.name.trim().toLowerCase()
    const exactMatch = items.find(it =>
      it.title.replace(/<[^>]*>/g, '').trim().toLowerCase() === cleanName,
    )
    if (exactMatch) {
      return {
        ok: true,
        match: 'exact',
        found: {
          title: exactMatch.title.replace(/<[^>]*>/g, ''),
          address: exactMatch.address,
          roadAddress: exactMatch.roadAddress,
          category: exactMatch.category,
          telephone: exactMatch.telephone,
          link: exactMatch.link,
        },
        message: '정확 일치 — 실제 영업 매장 확인',
      }
    }

    // 부분 일치 (매장명 포함)
    const fuzzyMatch = items.find(it =>
      it.title.replace(/<[^>]*>/g, '').toLowerCase().includes(cleanName) ||
      cleanName.includes(it.title.replace(/<[^>]*>/g, '').toLowerCase()),
    )
    if (fuzzyMatch) {
      return {
        ok: true,
        match: 'fuzzy',
        found: {
          title: fuzzyMatch.title.replace(/<[^>]*>/g, ''),
          address: fuzzyMatch.address,
          roadAddress: fuzzyMatch.roadAddress,
          category: fuzzyMatch.category,
          telephone: fuzzyMatch.telephone,
          link: fuzzyMatch.link,
        },
        message: '유사 일치 — 수동 확인 권장',
      }
    }

    return { ok: true, match: 'none', message: `유사 매장 없음 (${items.length}개 결과)` }
  } catch (err) {
    return {
      ok: false,
      match: null,
      message: (err as Error).name === 'TimeoutError' ? 'Naver API 시간 초과' : `Naver API 호출 실패`,
    }
  }
}
