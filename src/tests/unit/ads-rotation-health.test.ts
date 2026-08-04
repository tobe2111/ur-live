/**
 * 🩺 키워드 순환 건강 판정 — `judgeRotation` (2026-08-04)
 *
 * ⚠️ **이 테스트가 지키는 것**: 경보가 *해제될 수 있어야* 한다는 것. 종전 판정(`2일 초과가 30%`)은
 *   한 바퀴가 2일보다 길어지는 순간부터 **시스템이 완벽해도 항상 참**이었다 — 첫 케이스가 그 상태를
 *   라이브 실측값 그대로 재현하고 `stalled === false` 를 요구한다.
 *
 * ⚠️ **못 막는 것**: SQL 이 `active`/`ran24h`/`oldest_days` 를 **옳게 집계하는지**는 여기서 못 본다
 *   (D1 밖). 컬럼명이 바뀌면 판정은 조용히 0 입력을 받는다 — 그건 `check-sql-column-exists` 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { judgeRotation, ROTATION_STARVE_CYCLES } from '@/features/marketing/api/influencer-keyword-rotation'

describe('judgeRotation', () => {
  it('라이브 실측(2026-08-04) — 느리지만 도는 상태는 경보가 아니다', () => {
    // 활성 399 · 24h 61개 실행 · 최악 14.46일 · 평균 5.68일
    //   → 한 바퀴 6.5일, 최악 2.2바퀴. 종전 임계로는 80%(320개)가 "2일째 미실행"이라 **항상** 울렸다.
    const v = judgeRotation({ active: 399, ran24h: 61, oldestDays: 14.46, avgDays: 5.68 })
    expect(v.cycleDays).toBeCloseTo(6.54, 1)
    expect(v.worstCycles).toBeLessThan(ROTATION_STARVE_CYCLES)
    expect(v.stalled).toBe(false)
    expect(v.reason).toBeNull()
  })

  it('순환 정지 — 24시간 실행 0개는 stopped', () => {
    const v = judgeRotation({ active: 399, ran24h: 0, oldestDays: 9, avgDays: 4 })
    expect(v.stalled).toBe(true)
    expect(v.reason).toBe('stopped')
    expect(v.cycleDays).toBe(Number.POSITIVE_INFINITY)
  })

  it('편식 — 도는데 꼬리가 여러 바퀴째 건너뛰어지면 starved', () => {
    // 한 바퀴 4일인데 최악이 30일 = 7.5바퀴 → 순번 자체가 안 오는 것(라운드로빈 파손)
    const v = judgeRotation({ active: 400, ran24h: 100, oldestDays: 30, avgDays: 2 })
    expect(v.cycleDays).toBeCloseTo(4, 5)
    expect(v.reason).toBe('starved')
  })

  it('경계 — 정확히 배수까지는 정상, 넘어야 경보', () => {
    const cycle = 4 // active 400 / ran 100
    const at = judgeRotation({ active: 400, ran24h: 100, oldestDays: cycle * ROTATION_STARVE_CYCLES, avgDays: 2 })
    expect(at.stalled).toBe(false)
    const over = judgeRotation({ active: 400, ran24h: 100, oldestDays: cycle * ROTATION_STARVE_CYCLES + 0.1, avgDays: 2 })
    expect(over.stalled).toBe(true)
  })

  it('표본이 작으면 판정하지 않는다 — 시드 직후 노이즈', () => {
    // ran24h 0 이라도 활성 20 미만이면 경보 아님(막 시드한 상태).
    expect(judgeRotation({ active: 5, ran24h: 0, oldestDays: 99, avgDays: 99 }).stalled).toBe(false)
  })

  it('깨진 입력에 죽지 않는다 — 경보 코드가 수집을 막으면 안 된다', () => {
    const v = judgeRotation({ active: NaN, ran24h: NaN, oldestDays: NaN, avgDays: NaN } as never)
    expect(v.stalled).toBe(false)
    expect(() => judgeRotation({} as never)).not.toThrow()
  })
})
