/**
 * 🏝️ 늘 밝은 표면(`light-island`)의 두 가지 구조적 함정 (2026-09-15)
 *
 * 대표 신고: *"내가 첨부한 이미지처럼 글자가 안보여. 작은 글자들도 색깔이 옅어서. 다크모드일 때 저러나봐"*
 * (지도에서 핀을 누르면 뜨는 딜 카드 — 제목이 통째로 안 보였다)
 *
 * ## 원인이 둘이었다. 둘 다 **정적으로 잡힌다**
 *
 * ### ① `light-island` 는 *자손*의 `dark:` 만 끈다 — **자기 자신은 안 끈다**
 * tailwind 설정이 `darkMode: ['variant', '&:is(.dark *):not(.light-island *)']` 라
 * 셀렉터가 `.light-island *`(자손)다. 그래서 같은 element 에 `light-island` 와 `dark:bg-…` 를
 * 함께 쓰면 **배경만 다크로 바뀌고 안쪽 글자는 라이트 색(거의 검정)으로 남는다.**
 * 딜 카드가 정확히 그 상태였다 — `bg-white dark:bg-[#11141C]` + `text-gray-900`(자손, dark: 꺼짐).
 *
 * ### ② 토큰 되박기 목록이 불완전했다
 * `.light-island` 블록이 `--tone-*` 은 *"안 그러면 흰 카드 위에 다크용 밝은 초록이 뜬다"* 며
 * 되박으면서 **`--sale` 등 나머지는 빠뜨렸다.** 그래서 `text-sale` 이 흰 카드 위에서 다크 빨강
 * (#FF5C69) = **3.01:1** 이었다(브라우저 실측).
 *
 * ## 이 시험이 **못** 막는 것
 * 실제 픽셀 대비는 여기서 못 잰다(jsdom 에 레이아웃·CSS 캐스케이드가 없다).
 * 브라우저 실측은 `scripts/check-dark-contrast.mjs` 인데, **그 가드는 `/map` 은 보지만 핀을 누른 뒤의
 * 이 카드는 못 봤다** — 경로 목록 밖의 상호작용 상태가 그 가드의 사각지대이고, 이 결함이 거기 살았다.
 * 그래서 여기서는 **원인 쪽**(구조적 모순 · 토큰 누락)을 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, globSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const CSS = readFileSync('src/index.css', 'utf-8')

/** `:root` 와 `.dark` 양쪽에 선언돼 **테마가 갈리는** 토큰만 고른다.
 *
 * ⚠️ 블록은 **정규식이 아니라 셀렉터 위치로 자른다.** 첫 판에 `/html\.dark[^{]*\{/` 로 썼는데
 * 그 문자열이 **바로 위 주석 안에도 있어서**(`html.dark = 기존 토글…`) 정규식이 주석에서 시작해
 * `[^{]*` 로 흘러 다음 `{` 를 집었다 — 우연히 맞는 블록이었을 뿐, 그 주석을 한 글자만 고쳐도
 * 조용히 다른 블록을 가리켰을 것이다(이 레포가 반복해 당한 "헛도는 가드"). */
function splitTokens(): string[] {
  const dStart = CSS.indexOf('.dark, [data-theme="dark"] {')
  const parse = (src: string) => {
    const out = new Map<string, string>()
    for (const [, k, v] of src.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(k, v.trim())
    return out
  }
  if (dStart < 0) return []
  const light = parse(CSS.slice(CSS.lastIndexOf(':root {', dStart), dStart))
  const dark = parse(CSS.slice(dStart, CSS.indexOf('\n  }', dStart)))
  const out: string[] = []
  for (const [k, v] of light) if (dark.has(k) && dark.get(k) !== v) out.push(k)
  return out
}

/** `.light-island …` 되박기 블록이 실제로 되박는 토큰. */
function islandTokens(): Set<string> {
  const m = CSS.match(/\.light-island, \.force-light-theme[^{]*\{([\s\S]*?)\n\}/)
  if (!m) return new Set()
  return new Set([...m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map(x => x[1]))
}

describe('① light-island 요소 자신에 dark: 유틸을 붙이지 않는다', () => {
  // ⚠️ 자손이 아니라 **그 element 자신**이다. 자손의 `dark:` 는 꺼지므로(무해) 검사 대상이 아니다.
  const files = globSync('src/**/*.{tsx,ts}').filter(f => !f.includes('/tests/'))

  it('한 className 안에 `light-island` 와 `dark:` 가 함께 있으면 안 된다', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf-8'))
      // className 값(따옴표 한 쌍) 안에 둘 다 들어 있는 경우만
      for (const m of src.matchAll(/className=(?:\{)?["'`]([^"'`]*light-island[^"'`]*)["'`]/g)) {
        if (/\bdark:/.test(m[1])) bad.push(`${f}: ${m[1].slice(0, 120)}`)
      }
    }
    expect(bad, [
      'light-island 는 **자손**의 dark: 만 끈다 — 자기 자신은 안 끈다.',
      '같이 쓰면 배경만 다크가 되고 안쪽 글자는 라이트 색으로 남아 안 보인다(2026-09-15 대표 신고).',
      ...bad,
    ].join('\n')).toEqual([])
  })

  it('검사 대상이 0건이면 통과가 아니다 — 실제로 light-island 를 찾았는지 확인', () => {
    const found = files.filter(f => stripComments(readFileSync(f, 'utf-8')).includes('light-island'))
    expect(found.length).toBeGreaterThanOrEqual(4)
  })
})

describe('② 테마가 갈리는 토큰은 light-island 가 전부 되박는다', () => {
  it('되박기 목록에 빠진 토큰이 없다', () => {
    const island = islandTokens()
    // 브랜드 주색·다크색은 두 테마가 같은 값이라 갈리지 않는다(아래 splitTokens 가 자동으로 거른다).
    const missing = splitTokens().filter(t => !island.has(t))
    expect(missing, [
      '`.light-island` 는 테마와 무관하게 흰 표면이다 — 안에서 쓰는 토큰이 다크 값이면 그 위 글자가 안 읽힌다.',
      '실제로 `--sale` 이 빠져 있어 흰 카드 위 할인율이 3.01:1 이었다(2026-09-15).',
      `빠진 것: ${missing.join(', ')}`,
    ].join('\n')).toEqual([])
  })

  it('검사가 성립하는지 — 갈리는 토큰을 실제로 찾았는가', () => {
    // 0개면 블록 절단이 헛돈 것이다(그러면 위 시험이 무조건 통과한다).
    // 실측 22개 — 절반 아래로 떨어지면 엉뚱한 블록을 집은 것이다.
    expect(splitTokens().length).toBeGreaterThanOrEqual(15)
    expect(islandTokens().size).toBeGreaterThanOrEqual(15)
  })
})

describe('③ 지도 딜 카드 — 대표가 본 그 화면', () => {
  const CARD = stripComments(readFileSync('src/pages/restaurant-map/SelectedDealCard.tsx', 'utf-8'))

  it('카드는 늘 흰색이다 (자기 자신에 dark: 없음)', () => {
    expect(CARD).toMatch(/className="light-island[^"]*bg-white[^"]*"/)
    const island = CARD.match(/className="(light-island[^"]*)"/)?.[1] ?? ''
    expect(island).not.toMatch(/\bdark:/)
  })

  it('본문으로 읽는 작은 글자에 `--ink-faint`(=gray-400, 비활성용)를 쓰지 않는다', () => {
    // 주소·정가·쿠폰가 라벨·위치 표시는 **읽는 값**이다. 3.65:1 → 5.30:1.
    for (const anchor of ['쿠폰가</span>', 'line-through', 'mt-1 flex items-center gap-0.5 truncate']) {
      const at = CARD.indexOf(anchor)
      expect(at, `앵커를 못 찾았다: ${anchor}`).toBeGreaterThan(-1)
      // 그 줄이 gray-400 을 쓰고 있지 않아야 한다
      const lineStart = CARD.lastIndexOf('\n', at) + 1
      expect(CARD.slice(lineStart, at + anchor.length)).not.toMatch(/text-gray-400/)
    }
  })
})
