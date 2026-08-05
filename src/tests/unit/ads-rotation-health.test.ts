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
import { judgeRotation, ROTATION_STARVE_CYCLES, pickStarvationRescue } from '@/features/marketing/api/influencer-keyword-rotation'

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

/**
 * 🛟 기아 방지 슬롯 — `starved` 경보가 실전에서 처음 잡은 것의 수리 (2026-08-04 저녁).
 *   라이브 실측: 자동확장 키워드 24개가 생성 14.9일째 실행 0회, 커서에서 거리 275(≈10일 더 대기).
 */
describe('pickStarvationRescue', () => {
  const kw = (id: number, ran: boolean) => ({ id, last_run_at: ran ? '2026-08-04 10:00:00' : null })

  it('가장 오래된(id 최소) 미실행 키워드를 고른다 — 라이브 케이스', () => {
    // 실행된 것들 사이에 미실행(생성 14.9일)이 끼어 있다 — id 가 곧 생성순이다.
    const pool = [kw(1, true), kw(120, false), kw(121, false), kw(300, true), kw(400, false)]
    expect(pickStarvationRescue(pool, new Set())?.id).toBe(120)
  })

  it('이번 라운드에 이미 뽑힌 키워드는 건너뛴다 — 같은 픽 이중 소비 금지', () => {
    const pool = [kw(120, false), kw(121, false)]
    expect(pickStarvationRescue(pool, new Set([120]))?.id).toBe(121)
  })

  it('미실행이 없으면 null — 슬롯은 반납되고 평소 픽이 그대로 돈다', () => {
    expect(pickStarvationRescue([kw(1, true), kw(2, true)], new Set())).toBeNull()
    expect(pickStarvationRescue([], new Set())).toBeNull()
  })

  it('한 번이라도 돈 키워드는 구제하지 않는다 — 제2의 커서가 되면 진짜 커서를 굶긴다', () => {
    // 오래됐어도 last_run_at 이 있으면 커서 순환의 몫이다.
    const pool = [{ id: 5, last_run_at: '2026-07-01 00:00:00' }, kw(900, false)]
    expect(pickStarvationRescue(pool, new Set())?.id).toBe(900)
  })

  it('매 라운드 하나씩 소진된다 — 24개 잔량이 24라운드에 0이 되는 불변식', () => {
    let pool = Array.from({ length: 24 }, (_, i) => kw(100 + i, false))
    for (let round = 0; round < 24; round++) {
      const r = pickStarvationRescue(pool, new Set())
      expect(r).not.toBeNull()
      pool = pool.map(k => (k.id === r!.id ? { ...k, last_run_at: 'ran' } : k))
    }
    expect(pickStarvationRescue(pool, new Set())).toBeNull()
  })
})

/** 🔌 배선 불변식 — 함수가 있어도 배선이 빠지면 아무 일도 안 한다("코드에 있다 ≠ 살아 있다"). */
describe('기아 방지 슬롯 — 배선', () => {
  it('finalPicks 맨 앞에 rescue 가 온다 (예산이 앞에서 끊기므로 앞자리만 처리 보장)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/features/marketing/api/influencer-auto-collect.ts', 'utf8')
    expect(src).toMatch(/const rescue = pickStarvationRescue\(kws,/)
    expect(src).toMatch(/rescue \? \[rescue, \.\.\.interleaved/)
  })
})
