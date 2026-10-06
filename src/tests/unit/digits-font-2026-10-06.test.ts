/**
 * 🔢 숫자 글꼴 = Roboto (2026-10-06 대표 확정 — 대기업 숫자 글꼴 비교 보드에서 "Google · Roboto 이게 낫네")
 *
 * 숫자·쉼표·마침표·% 만 `unicode-range` 로 Roboto 에 맡기고 한글·영문은 Pretendard 그대로다.
 *
 * 같은 날 먼저 고른 Poppins 는 숫자가 **비례폭이고 `tabular-nums` 도 안 먹었다**(Chromium 실측 700·100px:
 * "1111" 150 / "0000" 261, tnum 켜도 동일) — 그래서 계속 바뀌는 숫자만 Pretendard 로 되돌리는 예외 규칙이
 * 필요했다. Roboto 는 숫자가 **처음부터 모두 같은 폭**이다(같은 측정: 230 / 230, tnum 무관) ⇒ 예외 없이 전부 Roboto.
 *
 * 지키는 것: ① 다섯 굵기 @font-face 가 숫자 범위로만 선언되고 파일이 실제로 있다 ② 본문·`font-sans` 스택 맨 앞이
 *   UrDigits ③ `tabular-nums`·`.dash-num` 에 글꼴을 따로 박지 않는다(박으면 그 자리만 Roboto 를 빠져나간다)
 *   ④ `.dash-num` 이 터미널 고정폭 글꼴이 아니다 ⑤ 옛 Poppins 파일 참조가 남지 않는다.
 * ⚠️ 못 하는 것: 실제 렌더 폭(jsdom 은 레이아웃이 없다) — 위 실측이 근거다.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = stripComments(readFileSync('src/index.css', 'utf-8'))
const TW = stripComments(readFileSync('tailwind.config.js', 'utf-8'))
const WEIGHTS = [400, 500, 600, 700, 800]

describe('숫자 글꼴 Roboto', () => {
  it('① 다섯 굵기가 숫자 범위로만 선언되고 파일이 있다', () => {
    for (const w of WEIGHTS) {
      const re = new RegExp(`@font-face \\{ font-family: 'UrDigits';[^}]*font-weight: ${w};[^}]*url\\('/static/fonts/roboto-digits-${w}\\.woff2'\\)[^}]*unicode-range: U\\+0025, U\\+002C, U\\+002E, U\\+0030-0039; \\}`)
      expect(CSS, `weight ${w}`).toMatch(re)
      expect(existsSync(`public/static/fonts/roboto-digits-${w}.woff2`), `file ${w}`).toBe(true)
    }
  })
  it('② 본문과 font-sans 스택 맨 앞이 UrDigits', () => {
    expect(CSS).toMatch(/body \{[^}]*font-family:\s*"UrDigits",\s*"Pretendard Variable"/)
    expect(TW).toMatch(/sans: \['UrDigits', 'Pretendard Variable'/)
  })
  it('③ tabular-nums · .dash-num 에 글꼴을 따로 박지 않는다', () => {
    const rules = CSS.match(/[^{}]*\.(?:tabular-nums|dash-num)[^{}]*\{[^}]*\}/g) || []
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) expect(r, r).not.toMatch(/font-family/)
  })
  it('④ .dash-num 은 터미널 고정폭이 아니라 고정폭 숫자다', () => {
    const m = (CSS.match(/\.dash-num \{[^}]*\}/g) || []).join(' ')
    expect(m).toContain('tabular-nums')
    expect(m).not.toMatch(/monospace|ui-monospace|Menlo/)
  })
  it('⑤ 옛 Poppins 숫자 파일 참조가 없다', () => {
    expect(CSS).not.toMatch(/poppins-digits/)
    expect(existsSync('public/static/fonts/poppins-digits-700.woff2')).toBe(false)
  })
})
