/**
 * 🩸 **"조용한 전진 0" 가드 자신의 계약** (2026-08-03 신설).
 *
 * ## 왜 가드에 시험이 붙는가
 * 이 레포의 반복 사고는 *"검사가 실패한다"* 가 아니라 **"검사가 실패할 수 없다"** 이다.
 * 그래서 새 가드는 **스스로 깨질 수 있음**을 증명해야 한다(`check-guard-mutations` 가 CI 에서 깨뜨린다).
 *
 * ## 이 가드가 막는 것
 * 커서 저장 **앞** 창에 루프가 있는데 그 루프에 시간 상한이 없으면 신고. 루프가 CPU 한도로 죽으면
 * 뒤의 커서 저장에 도달하지 못해 다음 회차가 같은 지점을 또 훑는다 ⇒ **영원히 전진 0**.
 * 실제로 두 번 났다: `commerce`(08-02) · `quality`(08-03).
 *
 * ## ⚠️ 못 보는 것
 * - 함수 경계(120줄 창 휴리스틱) · CPU 실사용량. 그래서 **래칫**이다(신규만 차단).
 * - 여기서는 스크립트를 **실행하지 않는다**(파일 시스템 전수 스캔) — 판정 로직의 존재만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'scripts/check-cursor-after-loop.mjs'), 'utf8')
const BASE = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/cursor-after-loop-baseline.json'), 'utf8'))

describe('전진 0 가드 — 판정이 실제로 존재한다', () => {
  it('🔒 **시간 상한이 있으면 통과**시키는 분기가 있다 — 없으면 전부 신고라 무의미해진다', () => {
    expect(SRC).toMatch(/if \(TIME_BOUND\.test\(body\)\) continue/)
  })

  it('🔒 시간 상한 패턴이 이 레포가 실제로 쓰는 표현을 덮는다', () => {
    const m = /const TIME_BOUND = (\/.+\/i)/.exec(SRC)
    expect(m, 'TIME_BOUND 를 못 찾았다').toBeTruthy()
    const re = new RegExp(m![1].slice(1, -2), 'i')
    for (const s of ['Date.now() - t0 >= deadlineMs', 'if (outOfBudget(budget))', 'if (shouldStop())', 'elapsed_ms']) {
      expect(re.test(s), `이 레포가 쓰는 표현을 못 알아본다: ${s}`).toBe(true)
    }
  })

  it('🔒 **측정 0 = 실패** — 경로가 낡아 대상이 비면 통과가 아니라 종료 1', () => {
    expect(SRC).toMatch(/files\.length < 10[\s\S]{0,200}process\.exit\(1\)/)
  })

  it('🔒 래칫이다 — 기준선을 읽고 **신규만** 막는다(기존 정리를 강요하지 않는다)', () => {
    expect(SRC).toMatch(/const added = ids\.filter\(x => !base\.includes\(x\)\)/)
    expect(Array.isArray(BASE.known)).toBe(true)
    expect(BASE.known.length, '기준선이 비면 이 가드는 아무것도 안 지키고 있는 것이다').toBeGreaterThan(0)
  })

  it('🔒 이번에 고친 두 레인은 기준선에 **없다** — 있으면 수리가 안 된 것이다', () => {
    expect(BASE.known.some((x: string) => x.includes('influencer-quality')), 'quality 는 마감선을 받았다').toBe(false)
    expect(BASE.known.some((x: string) => x.includes('commerce-notify-collect')), 'commerce 는 08-02 에 마감선을 받았다').toBe(false)
  })
})
