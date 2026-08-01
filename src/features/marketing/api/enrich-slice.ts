/**
 * 🍰 **작업 조각 나누기** — `influencer-performance.ts` 에서 분리(2026-08-01, 600줄 래칫).
 *
 *   여러 자식 인보케이션이 **동시에** 같은 큐를 돌 때, 서로 다른 행을 집게 하는 유일한 장치다.
 *   로직은 옮기지 않았다(순수 이동). 근거·주의는 아래 함수 주석.
 */
/**
 * 🍰 **조각(slice)** — 여러 자식이 동시에 돌 때 서로 다른 행을 집게 하는 유일한 장치.
 *
 *   이 SELECT 는 **선점(claim)이 아니라 정렬+LIMIT** 이다. 그래서 같은 큐를 동시에 읽으면 전부 같은
 *   앞머리를 집어 중복 측정하고 예산만 태운다 — 그게 라운드를 지금까지 **순차**로 묶어 둔 이유다
 *   (그 직렬화가 곧 처리량 천장이었다: 정각 체인이 3라운드에서 끝난다).
 *
 *   ⇒ `id % k = i` 로 갈라 준다. 선점 방식과 달리 **행을 잃지 않는다** — 미리 도장을 찍었다가 자식이
 *   죽으면 그 행들은 한 바퀴(수 주) 뒤에야 다시 잡힌다. 조각은 그런 손실이 없고 결정적이다.
 *   ⚠️ `k=1` 이면 조건이 항상 참이라 **오늘과 완전히 같은 동작**이다(롤백 경로 = 값 하나).
 */
export type EnrichSlice = { i: number; k: number }

/** 조각 조건 — SQL 과 바인딩을 함께 만든다(두 벌로 두면 어긋난다). 순수라 유닛으로 고정 가능. */
export function sliceClause(slice?: EnrichSlice | null): { sql: string; binds: number[] } {
  const k = Math.floor(slice?.k ?? 1)
  const i = Math.floor(slice?.i ?? 0)
  if (!Number.isFinite(k) || k <= 1) return { sql: '', binds: [] }   // 분할 안 함 = 기존 동작
  const idx = ((i % k) + k) % k                                       // 음수·초과 인덱스도 유효 범위로
  return { sql: ' AND id % ? = ?', binds: [k, idx] }
}
