/**
 * ⏱️ `scan-notices` 회차 비용을 시간으로 묶고, 잘린 뒤쪽이 굶지 않게 (2026-08-03)
 *
 * ## 왜
 *
 * 하트비트 실측에서 이 레인은 **31초**(상위 4위, `cpu_risk=danger`)를 썼고 침묵 목록에 있었다.
 * 그런데 예산은 `budget.left = 20` 인데 **실제 호출은 6번뿐**(입찰 1 + 키워드 5)이라
 * **예산이 한 번도 걸리지 않는다.** 이 레인의 비용은 요청 수가 아니라 **시간**인데,
 * 시간을 재는 것이 아무것도 없었다 — 공공 API 하나가 15초까지 버티므로 최악 90초다.
 *
 * ## 짝을 이루는 두 가지 — 하나만 하면 더 나빠진다
 *
 * 1. **마감선**: 회차가 예산 안에서 끝나게 한다.
 * 2. **회전 커서**: 마감선은 일을 줄이는 게 아니라 **미루는** 것이라, 커서가 없으면
 *    매 회차 같은 앞쪽만 돌고 **뒤쪽 키워드는 영원히 안 돈다**(구조적 기아).
 *    `dispatch-budget.ts` 가 레인 단위에서 겪은 그 문제를 키워드 단위에서 반복하는 셈이다.
 *
 * ## 이 테스트가 **못 막는 것**
 *
 * - 실제 소요 시간. 소스 텍스트만 본다 — 마감선 값이 타당한지는 하트비트 재측정으로만 안다.
 * - 외부 API 가 느려지는 것 자체. 마감선은 그 영향을 **가둘** 뿐 없애지 못한다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src/features/marketing/api/notice-scan.ts')
const CODE = fs.readFileSync(SRC, 'utf8')
const EXEC = CODE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n')

describe('notice-scan — 회차 비용을 시간으로 묶는다', () => {
  it('소스가 존재한다 (경로가 낡으면 통과가 아니라 실패)', () => {
    expect(fs.existsSync(SRC)).toBe(true)
    expect(EXEC.length).toBeGreaterThan(500)
  })

  it('벽시계 마감선이 키워드 루프를 끊는다', () => {
    expect(EXEC).toMatch(/const startedAt = Date\.now\(\)/)
    expect(EXEC).toMatch(/Date\.now\(\) - startedAt > runDeadlineMs/)
  })

  it('마감선이 요금제를 따른다 (유료 전환에 코드 변경 0)', () => {
    // 한도를 코드 곳곳에 박지 않는다 — dispatch-budget.ts 가 세운 규칙.
    expect(EXEC).toMatch(/envPlanValue\(undefined, RUN_DEADLINE_MS, RUN_DEADLINE_MS_PAID, env\)/)
  })

  it('왜 멈췄는지 남긴다', () => {
    // 없으면 "적게 걷혔다"가 고장인지 마감선인지 구분이 안 된다.
    expect(EXEC).toMatch(/stoppedBy = 'deadline'/)
    expect(EXEC).toMatch(/stoppedBy = 'budget'/)
    expect(EXEC).toMatch(/stoppedBy,/)
  })
})

describe('notice-scan — 잘린 뒤쪽이 굶지 않는다', () => {
  it('키워드를 회전 시작점부터 돈다', () => {
    // 고정 `for (const kw of KEYWORDS)` 로 되돌아가면 뒤쪽은 영원히 차례를 못 받는다.
    expect(EXEC).toMatch(/KEYWORDS\[\(kwFrom \+ i\) % KEYWORDS\.length\]/)
    expect(EXEC).not.toMatch(/for \(const kw of KEYWORDS\)/)
  })

  it('다음 회차 시작점을 이번에 못 본 곳으로 저장한다', () => {
    const save = EXEC.indexOf('KW_CURSOR_KEY, String((kwFrom + kwDone)')
    expect(save, '커서 저장이 없다 — 마감선만 있으면 기아가 된다').toBeGreaterThan(-1)
  })

  it('커서가 키워드 수로 나눠져 범위를 벗어나지 않는다', () => {
    expect(EXEC).toMatch(/kwFrom %= KEYWORDS\.length/)
    expect(EXEC).toMatch(/% KEYWORDS\.length\)\)\.run\(\)/)
  })
})

describe('회전 산술 — 한 바퀴 안에 모든 키워드가 반드시 나온다', () => {
  // 소스 텍스트가 아니라 **동작**을 본다: 커서 규칙이 실제로 전 키워드를 덮는가.
  const N = 5   // KEYWORDS.length
  const walk = (perRun: number, runs: number) => {
    const seen = new Set<number>()
    let from = 0
    for (let r = 0; r < runs; r++) {
      for (let i = 0; i < perRun; i++) seen.add((from + i) % N)
      from = (from + perRun) % N
    }
    return seen
  }

  it('회차당 2개씩만 돌아도 3회차 안에 전부 덮는다', () => {
    expect(walk(2, 3).size).toBe(N)
  })

  it('회차당 1개씩만 돌아도 5회차 안에 전부 덮는다 (최악)', () => {
    expect(walk(1, 5).size).toBe(N)
  })

  it('고정 시작(커서 없음)이면 뒤쪽은 영원히 안 돈다', () => {
    const seen = new Set<number>()
    for (let r = 0; r < 100; r++) for (let i = 0; i < 2; i++) seen.add(i)   // 항상 0..1
    expect(seen.size).toBe(2)   // ← 커서를 빼면 이 상태가 된다
  })
})
