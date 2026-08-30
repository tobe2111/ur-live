/**
 * 🔘 버튼 체계 불변식 (2026-08-30 신설)
 *
 * ■ 막으려는 사고
 *   1) **`border: 0` 축약형** — 이 파일을 쓰다가 실제로 만든 버그다. 축약형은
 *      border-style 까지 `none` 으로 리셋하는데, Tailwind preflight 가 모든 요소에
 *      깔아 둔 `border-style: solid` 를 지운다. 그러면 `border border-gray-200` 을
 *      붙인 테두리 버튼이 width 만 1px 이고 style 은 none 이라 **선이 조용히 사라진다.**
 *      (VoucherRedeemModal 의 '닫기' 가 그럴 뻔했다.)
 *   2) **눌림/전환 규칙 소실** — 전역 `button:not(:disabled)` 규칙이 버튼의 '느낌'
 *      전부다. 지우면 앱 전체가 다시 뻣뻣해지는데 에러는 안 난다.
 *   3) **reduced-motion 미존중** — 움직임 민감 사용자에게 스케일 애니메이션이 남는다.
 *
 * ■ 이 테스트가 못 막는 것
 *   - Tailwind 가 안 쓰이는 `.ur-btn` 을 번들에서 지우는 것(트리셰이킹)은 **소스만 봐선
 *     알 수 없다.** 그건 빌드 산출 CSS 를 봐야 하고, 아래 마지막 케이스가 dist 가 있을
 *     때만 확인한다(없으면 건너뛴다 — CI 순서에 의존하지 않기 위해).
 *   - 개별 화면이 체계를 안 쓰고 인라인으로 버튼을 그리는 것은 안 본다(아직 2,600여 곳).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const css = readFileSync(resolve(root, 'src/index.css'), 'utf-8')
const urBtn = css.match(/\.ur-btn\s*\{[\s\S]*?\}/)?.[0] ?? ''

describe('버튼 체계 (.ur-btn)', () => {
  it('.ur-btn 과 크기 3종이 정의돼 있어야 한다', () => {
    expect(urBtn, '.ur-btn 정의를 찾지 못했다').not.toBe('')
    for (const size of ['ur-btn-lg', 'ur-btn-md', 'ur-btn-sm', 'ur-btn-block']) {
      expect(css, `.${size} 가 없다`).toContain(`.${size}`)
    }
  })

  it('테두리는 축약형 `border:` 가 아니라 border-width 로만 0 이어야 한다', () => {
    // 축약형이면 border-style 이 none 이 되어 나중에 붙는 border 유틸이 무력화된다.
    expect(urBtn).not.toMatch(/(^|[\s;{])border\s*:/)
    expect(urBtn).toMatch(/border-width\s*:\s*0/)
  })

  it('전역 버튼 눌림/전환 규칙이 살아 있어야 한다', () => {
    expect(css).toMatch(/button:not\(:disabled\)/)
    expect(css).toMatch(/transition-duration:\s*160ms/)
    expect(css).toMatch(/scale\(0?\.9\d+\)/)
  })

  it('reduced-motion 에서 전환과 변형을 꺼야 한다', () => {
    const mq = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\s{4}\}/)?.[0] ?? css
    expect(mq).toMatch(/prefers-reduced-motion/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]{0,400}transform:\s*none/)
  })

  it('빌드 산출 CSS 에 .ur-btn-lg 가 실려야 한다 (Tailwind 트리셰이킹 방어)', () => {
    const dir = resolve(root, 'dist/client/assets')
    if (!existsSync(dir)) return // 빌드 전이면 판정하지 않는다(CI 순서 비의존).
    const f = readdirSync(dir).find((n) => /^index-.*\.css$/.test(n))
    if (!f) return
    const built = readFileSync(resolve(dir, f), 'utf-8')
    expect(built, '빌드 CSS 에 .ur-btn-lg 가 없다 — 실사용처가 사라져 통째로 지워졌다').toContain('.ur-btn-lg{')
  })
})
