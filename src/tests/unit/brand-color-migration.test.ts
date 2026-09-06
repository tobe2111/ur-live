/**
 * 🎨 구 브랜드 로즈(pink)는 브랜드 토큰으로만 남는다 (2026-09-03)
 *
 * ■ 왜 — 브랜드 강조가 화면에서 **조용히 사라져 있었다**
 *   2026-06-19 대표 지시("아예 흑백, 기능 빨강만 유지")로 `tailwind.config.js` 가 장식 색조를
 *   전부 잉크 스케일(MONO)로 중화한다. `pink` 도 그 목록에 있다. 그런데 이 레포에서 `pink-*` 는
 *   **장식이 아니라 구 브랜드 색**이었다(2026-07-19 이전 로즈 #E0526B). 중화 뒤 주 버튼·활성
 *   상태·포커스 링·체크박스가 전부 회색이 됐고, 에러가 안 나서 아무도 몰랐다.
 *
 *   라이브 CSS 실측: `.bg-pink-500` → `rgb(110 107 104)` (회색).
 *
 * ■ 규칙
 *   브랜드 자리는 `brand` 토큰으로 쓴다 — `bg-brand` / `hover:bg-brand-dark` /
 *   `text-brand-text`(라이트·다크 자동) / `bg-brand-tint` / `border-brand` / `ring-brand/N` /
 *   `accent-brand`. `pink-*` 는 소스에 남기지 않는다.
 *
 * ■ 이 테스트가 **못** 하는 것
 *   - `rose-*` 는 보지 않는다. 이 레포에서 rose 는 대부분 **의미색**(반려·실패·연체)이고
 *     그건 `--tone-*`(status-tone) 또는 `red`(기능 빨강)로 가야 한다 — 별개 판단이다.
 *   - 어떤 자리가 '브랜드 자리'인지. 그건 사람이 안다.
 *   - 화면이 파랑 과다인지(그건 눈으로 본다).
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const files = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'public/locales/*/translation.json'", { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean)

/** `bg-pink-500` 같은 유틸 토큰만 — 주석의 '핑크' 같은 산문은 대상이 아니다. */
const PINK = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|accent|shadow|placeholder:text)-pink-\d{2,3}(?:\/\d{1,3})?\b/g

describe('구 브랜드 로즈 → 브랜드 토큰', () => {
  it('대상 파일을 실제로 찾았다 — 0건 초록이 가장 위험한 실패다', () => {
    expect(files.length).toBeGreaterThan(200)
  })

  it('소스와 다국어 문구에 pink 유틸이 남아 있지 않다', () => {
    const hits: string[] = []
    for (const f of files) {
      if (f.includes('/tests/')) continue
      const src = readFileSync(f, 'utf-8')
      for (const m of src.matchAll(PINK)) {
        hits.push(`${f}: ${m[0]}`)
      }
    }
    expect(hits, `pink 유틸이 남아 있다(회색으로 렌더된다):\n${hits.slice(0, 12).join('\n')}`).toEqual([])
  })

  it('다국어 문구는 6개 언어가 같은 클래스를 쓴다 — 코드 defaultValue 만 고치면 locale 값이 이긴다', () => {
    // CLAUDE.md 가 명시한 함정: `t('x', { defaultValue: '<b class="...">' })` 는
    // locale JSON 에 같은 키가 있으면 **그쪽이 이긴다**. 그래서 둘 다 고쳐야 한다.
    const locales = files.filter((f) => f.startsWith('public/locales/'))
    expect(locales.length, '다국어 파일을 못 찾았다').toBe(6)
    for (const f of locales) {
      expect(readFileSync(f, 'utf-8'), `${f} 에 pink 가 남았다`).not.toMatch(/-pink-\d/)
    }
  })

  it('brand 토큰이 tailwind 에 실재한다 — 클래스만 바꾸고 토큰이 없으면 아무것도 안 그려진다', () => {
    const tw = readFileSync('tailwind.config.js', 'utf-8')
    expect(tw).toMatch(/brand:\s*\{/)
    for (const k of ['DEFAULT', 'dark', 'tint', 'text']) {
      expect(tw, `brand.${k} 가 없다`).toMatch(new RegExp(`${k}:`))
    }
    expect(tw, 'brand 가 MONO 로 중화됐다').not.toMatch(/brand:\s*MONO/)
  })
})
