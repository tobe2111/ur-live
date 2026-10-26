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
import { existsSync, readFileSync, statSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = stripComments(readFileSync('src/index.css', 'utf-8'))
const TW = stripComments(readFileSync('tailwind.config.js', 'utf-8'))
const WEIGHTS = [400, 500, 600, 700, 800]

describe('숫자 글꼴 Roboto', () => {
  it('① 다섯 굵기가 숫자 범위로만 선언되고 파일이 있다', () => {
    for (const w of WEIGHTS) {
      const re = new RegExp(`@font-face \\{ font-family: 'UrDigits';[^}]*font-weight: ${w};[^}]*url\\('/static/fonts/roboto-digits-v2-${w}\\.woff2'\\)[^}]*unicode-range: U\\+0025, U\\+002C, U\\+002E, U\\+0030-0039; \\}`)
      expect(CSS, `weight ${w}`).toMatch(re)
      expect(existsSync(`public/static/fonts/roboto-digits-v2-${w}.woff2`), `file ${w}`).toBe(true)
    }
  })
  it('② 본문과 font-sans 스택 맨 앞이 UrDigits', () => {
    // 2026-10-15: 그 뒤는 기기 기본 글꼴(쿠팡·네이버처럼 — Pretendard 제거)
    // 기본(폰) body 규칙을 콕 집는다 — 2026-10-25 PC 미디어쿼리 body 도 UrDigits 로 시작해서, 느슨하면 그쪽에 맞아 헛돈다.
    expect(CSS).toMatch(/body \{\s*background-color[^}]*font-family:\s*"UrDigits",/)
    expect(TW).toMatch(/sans: \['UrDigits', '-apple-system'/)
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
  it('⑥ 숫자 파일은 장당 3KB 이하다 — 힌팅·분수 글리프가 되살아나지 않는다(2026-10-13)', () => {
    // 첫 화면에서 네 굵기가 최우선순위로 JS 와 회선을 나눠 쓴다. 원본(6.3KB)은 힌팅 프로그램이 대부분이었다.
    for (const w of WEIGHTS) {
      const size = statSync(`public/static/fonts/roboto-digits-v2-${w}.woff2`).size
      expect(size, `weight ${w}`).toBeGreaterThan(1000) // 비어 있으면 통과가 아니라 고장
      expect(size, `weight ${w}`).toBeLessThanOrEqual(3000)
    }
  })
  it('⑦ 옛 이름(v1) 파일·참조가 없다 — 1년 immutable 캐시라 같은 이름으로 내용을 바꾸면 안 된다', () => {
    expect(CSS).not.toMatch(/roboto-digits-\d{3}\.woff2/)
    for (const w of WEIGHTS) expect(existsSync(`public/static/fonts/roboto-digits-${w}.woff2`)).toBe(false)
  })
})
