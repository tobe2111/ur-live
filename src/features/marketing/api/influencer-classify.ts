/**
 * 🏷️ 2026-07-21 인플루언서 카테고리 콘텐츠 기반 자동 분류 (순수 — 테스트 가능).
 *   기존: 발굴 키워드의 카테고리를 물려받기만 → 자동확장 키워드('자동')·오분류(뷰티 채널이 "서울 맛집"
 *   검색에 걸리면 평생 맛집) 발생. 채널 **이름+소개글 텍스트 신호**로 분류하고, 신호 없을 때만 키워드
 *   카테고리 폴백. 신규 저장 + 기존 풀 재분류(백필) 양쪽에서 사용.
 */

/** 분류 카테고리(우선순위 순 — 구체적인 것 먼저: 네일 < 뷰티 포함 방지). 인바운드 신청 폼과 정합. */
const RULES: { cat: string; re: RegExp }[] = [
  { cat: '네일', re: /네일|nail\s*art|젤네일|손톱/i },
  { cat: '뷰티', re: /뷰티|메이크업|화장품|코스메틱|스킨케어|헤어|미용|beauty|makeup|cosmetic/i },
  { cat: '카페', re: /카페|디저트|베이커리|빵집|브런치|커피|cafe|dessert|bakery/i },
  { cat: '맛집', re: /맛집|먹방|푸드|음식|식당|맛스타|먹스타|요리|레시피|food|mukbang|맛있|외식/i },
  { cat: '숙소', re: /숙소|호텔|펜션|리조트|글램핑|캠핑|스테이|hotel|pension|airbnb/i },
  { cat: '여행', re: /여행|트래블|travel|배낭|투어|나들이/i },
  { cat: '육아', re: /육아|맘스타|아기|키즈|워킹맘|엄마표|junior|kids/i },
  { cat: '패션', re: /패션|스타일링|코디|옷장|fashion|ootd|스트릿/i },
]

/** 실제 카테고리로 인정 안 하는 값(키워드 상속의 부산물) — 재분류 대상 판정에 사용. */
export const NON_CATEGORIES = new Set(['자동', '일반', '', null as unknown as string])

/**
 * 이름+소개글로 카테고리 판정. 신호 없으면 null(호출부가 키워드 카테고리 폴백).
 *   첫 매치 승 — RULES 순서가 우선순위(구체적 신호 먼저).
 */
export function classifyCategory(name: string, description?: string | null): string | null {
  const text = `${name} ${description || ''}`
  for (const r of RULES) if (r.re.test(text)) return r.cat
  return null
}

/** 저장 시점 최종 카테고리 — 콘텐츠 신호 우선, 없으면 키워드 카테고리(단 '자동'/'일반'은 null 로). */
export function resolveCategory(name: string, description: string | null | undefined, keywordCat: string | null | undefined): string | null {
  const byContent = classifyCategory(name, description)
  if (byContent) return byContent
  const kc = (keywordCat || '').trim()
  return kc && !NON_CATEGORIES.has(kc) ? kc : null
}
