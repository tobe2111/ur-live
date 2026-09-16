/**
 * ⏰ **시각 고정 금지** — 하루 1회 레인은 "몇 시에"가 아니라 "하루 한 번"으로 선언한다.
 *
 * ## 실사고 (2026-09-05)
 * 읽기 예산 차단기가 하루 창을 3시간(00~02시 UTC)으로 줄이자, 자기 시각이 그 밖에 박힌 레인
 * 9개가 **영영 안 돌게** 됐다. 하트비트는 매번 `skipped: "off_hour"` 였고 에러도 경보도 없었다.
 * ```
 *   B2B 신규 수집   8/25~9/01 하루 4,800~7,200건  →  9/04 78건 · 9/05 122건
 *   죽은 레인: nara-vendor(15) nps(16) sweep-mx(17) daily-batch(18) sweep-nts(19)
 *             localdata(20) franchise(22) nara-contract(23) maintenance-rescan(상수)
 * ```
 * 원인은 예산이 아니라 **표현**이다. `lane-alarm.ts` 는 이미 `dueByElapsed`(경과 시간)를 갖고
 * 있고 그 주석이 *"유실된 회차를 다음 시간이 이어받게 하는 것이 요점"* 이라고 적어 뒀는데,
 * 시각 고정이 정확히 그 원칙을 깨고 있었다.
 *
 * ## 이 시험이 지키는 것
 *   ① 그 9개 레인에 `getUTCHours() !== N` 이 다시 들어오지 않는다
 *   ② 대신 하루 1회를 **경과 시간**으로 선언한다(`minIntervalHours: DAILY_INTERVAL_HOURS`)
 *   ③ 하루 1회는 **조여지지 않는다** — 공공 API 일일 한도를 우리가 모르기 때문
 *
 * ⚠️ **예외 하나**: `scan-notices` 는 `% 4 !== 1`(하루 6회, 01시 슬롯이 창 안)이라 살아 있고,
 *   `ads-lane-cadence-parity` 가 그 값을 cron 과 짝지어 못박고 있다. 건드리면 그 계약이 깨진다.
 *   ⇒ 이 시험의 대상이 아니다. 되살릴 일이 생기면 두 파일을 같이 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { adaptiveIntervalHours, DAILY_INTERVAL_HOURS, BARREN_INTERVAL_MULT } from '@/worker-ads/lane-adaptive-interval'
import type { LaneRunEntry } from '@/worker-ads/lane-run-history'

const SRC = 'src/worker-ads/lane-alarm-runners.ts'
const src = readFileSync(SRC, 'utf8')

/** 시각 고정에서 풀린 레인들 — 실사고 당사자 전원. */
const FREED = [
  'maintenance-rescan', 'collect-localdata-chain', 'collect-nps', 'daily-batch',
  'sweep-nts', 'collect-nara-contract', 'collect-nara-vendor', 'sweep-mx', 'collect-franchise',
] as const

/** 한 레인의 등록 블록만 잘라 본다(다음 레인 키 전까지). */
function laneBlock(lane: string): string {
  const i = src.indexOf(`  '${lane}': {`)
  expect(i, `${lane} 이 알람 등록부에서 사라졌다`).toBeGreaterThan(-1)
  const j = src.indexOf("\n  '", i + 5)
  return src.slice(i, j === -1 ? src.length : j)
}

describe('하루 1회 레인 — 시각을 고정하지 않는다', () => {
  it.each(FREED)('① %s 에 시각 고정이 없다', (lane) => {
    expect(laneBlock(lane), `${lane}: 시각을 고정하면 그 시각에 창이 닫혀 있을 때 영영 안 돈다`)
      .not.toMatch(/getUTCHours\(\)\s*!==/)
  })

  it.each(FREED)('② %s 가 하루 1회를 경과 시간으로 선언한다', (lane) => {
    expect(laneBlock(lane), `${lane}: 간격 선언이 없으면 매시간 돌아 외부 API 한도를 태운다`)
      .toMatch(/minIntervalHours:\s*DAILY_INTERVAL_HOURS\b/)
  })

  /**
   * ③ **남은 시각 게이트는 전부 "도달 가능"해야 한다.**
   *
   * 개수를 세는 검사는 약하다 — 게이트가 하나든 둘이든, 물어야 할 것은 *"그 레인이 언제든
   * 돌 수 있는가"* 다. 실사고의 본질이 정확히 그것이었다(게이트는 멀쩡했고, 그 시각에
   * 아무도 안 깨어났을 뿐이다).
   *
   * 판정 기준은 **최악의 창**: 읽기 예산이 소진되면 하루 중 00~02시 UTC 만 남는다(2026-09-05
   * 실측). 그 3시간 안에 만족되는 게이트만 통과시킨다. 예산을 올리면 창은 넓어지므로 이 기준은
   * 늘 보수적인 쪽이다 — 여기서 통과하면 어떤 창에서도 돈다.
   */
  it('③ 남은 시각 게이트가 전부 최악의 창(00~02시 UTC) 안에서 만족된다', () => {
    const WINDOW = [0, 1, 2]
    const gates = src.match(/getUTCHours\(\)\s*(?:!==\s*\d+|%\s*\d+\s*!==\s*\d+)/g) || []
    expect(gates.length, '게이트를 하나도 못 찾았다 — 정규식이 낡았다(0건 통과 방지)').toBeGreaterThan(0)
    const unreachable = gates.filter(g => {
      const mod = /%\s*(\d+)\s*!==\s*(\d+)/.exec(g)
      if (mod) return !WINDOW.some(h => h % Number(mod[1]) === Number(mod[2]))
      const pin = /!==\s*(\d+)/.exec(g)
      return pin ? !WINDOW.includes(Number(pin[1])) : false
    })
    expect(unreachable, `창이 좁아지면 영영 안 도는 레인이 생긴다:\n${unreachable.join('\n')}`).toEqual([])
  })
})

describe('하루 1회는 조여지지 않는다 — 공공 API 일일 한도', () => {
  /** 조이기 조건을 **전부 만족하는** 이력(깨끗한 연속 + 높은 신규율) — 그래도 24는 그대로여야 한다. */
  const tightenable: LaneRunEntry[] = Array.from({ length: 8 }, () => ({ t: 'x', ok: true, n: 90, f: 100 }))

  it('④ 조이기 조건을 다 만족해도 24시간은 24시간이다', () => {
    expect(adaptiveIntervalHours(DAILY_INTERVAL_HOURS, tightenable)).toBe(DAILY_INTERVAL_HOURS)
  })

  it('⑤ 그보다 짧은 주기는 종전대로 조여진다 (완화가 전면적이면 안 된다)', () => {
    expect(adaptiveIntervalHours(4, tightenable)).toBe(2)
  })

  it('⑥ 늦추기(마름)는 하루 1회에도 그대로 적용된다', () => {
    const barren: LaneRunEntry[] = Array.from({ length: 8 }, () => ({ t: 'x', ok: true, n: 0, f: 100 }))
    expect(adaptiveIntervalHours(DAILY_INTERVAL_HOURS, barren)).toBe(DAILY_INTERVAL_HOURS * BARREN_INTERVAL_MULT)
  })
})
