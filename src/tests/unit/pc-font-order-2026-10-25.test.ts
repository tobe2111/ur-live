/**
 * 🔤 PC 글꼴 순서 (2026-10-25 대표 *"PC는 글자가 너무 별로인데"* → 안 A · *"네 뜻대로 하자"* = PC 만).
 * 지키는 것: ① 1024px+ 에서만 한글 글꼴이 라틴 시스템 글꼴보다 앞 ② 숫자는 여전히 UrDigits 맨 앞
 *   ③ 기본 목록은 애플 키워드 → 한글 → system-ui (폰 픽셀 불변, 좁은 창 윈도우도 한글 글꼴) ④ 받는 글꼴 0(url 없음).
 * ⚠️ 못 하는 것: 실제 렌더(jsdom 은 글꼴을 그리지 않는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = stripComments(readFileSync('src/index.css', 'utf-8'))
const PC = CSS.match(/@media \(min-width: 1024px\) \{\s*body \{\s*font-family:([^;]+);/)
const pcList = (PC?.[1] ?? '').split(',').map(s => s.trim().replace(/"/g, ''))

describe('PC 글꼴 순서', () => {
  it('① PC 블록이 있고 한글 글꼴이 system-ui 보다 앞', () => {
    expect(PC, 'PC 블록').toBeTruthy()
    const ko = Math.max(pcList.indexOf('Apple SD Gothic Neo'), pcList.indexOf('Malgun Gothic'))
    expect(ko).toBeGreaterThan(0)
    expect(ko).toBeLessThan(pcList.indexOf('system-ui'))
    expect(pcList).not.toContain('Roboto')
    expect(pcList).not.toContain('Segoe UI')
  })
  it('② 숫자는 UrDigits 맨 앞', () => { expect(pcList[0]).toBe('UrDigits') })
  it('③ 기본 목록: 애플 키워드 다음 바로 한글 글꼴, 그 뒤 system-ui (2026-10-26 — 창 폭 1024 미만 윈도우도 한글 글꼴)', () => {
    // 애플 기기는 -apple-system/BlinkMacSystemFont 가 먼저 잡혀 픽셀 그대로, 안드로이드엔 Noto Sans KR·맑은 고딕 이름이 없어 system-ui 로.
    expect(CSS).toMatch(/body \{[^}]*font-family:\s*"UrDigits",\s*-apple-system,\s*BlinkMacSystemFont,\s*"Noto Sans KR",\s*"Malgun Gothic",\s*system-ui,/)
  })
  it('③-2 tailwind sans · index.html 도 같은 순서', () => {
    expect(readFileSync('tailwind.config.js', 'utf-8')).toContain("'-apple-system', 'BlinkMacSystemFont', 'Noto Sans KR', 'Malgun Gothic', 'system-ui'")
    expect(readFileSync('index.html', 'utf-8')).toContain("font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR','Malgun Gothic',system-ui")
  })
  it('⑤ Noto Sans KR 이 맑은 고딕보다 앞 (쿠팡이 같은 PC 에서 Noto 로 그린다)', () => {
    expect(pcList.indexOf('Noto Sans KR')).toBeGreaterThan(0)
    expect(pcList.indexOf('Noto Sans KR')).toBeLessThan(pcList.indexOf('Malgun Gothic'))
  })
  it('④ PC 블록은 글꼴을 받지 않는다', () => { expect(PC?.[0] ?? '').not.toMatch(/url\(/) })
})
