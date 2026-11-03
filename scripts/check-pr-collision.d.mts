/** 타입 선언 — 구현·근거는 check-pr-collision.mjs. */
export const MAX_FILES: number
export const MAX_AGE_HOURS: number
export const IGNORE: RegExp[]
export function judgeSize(x: { files: number; ageHours: number }): string[]
export function judgeOverlap(x: { mine: string[]; others: Array<{ number: number; title: string; files: string[] }> }): Array<{ number: number; title: string; files: string[] }>
