/**
 * 🧭 대외 안내 랜딩 셋(`/about` · `/partners` · `/influencer`) 서버 첫 화면 (2026-11-10 — 폰 첫 그림 = 큰 사진 3.2~4.7s, 사진은 0.8s 에 와 있었다).
 *
 * 지키는 것:
 *   ① 서버 HTML = `shared/landing-photo.ts` 클래스·문구·사진(위치·대체문구) · 사진 칸 CSS 인라인 · 제목/문장/버튼은 **없다**(모션 깜빡임) · 로더 아래
 *   ② 세 페이지 소스가 같은 클래스를 **글자로** 갖는다(머리줄 8개 · 사진 칸 안쪽) · `PhotoHero` 가 shared `LANDING_PHOTOS` 를 쓴다 · 머리줄 문구가 소스와 같다
 *   ③ 사진 칸 CSS 는 `premium.css` ① 세 규칙과 값이 같다(정지 상태) · 로고는 `forceDark` 색
 *   ④ 워커 분기 · `firstScreenApplies` 폰·PC(전체화면) · 표면 `landing` ↔ 생성기 · 세 경로 밖은 null
 * ⚠️ 못 보는 것: 마운트 때 켄번스 애니메이션 시작값(1.08)이 서버 정지값과 같은지는 CSS 글자 대조까지만 · 실제 픽셀.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildLandingFirstScreen } from '@/worker/utils/landing-first-screen'
import { LANDING_FS, LANDING_HEAD, LANDING_HERO_CSS, LANDING_LOGO_SIZE, LANDING_PHOTOS, LANDING_HERO_SRC, landingPhotoKeyOf, landingHeroFor } from '@/shared/landing-photo'
import { logoHtml } from '@/worker/utils/logo-html'
import { firstScreenApplies, criticalSurfaceOf, criticalCssFor } from '@/worker/utils/css-first-boot'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { SURFACE_ROOTS } from '../../../scripts/generate-critical-css.mjs'

const src = (f: string) => stripComments(readFileSync(f, 'utf8'))
const PAGES = { about: src('src/pages/AboutServicePage.tsx'), partners: src('src/pages/PartnersPage.tsx'), influencer: src('src/pages/CreatorsPage.tsx') } as const
const HERO_SRC = { about: PAGES.about, partners: src('src/pages/partners/PartnerHero.tsx'), influencer: PAGES.influencer } as const
const PREMIUM = src('src/pages/landing/premium.tsx'), PREMIUM_CSS = readFileSync('src/pages/landing/premium.css', 'utf8')
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }
const PATHS = { about: '/about', partners: '/partners', influencer: '/influencer' } as const
const KEYS = Object.keys(PATHS) as Array<keyof typeof PATHS>

describe('① 서버 HTML', () => {
  it.each(KEYS)('%s — 클래스 전부 · 머리줄 문구 · 사진 · 제목 없음 · 로더 아래', (k) => {
    const html = buildLandingFirstScreen(PATHS[k], LOADER)
    for (const [name, v] of Object.entries(LANDING_FS)) { if (name === 'cta' || name === 'ctaIcon') continue; expect(html, name).toContain(v) }
    const head = LANDING_HEAD[k]
    expect(html).toContain(head.label); for (const l of head.links) expect(html).toContain(l)
    if (head.cta) { expect(html).toContain(head.cta); expect(html).toContain(LANDING_FS.cta) } else expect(html).not.toContain(LANDING_FS.cta)
    const img = dom(html).querySelector('img.ur-photo-hero-img')!
    expect(img.getAttribute('src')).toBe(LANDING_HERO_SRC); expect(img.getAttribute('alt')).toBe(LANDING_PHOTOS[k].alt)
    expect(img.getAttribute('style')).toBe(`object-position:${LANDING_PHOTOS[k].position}`); expect(img.getAttribute('fetchpriority')).toBe('high'); expect(img.getAttribute('width')).toBe('1080')
    expect(dom(html).querySelector('section')!.getAttribute('data-photo-hero')).toBe(k)
    expect(html).toContain(`<style>${LANDING_HERO_CSS}</style>`)
    expect(html).not.toContain('<h1'); expect(html).not.toContain('ur-load')
    expect(html).toContain(logoHtml(LANDING_LOGO_SIZE, 'dark')); expect(logoHtml(LANDING_LOGO_SIZE, 'dark')).toContain('text-[#F8F7FC]'); expect(logoHtml(LANDING_LOGO_SIZE, 'dark')).not.toContain('dark:')
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</main>'))
    const root = dom(html).querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(LANDING_FS.root); expect(root.firstElementChild!.tagName).toBe('HEADER')
  })
  it('세 경로 밖은 빈 문자열', () => { expect(buildLandingFirstScreen('/about/print', LOADER)).toBe(''); expect(buildLandingFirstScreen('/', LOADER)).toBe('') })
})

describe('② 페이지 소스와 글자 대조', () => {
  it.each(KEYS)('%s — 머리줄 클래스 · 사진 칸 안쪽 · 문구', (k) => {
    const P = PAGES[k]
    for (const name of ['root', 'header', 'headerRow', 'brand', 'brandLabel', 'actions', 'navLink', 'cta', 'ctaIcon', 'main'] as const) {
      if (k === 'partners' && name === 'cta') continue // 입점 랜딩 머리줄은 파란 버튼 모양이 다르다(서버도 안 그린다)
      if (k === 'partners' && name === 'ctaIcon') continue
      expect(P, `${k}.${name}`).toContain(`"${LANDING_FS[name]}"`)
    }
    expect(HERO_SRC[k]).toContain(`"${LANDING_FS.heroInner}"`); expect(HERO_SRC[k]).toContain(`photo="${k}"`)
    expect(P).toContain(`<UrDealLogo size={${LANDING_LOGO_SIZE}} forceDark />`)
    const head = LANDING_HEAD[k]
    expect(P).toContain(`>${head.label}</span>`); for (const l of head.links) expect(P).toContain(`>${l}</Link>`)
    if (head.cta) expect(P).toContain(head.cta)
  })
  it('PhotoHero 는 shared LANDING_PHOTOS · 클래스 두 벌 없음', () => {
    expect(PREMIUM).toContain("import { LANDING_PHOTOS } from '@/shared/landing-photo'"); expect(PREMIUM).not.toMatch(/position: '50% 50%'/)
    expect(PREMIUM).toContain('className={`ur-photo-hero ur-panel-ink text-white ${className}`}'); expect(PREMIUM).toContain('className="ur-photo-hero-img"')
    expect(PREMIUM).toContain("{...({ fetchpriority: 'high' } as Record<string, string>)}")
  })
})

describe('③ 사진 칸 CSS = premium.css ① (정지 상태)', () => {
  it('세 규칙의 값이 같다', () => {
    expect(PREMIUM_CSS).toContain('.ur-photo-hero { position: relative; isolation: isolate; overflow: hidden; }')
    expect(PREMIUM_CSS).toContain('position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2;')
    expect(PREMIUM_CSS).toContain('transform: scale(1.08); animation: ur-kenburns')
    expect(PREMIUM_CSS).toContain('background: linear-gradient(180deg, rgb(17 20 28 / 0.30) 0%, rgb(17 20 28 / 0.55) 45%, rgb(17 20 28 / 0.94) 100%);')
    expect(PREMIUM_CSS).toContain('background: linear-gradient(90deg, rgb(17 20 28 / 0.92) 0%, rgb(17 20 28 / 0.72) 45%, rgb(17 20 28 / 0.25) 100%);')
    expect(LANDING_HERO_CSS).toContain('transform:scale(1.08)}'); expect(LANDING_HERO_CSS).not.toContain('animation')
    expect(LANDING_HERO_CSS).toContain('rgb(17 20 28 / 0.30) 0%,rgb(17 20 28 / 0.55) 45%,rgb(17 20 28 / 0.94) 100%'); expect(LANDING_HERO_CSS).toContain('rgb(17 20 28 / 0.92) 0%,rgb(17 20 28 / 0.72) 45%,rgb(17 20 28 / 0.25) 100%')
    expect(LANDING_HERO_CSS).toContain('@media (min-width:1024px)')
  })
})

describe('④ 배선', () => {
  it('워커 분기 · 첫 화면 CSS 자격(폰·PC) · 표면 landing ↔ 생성기 · 경로 판정', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ worker/index.ts 엔 stripComments 금지(source-text 머리말)
    expect(w).toContain("} else if (landingHeroFor(url.pathname)) { const landingFirst = buildLandingFirstScreen(url.pathname, urdealLoaderHtml); const landingNs = buildStaticSurfaceNoscript(url.pathname, crawlerPayload); rb = rb.on('#root', { element(el) { el.setInnerContent(landingFirst + landingNs, { html: true }); } });")
    for (const p of Object.values(PATHS)) {
      expect(firstScreenApplies(p, PHONE)).toBe(true); expect(firstScreenApplies(p, PC)).toBe(true); expect(firstScreenApplies(p + '/', PHONE)).toBe(true)
      expect(criticalSurfaceOf(p)).toBe('landing'); expect(landingHeroFor(p)).toBe(LANDING_HERO_SRC)
    }
    expect(firstScreenApplies('/about/print', PHONE)).toBe(false); expect(landingPhotoKeyOf('/about/print')).toBeNull(); expect(landingPhotoKeyOf('/influencer/dashboard')).toBeNull()
    expect(criticalCssFor('/about', 'FULL', 'HOME', { landing: 'L' })).toBe('L')
    expect(SURFACE_ROOTS.landing).toEqual(['src/worker/utils/landing-first-screen.ts'])
  })
})
