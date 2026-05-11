/**
 * 🛡️ 2026-05-11 P3-#10: YouTube API quota 추적.
 *
 * YouTube Data API v3 무료 quota: 10,000 units/day per project.
 * 주요 비용:
 *   - liveBroadcasts.insert    = 50 units
 *   - liveBroadcasts.transition = 50 units
 *   - liveBroadcasts.update    = 50 units
 *   - thumbnails.set           = 50 units
 *   - liveBroadcasts.list      = 1 unit
 *   - liveStreams.list         = 1 unit
 *
 * 일일 카운터: SESSION_KV 의 `yt_quota:YYYY-MM-DD` 키.
 * Admin 엔드포인트로 사용량 조회 + 80%/95% 도달 시 last_error 로 흔적 남김.
 */
import type { Env } from '@/worker/types/env'

const DAILY_LIMIT = 10_000
const WARN_THRESHOLD = 0.8  // 80%
const CRITICAL_THRESHOLD = 0.95  // 95%

function todayKey(): string {
  return `yt_quota:${new Date().toISOString().slice(0, 10)}`
}

export async function trackQuota(env: Env, cost: number, label?: string): Promise<void> {
  if (!env.SESSION_KV) return
  try {
    const key = todayKey()
    const raw = await env.SESSION_KV.get(key)
    const current = raw ? JSON.parse(raw) as { total: number; calls: Record<string, number> } : { total: 0, calls: {} }
    current.total += cost
    if (label) current.calls[label] = (current.calls[label] || 0) + cost
    // KV TTL: 48시간 (다음날 키와 1일 겹치게 — 비교 가능)
    await env.SESSION_KV.put(key, JSON.stringify(current), { expirationTtl: 172_800 })
  } catch { /* best-effort, quota tracking 실패가 라이브 망치면 안 됨 */ }
}

export interface QuotaUsage {
  date: string
  total: number
  limit: number
  ratio: number
  calls: Record<string, number>
  warning: 'critical' | 'warn' | 'ok'
}

export async function getQuotaUsage(env: Env): Promise<QuotaUsage> {
  const date = new Date().toISOString().slice(0, 10)
  if (!env.SESSION_KV) return { date, total: 0, limit: DAILY_LIMIT, ratio: 0, calls: {}, warning: 'ok' }
  const raw = await env.SESSION_KV.get(`yt_quota:${date}`).catch(() => null)
  const data = raw ? JSON.parse(raw) as { total: number; calls: Record<string, number> } : { total: 0, calls: {} }
  const ratio = data.total / DAILY_LIMIT
  const warning = ratio >= CRITICAL_THRESHOLD ? 'critical' : ratio >= WARN_THRESHOLD ? 'warn' : 'ok'
  return { date, total: data.total, limit: DAILY_LIMIT, ratio, calls: data.calls, warning }
}

// 비용 상수 export (호출부에서 magic number 피하기)
export const QUOTA_COST = {
  list: 1,
  insert: 50,
  update: 50,
  transition: 50,
  delete: 50,
  thumbnailSet: 50,
} as const
