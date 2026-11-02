/** 타입 선언 — 구현·근거는 facts-live.mjs. */
export const LIVE_FILE: string
export const FACTS_URL: string
export const SAMPLE_LIVE: Record<string, unknown>
export function formatLiveFacts(d: any, opts?: { feePct?: number }): Record<string, any>
export function readLive(): { source: string; fetchedAt: string; data: any }
