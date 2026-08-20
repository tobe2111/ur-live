import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  summarizeLane, reportLines, summarizeLaneHealth,
  REPORT_FAIL_RATIO, REPORT_MAX_LINES,
} from '@/features/marketing/api/lane-health-report'

/**
 * 🩺 **레인 건강 요약** — 경보가 "줄었다"만 말하면 받는 사람에게 숙제를 넘기는 것이다.
 *
 * ## 못 막는 것
 * - 임계(34%)가 적절한지 — 라이브 오경보 빈도로만 안다.
 * - 이력 자체가 없는 레인(알람 미이관)은 여기 안 잡힌다.
 */
const hist = (arr: Array<{ ok: boolean; n?: number; e?: string }>) =>
  JSON.stringify(arr.map((h, i) => ({ t: `2026-08-19T0${i % 10}:00`, ok: h.ok, n: h.n ?? 0, ...(h.e ? { e: h.e } : {}) })))

describe('summarizeLane', () => {
  it('🩸 라이브 형상(commerce 12회 중 9회 실패)을 그대로 요약한다', () => {
    const raw = hist([...Array(9).fill({ ok: false, e: '등록현황: 네트워크 오류' }), ...Array(3).fill({ ok: true, n: 673 })])
    const h = summarizeLane('collect-commerce', raw)!
    expect(h).toMatchObject({ runs: 12, fails: 9, saved: 2019, barren: false })
    expect(h.err).toContain('네트워크 오류')
  })

  it('🔒 소진(성공하는데 수확 0)은 실패와 구분한다 — 처방이 정반대다', () => {
    const h = summarizeLane('collect-storeinfo', hist(Array(12).fill({ ok: true, n: 0 })))!
    expect(h).toMatchObject({ fails: 0, saved: 0, barren: true })
  })

  it('깨진 값·빈 이력에 죽지 않는다', () => {
    expect(summarizeLane('x', 'not json')).toBeNull()
    expect(summarizeLane('x', '[]')).toBeNull()
    expect(summarizeLane('x', null)).toBeNull()
    expect(summarizeLane('x', '{"a":1}')).toBeNull()
  })
})

describe('reportLines — 읽히는 경보', () => {
  const mk = (lane: string, fails: number, runs = 12, err = '오류') =>
    summarizeLane(lane, hist([...Array(fails).fill({ ok: false, e: err }), ...Array(runs - fails).fill({ ok: true, n: 10 })]))!

  it('실패율 높은 순으로, 최대 줄 수를 넘지 않는다', () => {
    const all = ['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => mk(n, 12 - i))
    const out = reportLines(all)
    expect(out).toHaveLength(REPORT_MAX_LINES)
    expect(out[0]).toContain('`a`')
  })

  it('🔒 소진 레인은 안 싣는다 — 손해가 아니라 완료다(매일 알릴 일이 아니다)', () => {
    const barren = summarizeLane('collect-storeinfo', hist(Array(12).fill({ ok: true, n: 0 })))!
    expect(reportLines([barren])).toEqual([])
  })

  it('🔒 가끔 실패는 안 싣는다 — 임계 아래는 정상 변동이다', () => {
    expect(reportLines([mk('ok-lane', Math.floor(12 * REPORT_FAIL_RATIO) - 1)])).toEqual([])
  })

  it('사유가 없어도 줄은 만든다(레인 이름만이라도 알려야 한다)', () => {
    const h = summarizeLane('x', hist([...Array(9).fill({ ok: false }), ...Array(3).fill({ ok: true, n: 1 })]))!
    expect(reportLines([h])[0]).toContain('사유 미기록')
  })
})

describe('summarizeLaneHealth — 관측이 경보를 막지 않는다', () => {
  it('쿼리가 실패해도 빈 배열', async () => {
    const failDB = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('x') } }) }) } as unknown as D1Database
    expect(await summarizeLaneHealth(failDB)).toEqual([])
  })
  it('이력 행을 레인 이름으로 푼다', async () => {
    const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ key: 'ads_lane_runs:collect-hira', value: hist([{ ok: false, e: 'timeout' }]) }] }) }) }) } as unknown as D1Database
    const r = await summarizeLaneHealth(db)
    expect(r[0].lane).toBe('collect-hira')
  })
})

describe('🔌 배선 — 경보에 실제로 실린다', () => {
  const src = readFileSync('src/features/marketing/api/inflow-watchdog.ts', 'utf8')
  it('유입 경보가 레인 상태를 덧붙인다', () => {
    expect(src).toContain('summarizeLaneHealth')
    expect(src).toContain("lines.push('', '**레인 상태**', ...bad)")
  })
  it('🔒 실패한 레인이 있을 때만 붙인다 — 정상일 때 한 줄도 안 늘어난다', () => {
    // ⚠️ **그 줄 자체**가 가드를 갖고 있는지 본다. 파일 어딘가에 `if (...)` 가 있는지만 보면
    //   조건을 지워도 통과한다(2026-08-19 주입으로 확인 — 이 세션 세 번째 헛도는 가드였다).
    const line = src.split('\n').find(l => l.includes("'**레인 상태**'"))!
    expect(line.trimStart()).toMatch(/^if \(bad\.length\) lines\.push\(/)
  })
  it('🔒 유입 경보가 없는 날엔 조회조차 안 한다(하루 1회라도 헛일은 헛일이다)', () => {
    const i = src.indexOf('summarizeLaneHealth')
    expect(src.slice(0, i)).toMatch(/if \(lines\.length\) \{\s*\n\s*try \{/)
  })
  it('🔒 관측 실패가 경보를 막지 않는다', () => {
    const block = src.slice(src.indexOf('summarizeLaneHealth'), src.indexOf('const webhook'))
    expect(block).toContain('catch { /* 관측 실패가 경보를 막지 않는다 */ }')
  })
})
