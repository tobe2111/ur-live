/**
 * 🧵 제한 동시성 풀 — 계약 (2026-07-29 신설).
 *
 *   왜: 회사 보강 라운드가 **예산의 1/3만 쓰고 시간에 먼저 끝난다**(실측 `spent:21/60 · elapsed 9.7s`,
 *   당일 13라운드 중 7회 deadline). 병목은 서브리퀘스트가 아니라 **네트워크 대기**라, 대기를 겹치면
 *   같은 예산·같은 벽시계로 더 많은 리드를 본다.
 *
 *   여기서 고정하는 것: ① 동시에 도는 건수가 상한을 **절대** 넘지 않는다(Workers 동시 커넥션 6)
 *   ② 정지 신호(예산·시간·한도)가 오면 **새 건을 집지 않는다** ③ 한 건의 예외가 라운드를 죽이지 않는다
 *   ④ 아무 일 없으면 전부 처리한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runPooled, resolveConcurrency, MAX_LANE_CONCURRENCY } from '@/features/marketing/api/lane-pool'

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms))

describe('runPooled', () => {
  it('정지 신호가 없으면 전부 처리한다', async () => {
    const seen: number[] = []
    const r = await runPooled([1, 2, 3, 4, 5], 2, async (n) => { seen.push(n) }, () => false)
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5])
    expect(r).toEqual({ started: 5, failed: 0 })
  })

  it('🔒 동시 실행이 상한을 넘지 않는다 — 넘으면 Workers 커넥션 한도에 걸린다', async () => {
    let now = 0, peak = 0
    await runPooled(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      now++; peak = Math.max(peak, now)
      await tick(5)
      now--
    }, () => false)
    expect(peak).toBe(3)
  })

  it('실제로 겹쳐서 돈다 — 순차였다면 이 시험은 peak 1 이다(절약의 전부)', async () => {
    let peak = 0, now = 0
    await runPooled([1, 2, 3, 4], 4, async () => {
      now++; peak = Math.max(peak, now); await tick(5); now--
    }, () => false)
    expect(peak).toBeGreaterThan(1)
  })

  it('🛑 정지 신호가 뜨면 **새 건을 집지 않는다**(진행 중인 건은 끝까지)', async () => {
    const seen: number[] = []
    let stop = false
    const r = await runPooled([1, 2, 3, 4, 5, 6], 1, async (n) => {
      seen.push(n)
      if (n === 2) stop = true // 예산 소진 신호
    }, () => stop)
    expect(seen).toEqual([1, 2])
    expect(r.started).toBe(2)
  })

  it('처음부터 정지면 아무것도 착수하지 않는다', async () => {
    const r = await runPooled([1, 2, 3], 3, async () => { throw new Error('불려선 안 됨') }, () => true)
    expect(r).toEqual({ started: 0, failed: 0 })
  })

  it('한 건이 던져도 나머지가 계속 돈다 — 그리고 **세어서 보고한다**', async () => {
    const seen: number[] = []
    const r = await runPooled([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('크롤 폭발')
      seen.push(n)
    }, () => false)
    expect(seen.sort()).toEqual([1, 3])
    expect(r).toEqual({ started: 3, failed: 1 })
  })

  it('같은 건을 두 워커가 집지 않는다(커서는 원자적으로 전진)', async () => {
    const counts = new Map<number, number>()
    await runPooled(Array.from({ length: 50 }, (_, i) => i), 5, async (n) => {
      await tick(1)
      counts.set(n, (counts.get(n) || 0) + 1)
    }, () => false)
    expect([...counts.values()].every(v => v === 1)).toBe(true)
    expect(counts.size).toBe(50)
  })

  it('빈 목록은 즉시 끝난다(워커를 0개 띄운다)', async () => {
    expect(await runPooled([], 5, async () => { throw new Error('x') }, () => false)).toEqual({ started: 0, failed: 0 })
  })

  it('동시성이 0/음수/NaN 이어도 최소 1로 돈다 — 설정 오타가 레인을 멈추지 않게', async () => {
    for (const k of [0, -3, NaN]) {
      const seen: number[] = []
      await runPooled([1, 2], k, async (n) => { seen.push(n) }, () => false)
      expect(seen.sort()).toEqual([1, 2])
    }
  })
})

describe('resolveConcurrency — 설정값 해석', () => {
  it('기본은 3', () => {
    expect(resolveConcurrency(undefined)).toBe(3)
    expect(resolveConcurrency('')).toBe(3)
    expect(resolveConcurrency('abc')).toBe(3)
  })

  it('🔒 상한 5 로 클램프 — Workers 동시 커넥션 6 을 넘기지 않는다', () => {
    expect(resolveConcurrency('99')).toBe(MAX_LANE_CONCURRENCY)
    expect(MAX_LANE_CONCURRENCY).toBe(5)
  })

  it('0/음수는 기본값으로(멈춤 설정이 아니다)', () => {
    expect(resolveConcurrency('0')).toBe(3)
    expect(resolveConcurrency('-2')).toBe(3)
  })

  it('정상값은 그대로', () => {
    expect(resolveConcurrency('4')).toBe(4)
    expect(resolveConcurrency('1')).toBe(1)
  })
})

/**
 * 🔗 **회사 보강 레인이 실제로 풀을 쓰는가** — 형태 불변식.
 *
 *   #857 이 인플루언서 레인에 같은 처방(워커 풀)을 넣으며 남긴 교훈을 그대로 따른다:
 *   동시화는 **주석에만** 있으면 다음 리팩토링이 조용히 순차로 되돌린다. 되돌아가도 예외가 안 나고
 *   증상은 "라운드가 예산을 2/3 남기고 끝남" 이라, 원인을 여기로 되짚기 어렵다.
 *
 *   ⚠️ 이 검사가 **못 막는 것**: 실제 동시 실행은 소스로 증명되지 않는다(그건 위 runPooled 단위시험).
 *   또한 `stopP2` 검사와 예산 차감 사이에 await 가 있어 정지 시점에 최대 K건 초과 지출이 가능하다 —
 *   이건 설계상 허용(여유 `left <= 2` + 런타임 `limitHit` 백스톱)이며, 그 사실을 여기 적어 둔다.
 */
describe('enrich-lane — Phase 2 는 순차 루프로 되돌아가지 않는다', () => {
  const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/enrich-lane.ts'), 'utf8')

  it('runPooled 로 대상을 처리한다', () => {
    expect(SRC).toMatch(/runPooled\(targets, concurrency, handleLead, stopP2\)/)
  })

  it('동시성은 설정 해석기를 거친다(리터럴 하드코딩 금지 — 상한 클램프가 그 안에 있다)', () => {
    expect(SRC).toMatch(/resolveConcurrency\(/)
  })

  it('정지 조건이 예산·한도·시간 셋을 모두 본다 — 하나라도 빠지면 그 신호가 무시된다', () => {
    const m = /const stopP2 = \(\) => ([^\n]+)/.exec(SRC)
    expect(m, 'stopP2 를 못 찾았다 — 리팩토링됐다면 이 검사도 함께 갱신할 것').toBeTruthy()
    expect(m![1]).toContain('budget.left')
    expect(m![1]).toContain('limitHit')
    expect(m![1]).toContain('outOfBudget')
  })

  it('한 건의 예외 건수를 스냅샷에 남긴다 — 조용히 삼키면 동시화가 실패를 감춘다', () => {
    expect(SRC).toMatch(/pool\.failed/)
  })
})
