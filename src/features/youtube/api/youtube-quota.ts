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
 *
 * 🚀 2026-05-12: per-isolate 캐시 + 30초 마다 ctx.waitUntil 로 KV flush.
 *   - 라이브 셋업 1회당 KV.get/put ~수십 회 → 30초 1회로 축소.
 *   - Module-level state 는 isolate 단위 (CF Workers) — 일부 손실은 허용 (best-effort).
 */
import type { Env } from '@/worker/types/env'

const DAILY_LIMIT = 10_000
const WARN_THRESHOLD = 0.8  // 80%
const CRITICAL_THRESHOLD = 0.95  // 95%
const FLUSH_INTERVAL_MS = 30_000

interface QuotaDelta {
  total: number
  calls: Record<string, number>
}

// Module-level (per-isolate) 누적 캐시
const isolateQuotaCache: Map<string, QuotaDelta> = new Map()
let lastFlushAt = 0
let flushInFlight: Promise<void> | null = null

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface CtxLike {
  waitUntil?: (p: Promise<unknown>) => void
}

export async function trackQuota(env: Env, cost: number, label?: string, ctx?: CtxLike): Promise<void> {
  if (!env.SESSION_KV) return
  if (!cost || !Number.isFinite(cost)) return
  try {
    const dateKey = todayDate()
    const entry = isolateQuotaCache.get(dateKey) || { total: 0, calls: {} }
    entry.total += cost
    if (label) entry.calls[label] = (entry.calls[label] || 0) + cost
    isolateQuotaCache.set(dateKey, entry)

    const now = Date.now()
    if (now - lastFlushAt > FLUSH_INTERVAL_MS) {
      lastFlushAt = now
      const p = flushQuotaToKV(env)
      if (ctx?.waitUntil) ctx.waitUntil(p)
      // ctx 없을 땐 fire-and-forget — 다음 isolate 종료 전 가능한 한 보존되도록 await 안 함.
    }
  } catch { /* best-effort, quota tracking 실패가 라이브 망치면 안 됨 */ }
}

async function flushQuotaToKV(env: Env): Promise<void> {
  const kv = env.SESSION_KV
  if (!kv) return
  // 동시 flush 한 번만
  if (flushInFlight) return flushInFlight
  flushInFlight = (async () => {
    try {
      for (const [dateKey, delta] of Array.from(isolateQuotaCache.entries())) {
        if (!delta || delta.total === 0) continue
        // 즉시 캐시 비우고 (이후 추가 분은 다음 flush) race 손실 최소화
        isolateQuotaCache.set(dateKey, { total: 0, calls: {} })
        try {
          const key = `yt_quota:${dateKey}`
          const raw = await kv.get(key)
          const current = raw
            ? JSON.parse(raw) as { total: number; calls: Record<string, number> }
            : { total: 0, calls: {} }
          current.total += delta.total
          for (const [label, n] of Object.entries(delta.calls)) {
            current.calls[label] = (current.calls[label] || 0) + n
          }
          await kv.put(key, JSON.stringify(current), { expirationTtl: 172_800 })
        } catch {
          // KV 실패 시 delta 복원 (다음 flush 에서 재시도)
          const back = isolateQuotaCache.get(dateKey) || { total: 0, calls: {} }
          back.total += delta.total
          for (const [label, n] of Object.entries(delta.calls)) {
            back.calls[label] = (back.calls[label] || 0) + n
          }
          isolateQuotaCache.set(dateKey, back)
        }
      }
    } finally {
      flushInFlight = null
    }
  })()
  return flushInFlight
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
  const date = todayDate()
  if (!env.SESSION_KV) return { date, total: 0, limit: DAILY_LIMIT, ratio: 0, calls: {}, warning: 'ok' }
  // Admin 조회 — 정확도 위해 unflushed delta 함께 반영
  const raw = await env.SESSION_KV.get(`yt_quota:${date}`).catch(() => null)
  const data = raw ? JSON.parse(raw) as { total: number; calls: Record<string, number> } : { total: 0, calls: {} }
  const pending = isolateQuotaCache.get(date)
  if (pending) {
    data.total += pending.total
    for (const [label, n] of Object.entries(pending.calls)) {
      data.calls[label] = (data.calls[label] || 0) + n
    }
  }
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
