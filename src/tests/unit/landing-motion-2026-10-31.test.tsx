/**
 * 🎬 랜딩 움직임 키트 불변식 — `/partners` · `/influencer` · `/about` (2026-10-31)
 *
 * 대표: *"홈페이지들 각각 ai 가 만든 티가 나면 안되고, 애니메이션? 움직이는 효과도 나는 대기업급 페이지가 돼야"*
 *   → *"세 페이지 다 그렇게 진행해줘. 또 고급 효과들 없어?"*
 *
 * ■ 지키는 것 (움직임이 만드는 사고 넷)
 *   M1 **처음부터 보이는 것을 숨기지 않는다** — 첫 화면 요소를 opacity 0 으로 시작하면 깜빡이고,
 *      JS 가 늦으면 빈 화면이 된다. 숨기는 클래스는 "화면 밖에서 시작한 요소" 에만 붙는다.
 *   M2 **동작 줄이기를 존중한다** — 설정을 켠 사람에게는 숨기기도 움직이기도 하지 않는다.
 *   M3 **레이아웃을 움직이지 않는다** — keyframes 는 transform·opacity 만(밀림 0). 예외는 FAQ 접기
 *      하나(사람이 눌러서 여는 것이라 밀림이 아니다).
 *   M4 **라이브러리를 들이지 않는다** — framer-motion·gsap 같은 것은 수십 KB 다. 세 랜딩은 사장님이
 *      카톡 링크로 처음 여는 화면이라 무게가 곧 이탈이다.
 *   M5 **세 랜딩이 같은 키트를 쓴다** — 한 페이지만 따로 만들면 셋이 서로 다른 회사처럼 움직인다.
 *   M6 **점 찍은 가로 타임라인으로 돌아가지 않는다** — 가장 흔한 AI 랜딩 그림이라 대표가 지적한 그 티다.
 *
 * ■ 못 보는 것: 움직임이 *보기 좋은지*(렌더해서 봐야 한다) · 실제 프레임 속도 · 폰에서의 체감.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { Reveal } from '@/pages/landing/motion'

const CSS = readFileSync('src/pages/landing/motion.css', 'utf-8')
const KIT = stripComments(readFileSync('src/pages/landing/motion.tsx', 'utf-8'))
const PAGES = ['src/pages/PartnersPage.tsx', 'src/pages/CreatorsPage.tsx', 'src/pages/AboutServicePage.tsx']
const code = (f: string) => stripComments(readFileSync(f, 'utf-8'))

const realMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = realMatchMedia })
function setReduced(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('reduce'), media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('M1 처음부터 보이는 것은 숨기지 않는다', () => {
  it('화면 안에서 마운트된 요소에는 숨김 클래스가 안 붙는다', () => {
    setReduced(false)
    const orig = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 120, bottom: 220, left: 0, right: 0, width: 0, height: 100, x: 0, y: 120, toJSON() {} } as DOMRect
    }
    try {
      const { getByText } = render(<Reveal>보이는 글</Reveal>)
      expect(getByText('보이는 글').className).not.toContain('ur-rv')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig
    }
  })

  it('화면 밖에서 마운트된 요소만 숨겼다가 보여 준다', () => {
    setReduced(false)
    const orig = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 5000, bottom: 5100, left: 0, right: 0, width: 0, height: 100, x: 0, y: 5000, toJSON() {} } as DOMRect
    }
    try {
      const { getByText } = render(<Reveal>아래쪽 글</Reveal>)
      expect(getByText('아래쪽 글').className).toContain('ur-rv')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig
    }
  })
})

describe('M2 동작 줄이기', () => {
  it('설정을 켜면 화면 밖 요소도 숨기지 않는다', () => {
    setReduced(true)
    const orig = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 5000, bottom: 5100, left: 0, right: 0, width: 0, height: 100, x: 0, y: 5000, toJSON() {} } as DOMRect
    }
    try {
      const { getByText } = render(<Reveal>줄인 글</Reveal>)
      expect(getByText('줄인 글').className).not.toContain('ur-rv')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig
    }
  })

  it('CSS 가 움직이는 클래스 전부를 동작 줄이기에서 끈다', () => {
    const block = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block.length, '동작 줄이기 블록이 없다').toBeGreaterThan(50)
    // 선택자 목록에 **그 클래스 자체**가 있고(접두가 같은 `.ur-marquee-wrap` 은 아니다) 그 규칙이 움직임을 끄는가
    const inner = block.slice(block.indexOf('{') + 1) // `@media (…) {` 머리를 떼고 안쪽 규칙만
    const rules = [...inner.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, body]) => ({ sel, body }))
    const offBy = (cls: string) => rules.some(({ sel, body }) =>
      new RegExp(`\\${cls}(?![\\w-])`).test(sel) && /(animation|transition):\s*none|opacity:\s*1/.test(body))
    for (const cls of ['.ur-rv', '.ur-line', '.ur-load', '.ur-float', '.ur-marquee', '.ur-scanline', '.ur-tilt', '.ur-spot', '.ur-story-shot']) {
      expect(offBy(cls), `${cls} 가 동작 줄이기에서 안 꺼진다`).toBe(true)
    }
  })
})

describe('M3 레이아웃을 움직이지 않는다', () => {
  it('keyframes 는 transform·opacity 만 바꾼다', () => {
    const frames = [...CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)]
    expect(frames.length, 'keyframes 를 못 읽었다 — 검사가 헛돈다').toBeGreaterThanOrEqual(5)
    for (const [, name, body] of frames) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      for (const p of props) expect(['transform', 'opacity'], `${name} 가 ${p} 를 움직인다(밀림)`).toContain(p)
    }
  })

  it('transition 도 레이아웃 속성을 건드리지 않는다 (FAQ 접기만 예외)', () => {
    const trans = [...CSS.matchAll(/([.\w\[\]='-]+)\s*\{[^}]*transition:\s*([^;]+);/g)]
    expect(trans.length).toBeGreaterThanOrEqual(4)
    for (const [, sel, val] of trans) {
      if (sel.includes('ur-collapse')) continue
      expect(val, `${sel}: ${val}`).not.toMatch(/\b(top|left|height|width|margin|padding|grid-template)/)
    }
  })
})

describe('M4 라이브러리를 들이지 않는다', () => {
  it('package.json 에 애니메이션 라이브러리가 없다', () => {
    const pkg = readFileSync('package.json', 'utf-8')
    expect(pkg).not.toMatch(/"(framer-motion|motion|gsap|animejs|lottie-web|aos)"\s*:/)
  })

  it('키트는 react 와 자기 CSS 만 import 한다', () => {
    const imports = [...KIT.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    expect(imports.sort()).toEqual(['./motion.css', 'react'])
  })
})

describe('M5 세 랜딩이 같은 키트를 쓴다', () => {
  it.each(PAGES)('%s 가 키트(motion)와 읽은 만큼 막대를 쓴다', (f) => {
    const s = code(f)
    expect(s).toMatch(/from '\.\/landing\/motion'/)
    expect(s).toContain('<ScrollProgress />')
  })

  it('세 랜딩의 첫 제목이 줄 단위로 올라온다', () => {
    const files = ['src/pages/partners/PartnerHero.tsx', 'src/pages/CreatorsPage.tsx', 'src/pages/AboutServicePage.tsx']
    for (const f of files) expect(code(f).match(/<h1\b[\s\S]*?<\/h1>/)?.[0] ?? '', f).toMatch(/<Line i=\{0\}>/)
  })
})

describe('M6 점 찍은 가로 타임라인으로 돌아가지 않는다', () => {
  it('세 랜딩에 "점 + 가로선" 단계 표시가 없다', () => {
    const files = [...PAGES, 'src/pages/partners/PartnerFlow.tsx']
    for (const f of files) {
      // 옛 모양: 단계마다 `w-[13px] h-[13px] rounded-full bg-brand` 점 + 옆으로 그은 `flex-1 h-px` 선
      expect(code(f), f).not.toMatch(/rounded-full bg-brand[^"]*"\s*\/>\s*<i className="flex-1 h-px/)
    }
  })

  it('단계는 고정 화면 스토리(/partners · /about) 또는 계단(/influencer)으로 그린다', () => {
    expect(code('src/pages/partners/PartnerFlow.tsx')).toContain('<StickyStory')
    expect(code('src/pages/AboutServicePage.tsx')).toContain('<StickyStory')
    expect(code('src/pages/CreatorsPage.tsx')).toMatch(/STAIR\[i\]/)
  })
})
