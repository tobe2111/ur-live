/** 타입 선언 — 구현·근거는 check-verify-in-flight.mjs. */
export const MIN_MINUTES: number
export const BYPASS_ENV: string
export function judgeInFlight(x: { runs: Array<{ status: string; run_started_at?: string; created_at: string; html_url?: string }>; now: Date }): { block: boolean; minutes: number; url: string | null }
