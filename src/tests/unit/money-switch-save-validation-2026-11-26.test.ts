/**
 * 💾 어드민 플랫폼 설정 — 저장 전 검사가 기본값을 막지 않는다 (2026-11-26 대표 신고 *"fee_vat_exclusive_from: 숫자 값만 허용됩니다 라는데?"*)
 *
 * 사고: 화면의 저장 전 검사는 선택지(options)가 없는 머니 스위치 칸을 전부 **숫자**로 검사했다. 날짜 칸
 * `fee_vat_exclusive_from`(기본 2027-01-01)이 들어오자 **무엇을 저장하든 페이지 저장이 통째로 막혔다**
 * (그 칸을 안 건드려도 기본값으로 검사된다). 팝빌 자격을 넣으려던 대표가 걸렸다.
 *
 * 고정: 선택지 없는 칸은 ① 기본값이 숫자이거나 ② 형식(pattern)을 갖고 그 형식이 기본값을 통과시킨다.
 *      화면이 pattern 을 숫자 검사보다 먼저 본다.
 * ⚠️ 못 보는 것: 화면 렌더·실제 저장 왕복(배선은 소스 대조로만).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { COMMISSION_BUDGET_FIELDS } from '@/pages/admin-platform-settings/money-switch-fields'

describe('머니 스위치 칸의 기본값이 저장 전 검사를 통과한다', () => {
  for (const f of COMMISSION_BUDGET_FIELDS.filter((x) => !x.options)) {
    it(`${f.key} (${f.default})`, () => {
      if (f.pattern) expect(f.pattern.re.test(f.default), `${f.key} 형식이 기본값을 막는다`).toBe(true)
      else expect(Number.isFinite(Number(f.default)), `${f.key} 는 숫자가 아닌데 pattern 이 없다 — 저장이 통째로 막힌다`).toBe(true)
    })
  }
  it('날짜 칸은 날짜·off·빈 값을 받고 엉뚱한 값은 거부한다', () => {
    const f = COMMISSION_BUDGET_FIELDS.find((x) => x.key === 'fee_vat_exclusive_from')!
    for (const ok of ['2027-01-01', 'off', 'OFF', '']) expect(f.pattern!.re.test(ok)).toBe(true)
    for (const bad of ['2027/01/01', '내년', '20270101']) expect(f.pattern!.re.test(bad)).toBe(false)
  })
  it('화면이 pattern 을 숫자 검사보다 먼저 본다', () => {
    const page = readFileSync('src/pages/AdminPlatformSettingsPage.tsx', 'utf8')
    expect(page).toMatch(/\} else if \(f\.pattern\) \{\s*\n\s*if \(!f\.pattern\.re\.test/)
  })
})
