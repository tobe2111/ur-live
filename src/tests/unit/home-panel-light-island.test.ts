/**
 * 🏝️ 홈 패널 = 라이트 섬 (2026-09-02 대표 확정 "안A · 다크에서도 패널은 흰색")
 *
 * 라이트 PC 홈은 잉크 색면 위 흰 패널(그루폰식)인데, 다크에서 패널이 색면과 거의 같은 남색(#11141C on #16181C)이 되어
 * 층이 사라졌다(대표 "흰색이 없네?"). 패널은 테마와 무관하게 흰색이어야 하고, 그 안의 `dark:` 유틸은 꺼져야 한다.
 * 손으로 `dark:` 를 빼는 대신 tailwind darkMode variant 에 `.light-island` 예외를 둔다 — 섬 밖 출력은 byte-동일.
 * 못 막는 것: 실제 렌더 색 — `node scripts/visual-preview.mjs --route=/ --pc --deals --dark` 로 본다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('darkMode variant 가 light-island 를 예외로 둔다', () => {
  /**
   * ⚠️ 2026-09-02 정정: 원래 이 검사는 variant **문자열 전체**를 정규식으로 못박고 있었다. 그래서
   *   같은 날 라이트 고정 대시보드(`.seller-light-theme` 등)를 같은 자리에 **추가**하자 — 이 섬의
   *   계약은 그대로인데 — 빨간불이 났다. 계약("섬 안에서는 dark: 가 꺼진다")만 검사하고
   *   목록에 형제가 늘어나는 것은 허용한다. 형제들은 각자의 테스트가 지킨다.
   */
  it('tailwind.config: .dark 스코프 + light-island 예외', () => {
    const tw = code(read('tailwind.config.js'))
    const variant = (tw.match(/darkMode:\s*\[[^\]]*\]/) || [''])[0]
    expect(variant).toContain("'variant'")
    expect(variant).toContain('&:is(.dark *)')
    expect(variant).toContain(':not(.light-island *)')
  })
  it('index.css 에 .light-island 정의가 있고, 다크 패널 남색 규칙은 없다', () => {
    const css = code(read('src/index.css'))
    expect(css).toMatch(/\.light-island\s*\{[^}]*color-scheme:\s*light/)
    expect(css).not.toMatch(/\.dark \.ur-home-panel\s*\{/)
  })
})

describe('홈 패널 3곳이 전부 섬이다', () => {
  it('ur-home-panel 은 항상 light-island 와 같이 쓴다', () => {
    for (const f of ['src/components/home/HomeSections.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const s = code(read(f))
      const all = s.match(/className="ur-home-panel[^"]*"/g) || []
      expect(all.length, `${f}: 패널이 없다`).toBeGreaterThan(0)
      for (const m of all) expect(m, `${f}: ${m}`).toMatch(/light-island/)
    }
  })
})
