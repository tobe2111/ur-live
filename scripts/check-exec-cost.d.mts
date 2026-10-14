/** 타입 선언 — 구현·근거는 check-exec-cost.mjs. */
export interface ExecMeasure { execKB: number; loadedKB?: number; top?: Array<[string, number]> }
export interface ExecError { name: string; kind: 'new' | 'grew' | 'slack' | 'gone'; msg: string }
export const TOLERANCE_KB: number
export const LOCK_SLACK_KB: number
export const RUNS: number
export function pickMedian<T extends { execKB: number }>(results: Array<T | null | undefined>): T | null
export const PAGES: Array<{ name: string; args: string[]; dashboard?: string }>
export function parse(stdout: string): (ExecMeasure & { route?: string; scriptMs?: number; tbtMs?: number }) | null
export function judge(
  measured: Record<string, ExecMeasure>,
  baseline: { pages?: Record<string, ExecMeasure> },
  opts?: { tolerance?: number; slack?: number },
): ExecError[]
