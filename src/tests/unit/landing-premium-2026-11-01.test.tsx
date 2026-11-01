/**
 * 💎 랜딩 고급화 불변식 — `/partners` · `/influencer` · `/about` (2026-11-01)
 *
 * 대표: *"아직 좀 아쉬움이 남는데 더 고급스럽게 하려면?"* → 시안 여섯 가지 → *"전부 세 페이지에 모두 적용해줘."*
 *
 * ■ 지키는 것
 *   P1 ① 세 랜딩의 첫 화면이 **실사진**이고 그 사진이 첫 페인트 우선순위를 받는다(파일이 실재한다).
 *   P2 ③ 세 랜딩에 **실기기 무대**가 있고, 화면 영상은 보일 때만 재생된다(`preload="none"` · 무음 · 인라인).
 *   P3 ④ 세 랜딩에 **스크롤 따라 바뀌는 바탕**이 있고, 바탕과 글자색이 **함께** 바뀐다(글자가 바탕에 묻히지 않는다).
 *   P4 ⑤ **거대한 숫자**는 그래픽이다 — `aria-hidden` + `select-none`, 뜻은 숨은 글이 말한다.
 *   P5 ⑥ **제목 전용 글꼴**은 세 랜딩에서만 불러온다(앱 첫 화면 `index.html` 에는 없다 · CSP 가 그 출처를 허용한다).
 *   P6 움직임 규칙 — keyframes 는 transform·opacity 만, 동작 줄이기면 전부 끈다.
 *
 * ■ 못 보는 것: 예쁜지 · 사진이 실제 매장 촬영본인지(지금은 앱 상품 사진 한 장을 세 페이지가 나눠 쓴다) ·
 *   글꼴이 실제로 도착하는지(네트워크) · 영상이 폰에서 자동 재생되는지(기기 정책).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { GiantNumber, ToneScroll, LANDING_PHOTOS, LANDING_FONT_HREF } from '@/pages/landing/premium'

const CSS = readFileSync('src/pages/landing/premium.css', 'utf-8')
const KIT = stripComments(readFileSync('src/pages/landing/premium.tsx', 'utf-8'))
const code = (f: string) => stripComments(readFileSync(f, 'utf-8'))
const PAGES = {
  partners: ['src/pages/PartnersPage.tsx', 'src/pages/partners/PartnerHero.tsx', 'src/pages/partners/PartnerShowcase.tsx', 'src/pages/partners/PartnerFlow.tsx'],
  influencer: ['src/pages/CreatorsPage.tsx'],
  about: ['src/pages/AboutServicePage.tsx'],
} as const
const pageSrc = (k: keyof typeof PAGES) => PAGES[k].map(code).join('\n')

const realMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = realMatchMedia })

describe('P1 실사진 첫 화면', () => {
  it.each(Object.keys(PAGES) as (keyof typeof PAGES)[])('%s 첫 화면이 PhotoHero 다', (k) => {
    expect(pageSrc(k)).toContain(`<PhotoHero photo="${k}">`)
  })

  it('사진 파일이 public 에 실재한다(없으면 첫 화면이 잉크 바탕만 남는다)', () => {
    for (const p of Object.values(LANDING_PHOTOS)) {
      expect(p.src.startsWith('/static/'), `${p.src} — /static/ 밖은 워커가 404 를 준다`).toBe(true)
      expect(existsSync(`public${p.src}`), p.src).toBe(true)
      expect(p.alt.length).toBeGreaterThan(4)
    }
  })

  it('첫 화면 사진은 lazy 가 아니고 우선순위가 높다', () => {
    const img = KIT.slice(KIT.indexOf('className="ur-photo-hero-img"') - 400, KIT.indexOf('className="ur-photo-hero-img"'))
    expect(img).toMatch(/fetchpriority: 'high'/)
    expect(img).not.toMatch(/loading="lazy"/)
  })

  it('사진 위 글자를 읽히게 하는 막이 있다', () => {
    expect(CSS).toMatch(/\.ur-photo-hero::after\s*\{[^}]*linear-gradient/)
  })
})

describe('P2 실기기 무대 + 화면 영상', () => {
  it.each(Object.keys(PAGES) as (keyof typeof PAGES)[])('%s 에 실기기 무대가 있다', (k) => {
    expect(pageSrc(k)).toContain('<DeviceStage')
  })

  it('영상과 포스터 파일이 실재한다', () => {
    for (const f of ['public/static/partners/customer-home.mp4', 'public/static/partners/customer-home-poster.jpg']) {
      expect(existsSync(f), f).toBe(true)
    }
  })

  it('영상은 미리 받지 않고, 무음·인라인이며, 보일 때만 재생한다', () => {
    const v = KIT.slice(KIT.indexOf('<video'), KIT.indexOf('/>', KIT.indexOf('<video')))
    expect(v).toMatch(/preload="none"/)
    expect(v).toMatch(/\bmuted\b/)
    expect(v).toMatch(/\bplaysInline\b/)
    expect(v).toMatch(/poster=/)
    expect(v).not.toMatch(/autoPlay/)
    expect(KIT).toMatch(/isIntersecting\) \{ v\.play\(\)/)
  })
})

describe('P3 스크롤 따라 바뀌는 바탕', () => {
  it.each(Object.keys(PAGES) as (keyof typeof PAGES)[])('%s 에 ToneScroll 이 있다', (k) => {
    expect(pageSrc(k)).toContain('<ToneScroll')
  })

  it('바탕과 글자색이 같은 규칙에서 함께 바뀐다', () => {
    const rule = CSS.match(/\.ur-tone\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/background-color:\s*var\(--tone-bg\)/)
    expect(rule).toMatch(/color:\s*var\(--tone-fg\)/)
    for (const t of ['ink', 'paper', 'tint']) {
      const r = CSS.match(new RegExp(`\\.ur-tone\\[data-tone-active='${t}'\\]\\s*\\{([^}]*)\\}`))?.[1] ?? ''
      expect(r, t).toMatch(/--tone-bg/)
      expect(r, t).toMatch(/--tone-fg/)
      expect(r, t).toMatch(/--tone-mu/)
    }
  })

  it('옅은 파랑(tint)은 다크 테마에서 따로 정의된다(라이트 값을 다크에 쓰면 흰 글자가 묻힌다)', () => {
    expect(CSS).toMatch(/\.dark \.ur-tone\[data-tone-active='tint'\]\s*\{[^}]*--tone-bg/)
  })

  it('묶음 밖에서도 글자가 테마 기본색으로 떨어진다', () => {
    expect(CSS).toMatch(/\.ur-tone-fg\s*\{\s*color:\s*var\(--tone-fg,\s*var\(--ink\)\)/)
    expect(CSS).toMatch(/\.ur-tone-mu\s*\{\s*color:\s*var\(--tone-mu,\s*var\(--ink-soft\)\)/)
  })

  it('첫 색이 마운트 직후부터 걸린다(색이 튀지 않는다)', () => {
    const { container } = render(<ToneScroll initial="ink"><section data-tone="ink">x</section></ToneScroll>)
    expect(container.firstElementChild?.getAttribute('data-tone-active')).toBe('ink')
  })
})

describe('P4 거대한 숫자는 그래픽이다', () => {
  it('aria-hidden + select-none, 뜻은 숨은 글이 말한다', () => {
    const { container, getByText } = render(<GiantNumber value="90" unit="%" label="사장님 몫 90%" />)
    const g = container.querySelector('.ur-giant')!
    expect(g.getAttribute('aria-hidden')).toBe('true')
    expect(g.className).toContain('select-none')
    expect(getByText('사장님 몫 90%').className).toContain('sr-only')
  })

  it('JS 가 없으면 끝까지 칠해진 채로 보인다(기본 --fill 100%)', () => {
    expect(CSS).toMatch(/var\(--brand\) var\(--fill, 100%\)/)
  })
})

describe('P5 제목 전용 글꼴', () => {
  it.each(['src/pages/PartnersPage.tsx', 'src/pages/CreatorsPage.tsx', 'src/pages/AboutServicePage.tsx'])('%s 가 글꼴을 부르고 루트에 ur-landing-type 을 단다', (f) => {
    const s = code(f)
    expect(s).toContain('useLandingFont()')
    expect(s).toMatch(/className="[^"]*\bur-landing-type\b/)
  })

  it('앱 첫 화면(index.html)은 이 글꼴을 받지 않는다', () => {
    expect(readFileSync('index.html', 'utf-8')).not.toMatch(/Noto\+Serif\+KR|Noto Serif KR/)
  })

  it('CSP 가 글꼴 출처를 허용한다(막히면 조용히 기기 글꼴로 남는다)', () => {
    const w = readFileSync('src/worker/index.ts', 'utf-8')
    expect(LANDING_FONT_HREF.startsWith('https://fonts.googleapis.com/')).toBe(true)
    expect(w).toMatch(/style-src[^"]*https:\/\/fonts\.googleapis\.com/)
    expect(w).toMatch(/font-src[^"]*https:\/\/fonts\.gstatic\.com/)
  })

  it('글꼴은 제목에만 — 본문 전체를 바꾸지 않는다', () => {
    const rule = CSS.match(/([^{}]+)\{\s*font-family:\s*'Noto Serif KR'/)?.[1] ?? ''
    expect(rule).toMatch(/:is\(h1, h2\)/)
    expect(rule).not.toMatch(/\.ur-landing-type\s*,|\.ur-landing-type\s*$/)
  })
})

describe('P6 움직임 규칙', () => {
  it('keyframes 는 transform·opacity 만 바꾼다', () => {
    const frames = [...CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)]
    expect(frames.length, 'keyframes 를 못 읽었다 — 검사가 헛돈다').toBeGreaterThanOrEqual(3)
    for (const [, name, body] of frames) {
      for (const [, p] of body.matchAll(/([a-z-]+)\s*:/g)) expect(['transform', 'opacity'], `${name}: ${p}`).toContain(p)
    }
  })

  it('동작 줄이기에서 움직이는 것이 전부 꺼진다', () => {
    const block = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block.length).toBeGreaterThan(50)
    for (const cls of ['.ur-photo-hero-img', '.ur-device-toast', '.ur-tone', '.ur-giant', '.ur-device-back']) {
      expect(block, cls).toContain(cls)
    }
  })
})
