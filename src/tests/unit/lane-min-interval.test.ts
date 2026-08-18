import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dueByElapsed } from '@/worker-ads/lane-alarm-policy'
import { ALARM_LANES } from '@/worker-ads/lane-alarm-runners'

/**
 * ⏳ **최소 간격을 시각의 짝수성이 아니라 경과 시간으로** — 유실된 회차를 다음 시간이 이어받게 한다.
 *
 * 라이브 실측(2026-08-17, 최근 5일 · UTC 짝수시 12칸): 각 칸이 **3~5일만** 채워졌다. 특정 시간대가
 * 통째로 빈 게 아니라 **무작위로 1/4이 빈다** ⇒ 외부 API 시간 제한이 아니라 알람 유실이다.
 * 유실되면 부트가 재무장하지만 **홀수시에 착지해 그냥 skip** → 그 회차(~990건)가 영영 사라졌다.
 *
 * ## 못 막는 것
 * - 알람 유실 자체(런타임 특성) — 이 변경은 **유실을 복구 가능하게** 만들 뿐 없애지 않는다.
 * - DO storage 왕복이 실제로 도는지 — 배선 앵커로 소스만 확인한다.
 */
const H = 3_600_000

describe('⏳ 경과 시간 판정', () => {
  it('첫 실행(기록 없음)은 막지 않는다 — 막으면 배포 직후 그 레인이 N시간 굶는다', () => {
    expect(dueByElapsed(null, 1_000_000, 2)).toBe(true)
    expect(dueByElapsed(undefined, 1_000_000, 2)).toBe(true)
    expect(dueByElapsed(Number.NaN, 1_000_000, 2)).toBe(true)
  })

  it('간격 미지정(0)이면 항상 실행 — 기존 레인 동작 불변', () => {
    expect(dueByElapsed(1_000_000, 1_000_001, 0)).toBe(true)
  })

  it('N시간이 안 지났으면 건너뛴다', () => {
    const now = 100 * H
    expect(dueByElapsed(now - 1 * H, now, 2)).toBe(false)
  })

  it('N시간이 지났으면 실행한다', () => {
    const now = 100 * H
    expect(dueByElapsed(now - 2 * H, now, 2)).toBe(true)
    expect(dueByElapsed(now - 5 * H, now, 2)).toBe(true)
  })

  it('🔴 유실된 회차를 **다음 시간**이 이어받는다 — 이 변경의 존재 이유', () => {
    // 짝수시 HH 에서 유실 → HH+1(홀수시)에 깨어남. 짝수성 판정이면 skip 이지만 경과 판정이면 실행된다.
    const lastRun = 100 * H          // 마지막 성공 실행
    const missed = lastRun + 2 * H   // 여기서 유실
    const repaired = missed + 1 * H  // 부트가 되살려 깨어난 홀수시
    expect(dueByElapsed(lastRun, repaired, 2)).toBe(true)
  })

  it('알람 지연(수십 초)이 한 칸을 통째로 미루지 않는다', () => {
    const now = 100 * H
    expect(dueByElapsed(now - (2 * H - 3_000), now, 2)).toBe(true)   // 1분 여유 안
    expect(dueByElapsed(now - (2 * H - 120_000), now, 2)).toBe(false) // 2분 모자람 → 다음 시간에
  })
})

describe('🔌 배선 — 짝수시 게이트가 사라지고 간격 선언으로 대체됐다', () => {
  const runners = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
  const alarm = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')

  it('🔴 두 레인에 짝수시 판정이 남아 있으면 안 된다 — 남으면 유실이 그대로 영구 손실', () => {
    // ⚠️ 파일 전체를 보면 안 된다: `collect-company` 는 **홀수시로 의도적으로 엇갈려** 있고(부하 분산)
    //   이번 변경 범위가 아니다. 같은 결함을 갖지만 실측을 안 했으므로 건드리지 않았다(handoff 18차).
    for (const name of ['collect-commerce', 'collect-storeinfo']) {
      const i = runners.indexOf(`'${name}': {`)
      expect(i, name).toBeGreaterThan(0)
      expect(runners.slice(i, i + 700), name).not.toMatch(/getUTCHours\(\) % 2/)
    }
  })

  it('두 수집 레인이 2시간 간격을 선언한다(외부 호출량 상한 유지)', () => {
    for (const name of ['collect-commerce', 'collect-storeinfo']) {
      expect(ALARM_LANES[name]?.minIntervalHours, name).toBe(2)
      expect(ALARM_LANES[name]?.runsPerHour, name).toBe(1)   // 시간당 1 + 2시간 간격 = 하루 ≤12회
    }
  })

  it('DO 가 실제로 그 게이트를 건다', () => {
    // 🔄 2026-08-18: 간격이 **고정 상수에서 자가조율 값**으로 바뀌었다(`lane-adaptive-interval`).
    //   지키려던 것은 *상수 그 자체*가 아니라 **"DO 가 경과시간 게이트를 건다"** 이므로, 앵커를
    //   그 사실로 다시 쓴다(러너 안의 시각 게이트로 되돌아가면 여전히 빨간불이다).
    expect(alarm).toMatch(/dueByElapsed\(lastRunAt, t0, /)
    expect(alarm).toMatch(/lane\.minIntervalHours \?\? 0/)
    expect(alarm).toMatch(/if \(runs < cap && due\)/)
  })

  it('🔴 lastRunAt 은 실제로 돈 회차만 기록한다 — skip 에도 찍으면 간격이 영원히 안 찬다', () => {
    // 조건은 `due` 를 반드시 포함해야 한다(그게 skip 을 배제한다). 2026-08-18 에 **실패한 회차**도
    //   빼도록 조건이 늘었지만(`entry.ok`), 이 불변식이 지키는 것은 여전히 "skip 은 안 찍는다" 다.
    const line = alarm.split('\n').find(l => l.includes('put.lastRunAt = t0'))!
    expect(line).toMatch(/if \(runs < cap && due/)
    expect(line).toContain('put.lastRunAt = t0')
  })
})
