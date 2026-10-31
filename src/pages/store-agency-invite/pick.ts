/** 🏪 초대 링크로 맡길 매장 고르기 — 순수 함수(시험이 직접 돌린다). */

/** 고른 목록에서 그 매장을 넣거나 뺀다(순서 유지). */
export function togglePick(picked: number[], id: number): number[] {
  return picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]
}

/** 아직 이 에이전시에 안 맡긴 내 매장 — 이미 맡긴 곳은 다시 보낼 수 없다(고를 수 없게 막는다). */
export function entrustableIds(owned: number[], entrusted: number[]): number[] {
  const done = new Set(entrusted)
  return owned.filter((id) => !done.has(id))
}
