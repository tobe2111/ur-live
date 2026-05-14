/**
 * RateLimiterDurableObject — KV 무료 한도 보호용 글로벌 일관성 rate limiter.
 *
 * 🛡️ 2026-05-13: 기존 RATE_LIMIT_KV 가 매 요청마다 read+write 1회씩 → 무료 한도 50% 도달.
 *   대안 비교:
 *     - In-memory per-isolate: 정확도 60-80% (글로벌 isolate 분산)
 *     - Durable Object: 정확도 100% + 무료 한도 1M req/월
 *     - 유료 KV $5/월: 0 작업 + 10M reads
 *   선택: DO — production 보안 + 무료 한도 내 운영.
 *
 * 동작:
 *   - 1 DO instance per (action + ip) — idFromName 으로 deterministic mapping
 *   - storage 에 { count, resetTime } 영구 저장 (DO storage, 무료 1GB)
 *   - 윈도우 만료 시 자동 reset
 *
 * 사용:
 *   const id = env.RATE_LIMITER.idFromName(`${action}:${ip}`)
 *   const stub = env.RATE_LIMITER.get(id)
 *   const res = await stub.fetch('https://internal/check', {
 *     method: 'POST',
 *     body: JSON.stringify({ maxRequests, windowMs })
 *   })
 *   const { allowed, remaining, resetAt } = await res.json()
 */

import { DurableObject } from 'cloudflare:workers'

interface RateLimitRecord {
  count: number
  resetTime: number  // ms epoch
}

export class RateLimiterDurableObject extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/check') {
      return new Response('Not Found', { status: 404 })
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let body: { maxRequests?: number; windowMs?: number }
    try {
      body = await request.json()
    } catch {
      return new Response('Invalid body', { status: 400 })
    }
    const maxRequests = Math.max(1, Math.floor(body.maxRequests ?? 60))
    const windowMs = Math.max(1000, Math.floor(body.windowMs ?? 60_000))

    const now = Date.now()
    const stored = await this.ctx.storage.get<RateLimitRecord>('record')

    let record: RateLimitRecord
    if (stored && now < stored.resetTime) {
      record = { count: stored.count + 1, resetTime: stored.resetTime }
    } else {
      record = { count: 1, resetTime: now + windowMs }
    }
    await this.ctx.storage.put('record', record)
    // 윈도우 만료 직후 storage 자동 정리 (1.5x window 후 alarm)
    const alarmAt = record.resetTime + windowMs * 0.5
    await this.ctx.storage.setAlarm(alarmAt).catch(() => {})

    const allowed = record.count <= maxRequests
    return new Response(
      JSON.stringify({
        allowed,
        count: record.count,
        remaining: Math.max(0, maxRequests - record.count),
        resetAt: record.resetTime,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  async alarm() {
    // 윈도우 끝난 record 정리 (memory 절약, DO storage 비용 절감)
    const r = await this.ctx.storage.get<RateLimitRecord>('record')
    if (r && Date.now() > r.resetTime) {
      await this.ctx.storage.delete('record')
    }
  }
}

// minimal Env interface — RateLimiterDO 는 외부 binding 안 씀
interface Env {
  // empty intentionally
}
