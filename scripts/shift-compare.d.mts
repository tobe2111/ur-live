/** 타입 선언 — 구현·근거는 shift-compare.mjs. */
export interface ShiftSnap { pos: Record<string, number[]>; vh?: number; docH?: number }
export function compareSnaps(a: ShiftSnap, b: ShiftSnap, threshold?: number): {
  moved: string[]; gone: string[]; born: string[]; movedVisible: number
}
