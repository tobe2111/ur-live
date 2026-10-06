/**
 * 🔢 숫자 글꼴 = Poppins (2026-10-06 대표 확정 "숫자 글꼴은 A로")
 *
 * 숫자·쉼표·마침표·% 만 `unicode-range` 로 Poppins 에 맡기고 한글·영문은 Pretendard 그대로다.
 *
 * ⚠️ Poppins 숫자는 **비례폭**이고 `tabular-nums` 도 안 먹는다(Chromium 실측 700:
 *   기본 "1111" 150px / "0000" 261px, tnum 켜도 동일). 그래서 계속 바뀌는 숫자(`tabular-nums`·`.dash-num`)는
 *   Pretendard 로 되돌린다 — 이 되돌림이 빠지면 2026-09-23 에 고친 '초마다 떨리는 시계'가 돌아온다.
 *   (같은 CSS 를 브라우저에 띄워 확인: 본문 1111 60px ≠ 0000 104px · tabular-nums 둘 다 111px.)
 *
 * 지키는 것: ① 다섯 굵기 @font-face 가 숫자 범위로만 선언되고 파일이 실제로 있다 ② 본문·`font-sans` 스택 맨 앞이
 *   UrDigits ③ `tabular-nums`·`.dash-num` 스택에는 UrDigits 가 없다 ④ `.dash-num` 이 더는 터미널 글꼴이 아니다.
 * ⚠️ 못 하는 것: 실제 렌더 폭(jsdom 은 레이아웃이 없다) — 위 실측이 근거다.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = stripComments(readFileSync('src/index.css', 'utf-8'))
const TW = stripComments(readFileSync('tailwind.config.js', 'utf-8'))
const WEIGHTS = [400, 500, 600, 700, 800]

describe('숫자 글꼴 Poppins', () => {
  it('① 다섯 굵기가 숫자 범위로만 선언되고 파일이 있다', () => {
    for (const w of WEIGHTS) {
      const re = new RegExp(`@font-face \\{ font-family: 'UrDigits';[^}]*font-weight: ${w};[^}]*url\\('/static/fonts/poppins-digits-${w}\\.woff2'\\)[^}]*unicode-range: U\\+0025, U\\+002C, U\\+002E, U\\+0030-0039; \\}`)
      expect(CSS, `weight ${w}`).toMatch(re)
      expect(existsSync(`public/static/fonts/poppins-digits-${w}.woff2`), `file ${w}`).toBe(true)
    }
  })
  it('② 본문과 font-sans 스택 맨 앞이 UrDigits', () => {
    expect(CSS).toMatch(/body \{[^}]*font-family:\s*"UrDigits",\s*"Pretendard Variable"/)
    expect(TW).toMatch(/sans: \['UrDigits', 'Pretendard Variable'/)
  })
  it('③ 계속 바뀌는 숫자는 Pretendard 로 되돌린다(UrDigits 없음)', () => {
    const m = CSS.match(/\.tabular-nums, \.dash-num \{ font-family: ([^;]+);/)
    expect(m).not.toBeNull()
    expect(m![1]).not.toContain('UrDigits')
    expect(m![1]).toContain('Pretendard Variable')
  })
  it('④ .dash-num 은 터미널 고정폭이 아니라 고정폭 숫자다', () => {
    const m = CSS.match(/\.dash-num \{[^}]*\}/g) || []
    expect(m.join(' ')).toContain('tabular-nums')
    expect(m.join(' ')).not.toMatch(/monospace|ui-monospace|Menlo/)
  })
})
