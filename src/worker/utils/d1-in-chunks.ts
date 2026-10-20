/**
 * 🧩 `WHERE x IN (?, ?, …)` 를 **바인딩 한도 안으로** 나눠 돌린다 (2026-10-17 — 프랜차이즈 지점 다수).
 *
 * D1 은 한 문장에 바인딩 100개까지다. 매장 id 목록을 그대로 `IN (…)` 에 넣던 집계가
 * 매장 20곳에서 잘라 두고 있었는데(`slice(0, 20)`), 지점이 수십~수백 곳인 브랜드는
 * 그 밖의 지점이 **화면에서 그냥 빠졌다**(에러 0). 잘라 두는 대신 나눠서 돌리고 합친다.
 *
 * - `size` 는 **다른 바인딩 자리까지 뺀 값**으로 고른다 — 기본 90 은 날짜 등 몇 개를 덧붙여도 안전하다.
 * - 한 조각이 실패해도 나머지는 살린다(호출부의 `.catch` 와 같은 fail-soft — 한 조각 때문에 전체가 0 이 되지 않게).
 * - 조각은 **병렬**로 돈다 — 왕복이 조각 수만큼 직렬로 늘지 않는다.
 */
export const D1_IN_CHUNK = 90

export function chunkIds<T>(ids: readonly T[], size = D1_IN_CHUNK): T[][] {
  if (!Number.isFinite(size) || size < 1) throw new Error('chunk size must be >= 1')
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

/** 각 조각에 `run(조각, '?,?,…')` 을 돌려 행을 이어 붙인다. 빈 목록이면 호출 0. */
export async function allInChunks<T, R>(
  ids: readonly T[],
  run: (chunk: T[], marks: string) => Promise<R[]>,
  size = D1_IN_CHUNK,
): Promise<R[]> {
  if (ids.length === 0) return []
  const parts = await Promise.all(
    chunkIds(ids, size).map((chunk) => run(chunk, chunk.map(() => '?').join(',')).catch(() => [] as R[])),
  )
  return parts.flat()
}
