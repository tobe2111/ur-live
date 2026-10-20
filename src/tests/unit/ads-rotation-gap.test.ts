/**
 * 🔁 **회전을 아는 침묵 기준** — 계약 (2026-08-05, 라이브 경보 6건 전수 판정에서 도출).
 *
 * ## 무엇이 문제였나
 * 침묵 임계는 cron 식(`0 * * * *`)에서 "매시간 돈다"고 유도한 **150분**이었다. 그런데 매시간 도는 건
 * **부모**고, 레인은 회차마다 `lanesPerTick` 개만 돌아가며 뽑힌다 — 매시간 *자격*이 있어도 실제
 * 차례는 몇 시간에 한 번이다. 지킬 수 없는 기준이라 **영원히 울린다.**
 *
 * ## 이 시험이 지키는 것
 * 1. 회전 계산이 라이브 스냅샷과 맞는가 (아래 픽스처는 실제 `ads_dispatch_last` 값이다)
 * 2. **오탐은 침묵하고 진짜는 계속 울리는가** — 완화가 경보를 무력화하면 안 된다
 * 3. `always` 레인을 회전에서 빼는가 (안 빼면 기준이 필요 이상으로 느슨해진다)
 * 4. 배선: `periodMin` 을 가진 레인**만** 완화되고, `periodMin` 자체는 **안 바뀐다**
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **완화가 과한지**는 판정 못 한다. 매시간 레인이 진짜 멈추면 경보가 회전 배수만큼 늦어진다
 *   (prospect 면 150분 → 630분). 그 대가로 "울리면 진짜"를 얻는다는 판단이지 증명이 아니다.
 * - 회전 수는 **그 회차의** 배분에서 나온다. 레인이 추가·삭제되면 값이 달라진다(의도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rotationTicks, rotatedGapMinutes, staleGapMinutes, hourlyGapMinutes } from '@/worker-ads/lane-cadence'

/** 라이브 `ads_dispatch_last` (2026-08-04T18:00Z) 그대로 — 숫자를 지어내지 않는다. */
const LIVE = {
  influencer: { budget: 2, run: ['a', 'b'], deferred: ['c'], always: 0 },
  company: { budget: 1, run: ['a', 'b', 'c', 'd'], deferred: ['e', 'f', 'g'], always: 3 },
  prospect: { budget: 1, run: ['a'], deferred: ['b', 'c', 'd', 'e'], always: 0 },
  wholesale: { budget: 1, run: ['a'], deferred: [], always: 0 },
}

describe('rotationTicks — 한 레인의 차례가 몇 회차마다 오는가', () => {
  it('라이브 배분과 일치한다', () => {
    expect(rotationTicks(LIVE.prospect)).toBe(5)    // 몫 1 에 5개 경쟁 → 5시간
    expect(rotationTicks(LIVE.company)).toBe(4)     // run 4 중 3 은 always → 경쟁 1+3=4, 몫 1
    expect(rotationTicks(LIVE.influencer)).toBe(2)  // 경쟁 3, 몫 2 → ceil(1.5)
    expect(rotationTicks(LIVE.wholesale)).toBe(1)   // 회전 없음 → 기준 불변이어야 한다
  })

  it('`always` 를 빼지 않으면 기준이 필요 이상으로 느슨해진다', () => {
    // company 의 run 4 는 always 3 을 포함한다. 안 빼면 7/1=7 로 부풀어 기준이 2배 가까이 커진다.
    expect(rotationTicks(LIVE.company)).toBe(4)
    expect(rotationTicks({ ...LIVE.company, always: 0 })).toBe(7)
  })

  it('망가진 입력에도 1 이상 — 0 이 나오면 기준이 무한대가 된다', () => {
    for (const bad of [null, undefined, {}, { budget: 0 }, { budget: -3, deferred: ['x'] }, { budget: Number.NaN }]) {
      expect(rotationTicks(bad as never)).toBeGreaterThanOrEqual(1)
    }
  })

  it('회전 1 이면 종전과 **똑같은** 기준 — 회전이 없는 곳은 아무것도 안 바뀐다', () => {
    expect(rotatedGapMinutes(60, rotationTicks(LIVE.wholesale))).toBe(hourlyGapMinutes())
    expect(rotatedGapMinutes(60, 1)).toBe(staleGapMinutes(60))
  })
})

describe('🔑 라이브 경보 6건 재판정 — 오탐은 침묵, 진짜는 계속 울린다', () => {
  const verdict = (ageMin: number, gap: number) => (ageMin > gap ? '울린다' : '조용')

  it('오탐 5건 — 전부 조용해진다 (마지막 실행 결과가 모두 성공이었다)', () => {
    const cases: [string, number, keyof typeof LIVE][] = [
      ['collect-store-kakao', 420, 'prospect'],
      ['collect-hira', 300, 'prospect'],
      ['collect-localdata?mode=backfill', 180, 'prospect'],
      ['sweep-kakao-chain', 300, 'company'],
      ['match-registry', 180, 'company'],
    ]
    for (const [name, age, dom] of cases) {
      const gap = rotatedGapMinutes(60, rotationTicks(LIVE[dom]))
      expect(verdict(age, gap), `${name} 이 아직 울린다 — 완화가 안 먹었다`).toBe('조용')
      expect(verdict(age, hourlyGapMinutes()), `${name} 은 종전 기준으론 울렸어야 한다`).toBe('울린다')
    }
  })

  it('🔴 진짜 1건 — `scan-notices`(일 1회, 3일 침묵)는 그대로 울린다', () => {
    // 일 1회 레인은 명시 `gap` 을 갖고 **회전 대상이 아니다**(미룰 수 없어 항상 돈다).
    // 그래서 이 완화가 닿지 않는다 — 그게 설계가 지키려는 성질이다.
    // 🩸 2026-08-25: 일간 임계가 2910 → 1800(24h+6h)으로 **좁아졌다**(회차 누락이 보이게).
    //   이 케이스는 3일 침묵이라 좁아진 뒤에도 그대로 울린다 — 완화가 안 닿는 성질이 유지된다.
    const dailyGap = staleGapMinutes(24 * 60)     // 1800
    expect(dailyGap).toBe(24 * 60 + 6 * 60)
    expect(verdict(4139, dailyGap)).toBe('울린다')
  })
})

describe('🚧 배선 — 완화가 실제로 디스패치에 걸리는가', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/lane-runner.ts'), 'utf8')

  it('띄우는 레인에 회전 임계를 씌운다', () => {
    expect(src).toMatch(/rotatedGapMinutes\(l\.periodMin, rotationTicks\(sel\.perDomain\[laneDomain\(l\.beat\)\]\)\)/)
    // 씌운 것을 실제로 띄워야 한다 — 계산만 하고 sel.run 을 그대로 넘기면 조용한 no-op 이다
    expect(src).toContain('runLanes(runWithGap, {')
    expect(src).not.toContain('runLanes(sel.run, {')
  })

  it('🔒 `periodMin` 은 안 바뀐다 — 키우면 일 1회 레인이 미룰 수 있게 되어 영영 안 돈다', () => {
    const line = src.split('\n').find(l => l.includes('rotatedGapMinutes(l.periodMin')) || ''
    expect(line).toContain('gapMin:')
    expect(line, 'periodMin 을 덮어쓰고 있다 — 미루기 판정이 오염된다').not.toMatch(/periodMin\s*:/)
  })

  it('🔒 명시 `gap` 레인(일 1회·N시간)은 손대지 않는다 — 그래야 진짜 침묵이 계속 잡힌다', () => {
    expect(src).toContain('l.periodMin === undefined ? l')
  })
})
