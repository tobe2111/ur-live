/**
 * ⏰ **보강 레인 알람 DO** — 정책·근거는 `lane-alarm-policy.ts` 헤더에 있다(이 파일은 실행만).
 *
 * ⚠️ **인스턴스는 하나만** 쓴다(`idFromName('enrich-influencer')`). 여러 개를 만들면 같은 큐를
 *   동시에 집어 중복 측정이 된다(이 큐는 선점이 아니라 정렬+LIMIT).
 */
import { DurableObject } from 'cloudflare:workers'
import type { Env } from '@/worker/types/env'
import {
  alarmEnabled, resolveInterval, resolveRunsPerHour, nextWakeAt, hourBucket, LANE_ALARM_STAMP_KEY,
} from './lane-alarm-policy'

interface AlarmEnv {
  ADS_LANE_ALARM_INTERVAL_MS?: string
  ADS_LANE_ALARM_RUNS_PER_HOUR?: string
}

export class AdsLaneDurableObject extends DurableObject<Env> {
  /** 부트스트랩 — 알람이 없으면 건다. **멱등**이라 cron 이 매 정각 불러도 안전하다. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/start') return new Response('Not Found', { status: 404 })
    if (!alarmEnabled(this.env)) return Response.json({ ok: true, enabled: false })
    const cur = await this.ctx.storage.getAlarm()
    if (cur == null) {
      await this.ctx.storage.setAlarm(Date.now() + 1_000)
      return Response.json({ ok: true, started: true })
    }
    return Response.json({ ok: true, started: false, alarmAt: cur })
  }

  /**
   * 한 회차 = 보강 1라운드. **호출부가 없다** — 런타임이 예약 시각에 독립 인보케이션으로 깨운다.
   * 💥 절대 throw 하지 않는다: throw 하면 다음 알람을 못 걸어 체인이 영구히 멎는다.
   */
  async alarm(): Promise<void> {
    const t0 = Date.now()
    if (!alarmEnabled(this.env)) return // 킬스위치 — 다음 알람을 안 걸면 체인이 멎는다

    const e = this.env as unknown as AlarmEnv
    const interval = resolveInterval(e.ADS_LANE_ALARM_INTERVAL_MS, e)
    const cap = resolveRunsPerHour(e.ADS_LANE_ALARM_RUNS_PER_HOUR, e)

    const bucket = hourBucket(t0)
    const prevBucket = (await this.ctx.storage.get<number>('bucket')) ?? -1
    const runs = prevBucket === bucket ? ((await this.ctx.storage.get<number>('runs')) ?? 0) : 0
    const failStreak = (await this.ctx.storage.get<number>('failStreak')) ?? 0

    let stats: unknown = null
    let error: string | undefined
    if (runs < cap) {
      try {
        const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
        stats = await runInfluencerEnrich(this.env)
      } catch (err) {
        error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 200)}`
      }
    }

    const ran = runs < cap ? runs + 1 : runs
    const nextFail = error ? failStreak + 1 : 0
    // 🅿️ 상태를 먼저 저장한다 — 알람 예약 전에 죽어도 다음 부트스트랩이 이어받는다.
    await this.ctx.storage.put({ bucket, runs: ran, failStreak: nextFail }).catch(() => undefined)

    const at = nextWakeAt(Date.now(), interval, ran, cap, nextFail)
    await this.ctx.storage.setAlarm(at).catch(() => undefined)

    // 📊 스탬프 — **이 시범의 목적이 측정이다.** 한도에 닿는지, 회차가 실제로 이어지는지 여기서만 보인다.
    try {
      const DB = (this.env as { DB?: D1Database }).DB
      if (DB) {
        await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
          .bind(LANE_ALARM_STAMP_KEY, JSON.stringify({
            at: new Date().toISOString(), ms: Date.now() - t0, runs_this_hour: ran, cap,
            interval_ms: interval, next_at: new Date(at).toISOString(), fail_streak: nextFail,
            ...(error ? { error: error.slice(0, 200) } : {}),
            stats: stats ? JSON.parse(JSON.stringify(stats)) : null,
          }).slice(0, 2000)).run()
      }
    } catch { /* 관측 실패가 체인을 끊지 않는다 */ }
  }
}
