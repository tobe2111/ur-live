/** 타입 선언 — 구현·근거는 check-claude-md-growth.mjs. */
export const GROWTH_LIMIT_CHARS: number
export const BYPASS: string
export const RECORD_PATTERNS: RegExp[]
export function judgeClaudeMd(x: { baseText: string; headText: string; addedLines: string[]; commitMessages: string }): string[]
