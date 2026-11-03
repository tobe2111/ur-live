/**
 * 🔢 2026-11-03 대표 *"사업자등록번호를 입력할 때는 자동으로 000-00-00000 으로 -바가 자동으로 나오게 해줘.
 *   유어딜에 사업자등록번호를 입력하는 모든 란에."*
 *
 * 지키는 것: 사업자등록번호를 받는 `<input>` 은 onChange 에서 **하이픈 자동 포맷터**를 거친다
 *   (`formatBizNo`(utils/format-kr) · `formatBusinessNumber`(seller-register) · 셀러 사업자 정보의 `handleChange` 분기).
 *   새 입력란이 생겨도 `value={bno | bizNo | business_number…}` 인 `<input>` 이면 이 시험이 잡는다.
 * ⚠️ 못 보는 것: 값 이름이 전혀 다른 입력란(예: `value={code}` 에 사업자번호를 받는 경우) · 화면에 실제로 찍히는 모양.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { formatBizNo } from '@/utils/format-kr'

const files = execSync("git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter((f) => f && !/\/tests?\/|design-variants/.test(f))

const VALUE = /value=\{\s*(?:bno|bizNo|businessNumber|(?:form|formData|f|draft)\.business_number)\s*\}/
const FORMATTED = /formatBizNo\(|formatBusinessNumber\(/
/** 포맷이 부모에서 일어나는 자리 — 왜 괜찮은지 값으로 적는다. */
const DELEGATED: Record<string, string> = {
  'src/pages/seller-business-info/BusinessInfoForm.tsx': '부모 SellerBusinessInfoPage.handleChange 의 business_number 분기가 하이픈을 넣는다',
}

describe('사업자등록번호 입력란은 전부 000-00-00000 자동 하이픈', () => {
  it('포맷터 자체', () => {
    expect(formatBizNo('1234567890')).toBe('123-45-67890')
    expect(formatBizNo('12345')).toBe('123-45')
    expect(formatBizNo('123-45-67890999')).toBe('123-45-67890')
  })
  it('사업자번호를 값으로 받는 <input> 은 onChange 에서 포맷터를 거친다', () => {
    const bad: string[] = []
    let seen = 0
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n')
      lines.forEach((l, i) => {
        if (!VALUE.test(l)) return
        const win = lines.slice(Math.max(0, i - 6), i + 6).join('\n')
        if (!/<input\b/.test(win) || !/onChange=/.test(win)) return
        if (/readOnly|disabled\b(?!=)/.test(win) && !/onChange=/.test(win)) return
        seen++
        if (FORMATTED.test(win) || DELEGATED[f]) return
        bad.push(`${f}:${i + 1}`)
      })
    }
    expect(bad, `하이픈 자동 포맷이 빠진 사업자번호 입력란:\n${bad.join('\n')}`).toEqual([])
    expect(seen, '입력란을 거의 못 찾았다 — 이름 규칙이 낡았다').toBeGreaterThanOrEqual(6)
  })
  it('셀러 사업자 정보 분기는 살아 있다', () => {
    expect(readFileSync('src/pages/SellerBusinessInfoPage.tsx', 'utf8')).toMatch(/name === 'business_number'[\s\S]{0,400}slice\(5, 10\)/)
  })
})
