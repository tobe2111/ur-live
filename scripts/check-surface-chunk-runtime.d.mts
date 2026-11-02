/** 타입 선언 — 구현·근거는 check-surface-chunk-runtime.mjs. */
export const PREFETCH_OK: Record<string, string[]>
export const FORBIDDEN: RegExp[]
export function judge(chunks: string[], surface: string, surfaces?: Record<string, string[]>): string[]
export function labelsOf(surface: string, surfaces?: Record<string, string[]>): string[]
export function lzLabels(s: string): string[]
export function stem(f: string): string
export const PAGES: { name: string; args: string[]; surface: string }[]
/** 표본(1%)으로 불려 오는 env-validator·validation 을 뺀다 — validation 은 env-validator 와 함께일 때만. */
export function dropSampled(chunks: string[]): string[]
