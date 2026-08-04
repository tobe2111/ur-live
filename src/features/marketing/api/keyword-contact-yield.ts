/**
 * 🎯 **3분할 순환 풀 구성** — `influencer-auto-collect.ts` 에서 추출(2026-08-04, 600줄 래칫).
 *
 * ⚠️ **이 파일은 원래 "연락처 수율 자동 조율"이었다 — 그 부분은 철회했다.**
 *   같은 날 다른 세션이 같은 아이디어를 먼저 머지했다(#1055 `influencer-keyword-yield.ts`).
 *   두 벌을 두면 **조용히 갈라진다**(이 레포가 반복해 경고하는 클래스) → SSOT 를 그쪽에 넘기고
 *   여기엔 겹치지 않는 것만 남겼다. 그쪽이 한 가지 점에서 확실히 낫다: `source_keyword` 에 인덱스가
 *   없으므로 **전체 1회 스캔 + JS 매칭**이 맞고, 내 슬라이스(`IN (…60개)`)는 같은 풀스캔 비용으로
 *   60개만 갱신하는 형태였다.
 *
 * 🕳️ **아직 안 고쳐진 것**: 그쪽은 **유튜브 점수에만** 적용된다. 네이버/일반은 점수가 아니라
 *   **커서 순환**(아래 함수)으로 뽑히므로, 실측에서 나온 `방배동 맛집 0%(표본 46)` ·
 *   `금천 맛집 5.9%` 같은 키워드는 **여전히 같은 몫으로 돌고 있다.**
 *   후속은 `influencer-keyword-yield` 위에 순환 솎아내기를 얹는 것 — **여기 다시 만들지 말 것.**
 *
 * 규칙(이동 전과 동일): 집중 축을 **가장 먼저** 뗀다 · 남은 것 중 우선 카테고리 · 나머지가 일반.
 * **세 풀은 서로 배타여야 한다** — 겹치면 같은 키워드가 한 배치에 두 번 들어간다.
 */
export function buildRotationPools<T extends { category: string | null }>(
  kws: T[],
  cats: { focus: readonly string[]; priority: readonly string[] },
): { focusPool: T[]; priPool: T[]; genPool: T[] } {
  const inFocus = (k: { category: string | null }) => !!k.category && cats.focus.includes(k.category)
  const inPri = (k: { category: string | null }) => !!k.category && cats.priority.includes(k.category)
  return {
    focusPool: kws.filter(inFocus),
    priPool: kws.filter(k => !inFocus(k) && inPri(k)),
    genPool: kws.filter(k => !inFocus(k) && !inPri(k)),
  }
}
