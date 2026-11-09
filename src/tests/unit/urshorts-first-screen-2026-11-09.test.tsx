/**
 * 🎬 유어쇼츠 목록 서버 첫 화면 (2026-11-09 대표 "계속 최적화") — 라이브 첫 글자 2.0초(로더뿐)를 서버가 그린다.
 *   두 벌(워커 HTML ↔ React `BrowseCard`)이 갈리면 빨간불: 시험이 진짜 카드를 렌더해 **클래스·사진 주소·글자**를 대조한다.
 *   고정하는 것: ① 카드 마크업 동일 ② 칩 줄은 facets.ts 와 같은 수·같은 규칙(둘 미만이면 안 그림) ③ 0편이면 ''
 *   ④ 워커 배선(폰 UA · 시드 있음) ⑤ CSS-first 표면·critical CSS 표면 등록 ⑥ 시드 첫 렌더엔 등장 애니메이션 없음.
 *   못 보는 것: 픽셀(jsdom) · 실제 FCP(배포 뒤 라이브 실측).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BrowseCard from '@/pages/urshorts/BrowseCard'
import { buildUrShortsFirstScreen, urshortsCardHtml, URSHORTS_FS_CLASS, URSHORTS_FS_DESC } from '@/worker/utils/urshorts-first-screen'
import { cssFirstApplies, criticalSurfaceOf } from '@/worker/utils/css-first-boot'
import { readRaw } from '../helpers/source-text'
import type { UrShortItem } from '@/shared/urshorts'

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const IT = (o: Partial<UrShortItem>): UrShortItem => ({ id: 1, video_id: 'abc', title: null, channel: null, thumb_url: null, product_id: null, product_name: null, store_name: null, product_image: null, price: null, original_price: null, discount_rate: null, ...o })
const RICH = IT({ id: 1, video_id: 'v1', title: '싸와디 쌀국수 #부산맛집 🍜', channel: '먹방왕', thumb_url: 'https://i.ytimg.com/vi/v1/hq.jpg', duration_sec: 31, region_si: '부산', region_area: '연제', category: 'meal_voucher', product_name: '곱빼기 쌀국수 2인', store_name: '쌀국수집', price: 20200, original_price: 25000, discount_rate: 19 })
const BARE = IT({ id: 2, video_id: 'v2', thumb_url: 'https://i.ytimg.com/vi/v2/hq.jpg', region_si: '서울', category: 'meal_voucher' })
const ITEMS = [RICH, BARE, IT({ id: 3, video_id: 'v3', thumb_url: 'https://i.ytimg.com/vi/v3/hq.jpg', region_si: '제주', category: 'beauty_voucher', title: '제주 미용' })]
const payload = (data: unknown[]) => JSON.stringify({ success: true, data })
const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'

function reactCard(item: UrShortItem, eager: boolean) {
  const { container } = render(<MemoryRouter><BrowseCard item={item} eager={eager} /></MemoryRouter>)
  return container.querySelector('a')!
}
function serverCard(item: UrShortItem, eager: boolean) {
  const d = document.createElement('div'); d.innerHTML = urshortsCardHtml(item, eager); return d.querySelector('a')!
}
/** 아이콘(svg)만 빼고 — 요소 태그·클래스·글자·img 속성을 같은 순서로 평탄화한다. */
function shape(root: Element): string[] {
  const out: string[] = []
  const walk = (el: Element) => {
    if (el.tagName === 'SVG' || el.tagName === 'svg') return
    const attrs = el.tagName === 'IMG' ? ` src=${el.getAttribute('src')} loading=${el.getAttribute('loading')}` : el.tagName === 'A' ? ` href=${el.getAttribute('href')}` : ''
    out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '')}${attrs}`)
    for (const c of Array.from(el.children)) walk(c)
  }
  walk(root)
  return out
}

describe('① 카드 — 서버 HTML 과 React 가 같은 모양', () => {
  it.each([['전부 있는 카드', RICH], ['제목·가게·가격 없는 카드', BARE]])('%s', (_n, item) => {
    const r = reactCard(item, true), s = serverCard(item, true)
    expect(shape(s)).toEqual(shape(r))
    expect(s.textContent!.replace(/\s+/g, ' ').trim()).toBe(r.textContent!.replace(/\s+/g, ' ').trim())
    expect(s.getAttribute('aria-label')).toBe(r.getAttribute('aria-label'))
  })
  it('eager/lazy 가 같이 간다', () => {
    expect(serverCard(RICH, false).querySelector('img')!.getAttribute('loading')).toBe(reactCard(RICH, false).querySelector('img')!.getAttribute('loading'))
  })
})

describe('②③ 첫 화면 — 칩·격자·폴백', () => {
  it('도시 칩은 3도시라 그리고, 종류 칩은 2종류라 그린다 · 전체 N · 카드 3장 · 설명 한 줄', () => {
    const html = buildUrShortsFirstScreen(payload(ITEMS), LOADER)
    const d = document.createElement('div'); d.innerHTML = html
    expect(d.querySelectorAll(`div[aria-label="도시"] button`).length).toBe(4) // 전체 + 부산·서울·제주
    expect(d.querySelectorAll(`div[aria-label="종류"] button`).length).toBe(3) // 전체 + 식사·미용
    expect(d.querySelectorAll('ul > li').length).toBe(3)
    expect(d.querySelector('header')!.textContent).toContain('3편')
    expect(d.querySelector('p')!.textContent).toBe(URSHORTS_FS_DESC)
    expect(readRaw('src/pages/UrShortsBrowsePage.tsx')).toContain(URSHORTS_FS_DESC) // 화면과 같은 글자
    expect(html.startsWith('<div id="ur-first-screen">')).toBe(true); expect(html).toContain('min-height:34dvh')
  })
  it('종류가 하나뿐이면 종류 칩 줄을 안 그린다(facets.ts 의 MIN_FACETS_TO_SHOW 와 같은 규칙)', () => {
    const d = document.createElement('div'); d.innerHTML = buildUrShortsFirstScreen(payload([RICH, BARE]), LOADER)
    expect(d.querySelector('div[aria-label="종류"]')).toBeNull()
    expect(d.querySelector('div[aria-label="도시"]')).not.toBeNull()
  })
  it('0편·깨진 payload 면 "" (로더 폴백)', () => {
    expect(buildUrShortsFirstScreen(payload([]), LOADER)).toBe(''); expect(buildUrShortsFirstScreen('{x', LOADER)).toBe(''); expect(buildUrShortsFirstScreen(null, LOADER)).toBe('')
  })
  it('페이지·머리·격자 클래스가 화면 소스와 같다', () => {
    const src = readRaw('src/pages/UrShortsBrowsePage.tsx')
    for (const k of ['page', 'header', 'back', 'h1', 'dot', 'count', 'desc', 'body', 'chipRow', 'chipOn', 'chipOff', 'grid'] as const) expect(src, k).toContain(URSHORTS_FS_CLASS[k])
    expect(src).toContain(`\`shrink-0 inline-flex items-center gap-1 h-9 px-4 rounded-full text-[13px] font-medium transition-colors \${className}\``)
  })
})

describe('④⑤⑥ 배선', () => {
  it('워커: 폰 UA · 시드 있음 → 첫 화면(없으면 로더) · PC 는 안 그린다', () => {
    const w = readRaw('src/worker/index.ts')
    expect(w).toMatch(/else if \(url\.pathname === '\/urshorts' && ssrPayload && shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\) \{ const shortsFirst = buildUrShortsFirstScreen\(ssrPayload, urdealLoaderHtml\);[^\n]*shortsFirst \? shortsFirst \+ shortsNs : shortsNs \+ urdealLoaderHtml/)
  })
  it('CSS-first 표면 · critical CSS 표면에 등록됐다', () => {
    expect(cssFirstApplies('/urshorts', MOBILE_UA)).toBe(true)
    expect(criticalSurfaceOf('/urshorts')).toBe('urshorts')
    const gen = readRaw('scripts/generate-critical-css.mjs')
    expect(gen).toMatch(/urshorts: \['src\/worker\/utils\/urshorts-first-screen\.ts'\]/)
    expect(gen).toMatch(/ROOTS = \[[\s\S]*'src\/worker\/utils\/urshorts-first-screen\.ts'/)
  })
  it('시드로 첫 렌더한 카드엔 등장 애니메이션을 안 건다(서버가 이미 보여 준 것이 다시 커지면 깜빡임)', () => {
    const src = readRaw('src/pages/UrShortsBrowsePage.tsx')
    expect(src).toMatch(/const \[seeded\] = useState\(\(\) => items !== null\)/)
    expect(src).toContain("className={seeded ? undefined : 'ur-vc-in'}")
  })
})
