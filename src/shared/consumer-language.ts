/**
 * 🌏 소비자 화면 언어 — 폰(브라우저) 언어로만 고른다 (2026-11-18 대표 *"외국인한테만"*).
 *
 * - 폰의 첫 선호 언어가 한국어(`ko`, `ko-KR`)면 한국어, 그 밖이면 영어.
 * - 영어만 여는 이유: 일본어·중국어 등은 아직 번역이 비어 있는 곳이 많다(`[TODO:xx]`). 이용권 상세·구매·내 이용권은
 *   2026-11-02 에 영어 번역을 채웠다(`tourist-english-pass-flow` 시험).
 * - IP 국가로 고르지 않는다 — 한국에 온 관광객은 한국 와이파이·유심이라 IP 가 한국이다.
 * - 언어 정보를 못 얻으면(서버 렌더·크롤러·빈 값) 한국어 — 이 서비스의 기본 손님이다.
 */
export type ConsumerLang = 'ko' | 'en'

export function consumerLanguageFor(languages: ReadonlyArray<string | null | undefined> | null | undefined): ConsumerLang {
  const first = (languages || []).map((l) => String(l || '').trim().toLowerCase()).find(Boolean)
  if (!first) return 'ko'
  return first === 'ko' || first.startsWith('ko-') ? 'ko' : 'en'
}
