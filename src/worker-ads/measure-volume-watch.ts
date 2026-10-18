/**
 * 📏 유어애즈 **측정량 경보** — 하루에 몇 명을 측정했는가(2026-10-18 대표 결재
 * `2026-10-15-ads-alarm-stall-alert` 안 2 · 대표 *"모두 가장 이상적으로 진행해줘"*).
 *
 * ## 왜
 * 측정 체인은 매시 1~3회 돌고 멎은 뒤 다음 정각에 다시 깨어나는 것이 평소 모습이다(유휴 Durable Object 의
 * 알람 배달 지연 — 우리 코드가 아니다). 침묵 경보(32분)는 그 *증상*을 재서 시간대마다 울렸다 안 울렸다 했다.
 * 정말 알고 싶은 것은 *결과* — 측정이 하루치 일을 했는가 — 다. 그래서 침묵 임계는 구조적 상한(62분,
 * `lane-cadence.ts` 의 `ALARM_SWEEP_GAP_MIN`)으로만 올리고, **이 경보를 주 신호로** 삼는다.
 *
 * ## 기준 (라이브 실측 2026-10-10~17, `perf_checked_at` 일별)
 *   10,147 · 16,585 · 22,355 · 19,707 · 21,572 · 13,671 · 16,077 · 13,038
 * 하루 종일 체인이 멎은 시간대 모양(시간당 150~345)이면 하루 4~8천이 된다. 하한 5,000 은 그 아래다.
 * ⚠️ `perf_checked_at` 은 마지막 측정 시각만 남는다(재측정이면 덮인다) — 실제 측정 횟수보다 **적게** 센다.
 *    그래서 하한을 보수적으로 잡았다. 숫자를 바꾸려면 위 실측을 다시 뜨고 고칠 것.
 *
 * 매일 00:00 UTC(09:00 KST) 1회 · 인덱스(`idx_ad_inf_leads_perf`) 범위 COUNT 1회. 실패는 삼킨다(관측이 작업을 막지 않는다).
 */
import type { Env } from '@/worker/types/env'
import { adsLeadsDb } from '../shared/ads/leads-db'

type BeatFn = (name: string, ok: boolean, ms: number, err?: unknown, maxGapMin?: number, extra?: Record<string, unknown>) => Promise<void>
type Defer = (p: Promise<unknown>) => void

export const MEASURE_VOLUME_BEAT = 'measure-volume'
/** 지난 24시간 측정 수가 이보다 적으면 경보. */
export const MEASURE_VOLUME_FLOOR_PER_DAY = 5000
export const MEASURE_VOLUME_HOUR_UTC = 0

/** 순수 판정 — 못 셌으면(null) 판정하지 않는다(모르는 것과 0 은 다르다). */
export function judgeMeasureVolume(count: number | null, floor = MEASURE_VOLUME_FLOOR_PER_DAY): 'ok' | 'low' | 'unknown' {
  if (count == null || !Number.isFinite(count)) return 'unknown'
  return count < floor ? 'low' : 'ok'
}

export function runMeasureVolumeWatch(env: Env, hourUTC: number, beat: BeatFn, defer: Defer, gapMin: number): void {
  if (hourUTC !== MEASURE_VOLUME_HOUR_UTC) return
  defer((async () => {
    const t0 = Date.now()
    let n: number | null = null
    try {
      const row = await adsLeadsDb(env).prepare(
        "SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE perf_checked_at >= datetime('now', '-1 day')",
      ).first<{ n: number }>()
      n = row ? Number(row.n) : null
    } catch { /* 못 셈 — unknown */ }
    const verdict = judgeMeasureVolume(n)
    const extra = { measured_24h: n, floor: MEASURE_VOLUME_FLOOR_PER_DAY, verdict }
    if (verdict !== 'ok') {
      // 못 센 것도 알린다 — 이 경보가 주 신호라, 감시가 깨진 채 조용하면 측정이 멎어도 아무도 모른다.
      const msg = verdict === 'low'
        ? `지난 24시간 측정 ${n}명 — 하한 ${MEASURE_VOLUME_FLOOR_PER_DAY}명 미만(평소 1만~2만)`
        : '측정 수를 세지 못했다(리드 DB 조회 실패) — 측정량 경보가 판정을 못 하는 상태'
      await beat(MEASURE_VOLUME_BEAT, false, Date.now() - t0, new Error(msg), gapMin, extra)
      return
    }
    await beat(MEASURE_VOLUME_BEAT, true, Date.now() - t0, undefined, gapMin, extra)
  })())
}
