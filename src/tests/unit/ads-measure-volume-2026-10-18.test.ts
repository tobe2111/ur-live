/**
 * 📏 유어애즈 경보 재정렬 (2026-10-18 대표 결재 `2026-10-15-ads-alarm-stall-alert` 안 2).
 *   ① 알람 레인 침묵 임계 = 알람 배달 상한 62분(그 이상 올리지 않는다)
 *   ② 측정량 경보 — 하루 측정 수가 하한 미만이거나 **못 셌으면** 울린다(감시가 깨진 채 조용하면 안 된다)
 *
 * ## ⚠️ 못 막는 것
 * - 하한(5,000)이 앞으로도 맞는 값인지(측정 계획이 바뀌면 다시 재야 한다)
 * - 경보를 사람이 보는지
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { judgeMeasureVolume, runMeasureVolumeWatch, MEASURE_VOLUME_FLOOR_PER_DAY, MEASURE_VOLUME_HOUR_UTC } from '@/worker-ads/measure-volume-watch'
import { alarmLaneGapMinutes, ALARM_SWEEP_GAP_MIN, staleGapMinutes } from '@/worker-ads/lane-cadence'

describe('① 알람 레인 침묵 임계', () => {
  it('1분 주기 레인은 62분 — 32분이면 정상 배달 지연(31~60분)에도 울린다', () => {
    expect(ALARM_SWEEP_GAP_MIN).toBe(62)
    expect(alarmLaneGapMinutes(1)).toBe(62)
    expect(staleGapMinutes(1)).toBe(32) // 일반 레인 공식은 그대로(메인과 동치 — ads-lane-cadence 가 고정)
  })
  it('주기가 긴 레인은 원래 공식이 이긴다(상한으로 줄이지 않는다)', () => {
    expect(alarmLaneGapMinutes(60)).toBe(staleGapMinutes(60))
  })
  it('알람 레인이 실제로 그 함수를 쓴다', () => {
    const src = stripComments(readFileSync('src/worker-ads/lane-alarm.ts', 'utf8'))
    expect(src).toMatch(/alarmLaneGapMinutes\(Math\.max\(1, Math\.round\(60 \/ Math\.max\(1, cap\)\)\)\)/)
    expect(src).not.toMatch(/staleGapMinutes\(/)
  })
})

describe('② 측정량 경보', () => {
  it('판정 — 하한 미만 low · 이상 ok · 못 셈 unknown', () => {
    expect(judgeMeasureVolume(MEASURE_VOLUME_FLOOR_PER_DAY - 1)).toBe('low')
    expect(judgeMeasureVolume(MEASURE_VOLUME_FLOOR_PER_DAY)).toBe('ok')
    expect(judgeMeasureVolume(null)).toBe('unknown')
  })

  const run = async (n: number | 'throw' | null, hour = MEASURE_VOLUME_HOUR_UTC) => {
    const beats: Array<{ name: string; ok: boolean }> = []
    const tasks: Promise<unknown>[] = []
    const db = {
      prepare: () => ({
        first: async () => { if (n === 'throw') throw new Error('d1'); return n == null ? null : { n } },
      }),
    }
    runMeasureVolumeWatch({ DB: db, ADS_DB: db } as never, hour,
      async (name, ok) => { beats.push({ name, ok }) }, (p) => { tasks.push(p) }, 1800)
    await Promise.all(tasks)
    return beats
  }

  it('평소 수준이면 성공 하트비트', async () => {
    expect(await run(13038)).toEqual([{ name: 'measure-volume', ok: true }])
  })
  it('하한 미만이면 실패로 알린다', async () => {
    expect(await run(3600)).toEqual([{ name: 'measure-volume', ok: false }])
  })
  it('못 세면 조용히 넘어가지 않고 실패로 알린다', async () => {
    expect(await run('throw')).toEqual([{ name: 'measure-volume', ok: false }])
  })
  it('하루 한 번만 돈다', async () => {
    expect(await run(3600, 5)).toEqual([])
  })
  it('스케줄러에 배선돼 있다', () => {
    const src = stripComments(readFileSync('src/worker-ads/index.ts', 'utf8'))
    expect(src).toMatch(/runMeasureVolumeWatch\(env, hourUTC, adsBeat,/)
  })
})
