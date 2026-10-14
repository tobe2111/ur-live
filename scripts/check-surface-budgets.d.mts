/** 타입 선언 — 구현·근거는 check-surface-budgets.mjs. */
export const TOLERANCE_KB: number
export const LOCK_SLACK_KB: number
export function brKB(buf: Buffer): number
export function surfacesFrom(html: string, mapSrc: string): {
  surfaces: Record<string, string[]>; bootCount: number; cssCount: number; mapCount: number
}
type M = Record<string, { totalKB: number; chunks: Record<string, number> }>
export function judge(measured: M, baseline: { surfaces?: M }, opts?: { tolerance?: number; slack?: number }):
  Array<{ s: string; kind: 'new' | 'grew' | 'slack' | 'gone'; msg: string }>
