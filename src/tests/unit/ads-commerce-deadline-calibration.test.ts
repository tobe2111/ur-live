/**
 * ⏱️ **마감선 보정이 낡는 것을 막는다** — 2026-08-09.
 *
 * ## 왜 이 파일이 있나
 * `collect-commerce` 의 벽시계 마감선은 **CPU 한도의 대리 측정**이다(워커는 CPU 시간을 안 준다).
 * 대리값이라 **사망점이 움직이면 보정이 자동으로 낡는다** — 그리고 실제로 그렇게 됐다:
 *
 * ```
 * 소스 주석이 12초를 고른 근거 :  "죽는 지점(26초)의 절반 이하"
 * 2026-08-08 21:00 KST 마지막 성공 : elapsed 13,935ms  (deadline·records 동시 도달)
 * 2026-08-08 23:00 KST 사망        : ms 13,921ms  err=Worker exceeded CPU time limit
 * ```
 *
 * 사망점이 26초 → **13.9초**로 내려오면서 12초 마감선은 사망점의 **87%** 가 됐다. 여유가 사실상 0 이라
 * 한 회차만 무거워도 넘어간다. 같은 틱에 `collect-storeinfo`(13,833ms)·`collect-hira`(21,067ms) 도
 * 같은 사유로 죽었다 — 셋 다 B2B 다.
 *
 * ## 이 테스트가 지키는 불변식
 * **마감선 ≤ 관측된 최저 사망점의 1/2.** 소스 주석이 처음부터 내세운 기준을 *숫자로* 고정한다.
 * 주석에만 적어 두면 다음 세션이 "느리니까 올리자"로 되돌린다(이번에 낡은 것도 주석이었다).
 *
 * ## ⚠️ 이 테스트가 **못** 막는 것
 *  · 사망점 자체가 또 내려가는 것 — 그건 코드가 아니라 라이브 하트비트에만 나타난다.
 *    `OBSERVED_DEATH_MS` 는 **손으로 갱신하는 관측치**다. 새 사망을 보면 여기부터 고칠 것.
 *  · CPU 밀도가 낮은 레인까지 같은 기준을 강요하지 않는다(예: `collect-neis` 는 24.2초에도 살아남았다).
 *    마감선은 **레인마다** 다른 값이어야 한다 — 공용 상수로 묶지 말 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'src/features/marketing/api/commerce-notify-collect.ts'), 'utf8')

/** 라이브 하트비트에서 관측된 최저 CPU 사망 시각(ms). 새 사망을 보면 갱신한다. */
const OBSERVED_DEATH_MS = 13_921

const num = (name: string): number => {
  const m = SRC.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9_]+)`))
  expect(m, `${name} 상수를 못 찾았다 — 이름이 바뀌었으면 이 테스트도 함께 고칠 것`).toBeTruthy()
  return Number(m![1].replace(/_/g, ''))
}

describe('collect-commerce 마감선 보정', () => {
  it('🔒 무료 마감선은 관측된 사망점의 절반 이하 — 대리 측정이라 여유가 필요하다', () => {
    const deadline = num('RUN_DEADLINE_MS')
    expect(deadline).toBeLessThanOrEqual(Math.floor(OBSERVED_DEATH_MS / 2))
  })

  it('🔒 레코드 상한도 함께 내려온다 — 응답이 빨라 마감선에 안 걸려도 파싱이 CPU 를 먹는다', () => {
    // 사망 직전 회차가 1,499건을 훑고 죽었다 ⇒ 상한은 그 절반 이하여야 같은 회차를 못 만든다.
    expect(num('MAX_RECORDS_PER_RUN')).toBeLessThanOrEqual(750)
  })

  it('🔒 유료 마감선은 무료보다 크되 유료 CPU 한도(30초) 아래 — 전환 시 코드 변경 0', () => {
    const free = num('RUN_DEADLINE_MS')
    const paid = num('RUN_DEADLINE_MS_PAID')
    expect(paid).toBeGreaterThan(free)
    expect(paid).toBeLessThan(30_000)
  })

  it('🔒 마감선에서 끊고 **커서를 남긴다** — 죽으면 커서 저장이 안 돌아 다음 회차가 같은 페이지를 또 훑는다', () => {
    // 이게 이 레인의 진짜 실패 모드다(사망 = 그 회차 전진 0). 끊는 분기가 사라지면 그 상태로 돌아간다.
    expect(SRC).toMatch(/stoppedBy\s*=\s*'deadline'/)
    expect(SRC).toMatch(/stoppedBy\s*=\s*'records'/)
  })
})
