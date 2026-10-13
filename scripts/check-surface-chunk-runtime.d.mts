/** 타입 선언 — 구현·근거는 check-surface-chunk-runtime.mjs. */
export const PREFETCH_OK: Record<string, string[]>
export const FORBIDDEN: RegExp[]
export function judge(chunks: string[], surface: string, surfaces?: Record<string, string[]>): string[]
export function labelsOf(surface: string, surfaces?: Record<string, string[]>): string[]
export function lzLabels(s: string): string[]
export function stem(f: string): string
