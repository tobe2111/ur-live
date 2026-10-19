/**
 * 🖼️ 교환권 머리 배너를 **서버 첫 화면에** 〔2026-10-18〕
 *
 * ## 무엇이 틀렸나 (라이브 실측 — 아이폰 13 · 느린 4G · CPU 4배)
 * `/vouchers` 의 가장 큰 그림(LCP)은 머리 배너 사진인데, 그 요청이 **3.8초에야** 출발했다.
 * 화면 코드가 다 돌고 → `/api/banners` 응답이 온 뒤에야 `<img>` 가 생겼기 때문이다. 판(196px)은 서버가
 * 이미 세워 두니 아래는 안 밀렸지만 **사진만 늦어** LCP 가 4.3초였다(보통 LTE 1.3초).
 *
 * ## 처방 — 홈 상단 배너(2026-10-14)와 같은 길
 *   ① 워커가 `/api/banners`(cron 예열 키 — 새 캐시 키 0)를 보조 시드로 받아 `__SSR_INITIAL_BANNERS__` 로 싣는다
 *   ② 서버 첫 화면이 판 **안에** 첫 장을 그린다(클래스·사진 주소는 부품과 **같은 상수·같은 함수**)
 *   ③ 앱은 응답 전 그 시드로 첫 렌더부터 같은 배너를 그린다
 *
 * ## 못 막는 것
 * - jsdom 엔 레이아웃이 없다 — 판 높이가 고정(196)이라 밀림은 원리상 0 이지만 LCP 는 라이브 프레임이 판정한다.
 * - 어드민이 배너를 바꾼 직후 최대 몇 분은 서버 첫 화면과 응답이 다를 수 있다(엣지 TTL).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})) } }))

import VouchersHero from '@/pages/vouchers/VouchersHero'
import { buildVouchersFirstScreen, VOUCHERS_FS_CLASS } from '@/worker/utils/vouchers-first-screen'
import { bannersOfSlot, stripBannerImageUrl, BANNERS_SEED_PATH, STRIP_BANNER_MAX } from '@/shared/home-strip-banners'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(fs.readFileSync(p, 'utf8'))
const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'
const ROW = { id: 1, name: '아메리카노', price: 2000, original_price: 4500, image_url: 'https://bizimg.giftishow.com/a.jpg', brand_name: '메가', category: '커피/음료', deal_only: 1 }
const SEED = JSON.stringify({ success: true, data: [ROW] })
const BANNERS = [
  { id: 2, title: '홈 띠 배너', image_url: 'https://media.ur-team.com/uploads/s.webp', link_url: null, banner_slot: 'strip', display_order: 1 },
  { id: 8, title: '차곡차곡 모은 딜로\n커피 어때요?', image_url: 'https://media.ur-team.com/uploads/v1.jpg', link_url: '/vouchers?category=커피/음료', banner_slot: 'vouchers', display_order: 1 },
  { id: 9, title: '편의점 간식,\n딜로 가볍게', image_url: 'https://media.ur-team.com/uploads/v2.jpg', link_url: null, banner_slot: 'vouchers', display_order: 2 },
]
const bannersJson = (rows: unknown[]) => JSON.stringify({ success: true, data: rows })

function workerHero(bj?: string | null): Element {
  const host = document.createElement('div')
  host.innerHTML = buildVouchersFirstScreen(SEED, LOADER, 'n', bj)
  const hero = host.querySelector(`[class="${VOUCHERS_FS_CLASS.hero}"]`)
  expect(hero, '배너 판이 없다').toBeTruthy()
  return hero!
}

function putSeed(json: string) {
  const el = document.createElement('script')
  el.id = '__SSR_INITIAL_BANNERS__'; el.type = 'application/json'; el.textContent = json
  document.body.appendChild(el)
}
afterEach(() => { cleanup(); document.getElementById('__SSR_INITIAL_BANNERS__')?.remove() })

describe('① 서버 첫 화면이 판 안에 첫 교환권 배너를 그린다', () => {
  it('교환권 자리 첫 장의 사진이 HTML 에 있다 — 화면 코드를 기다리지 않고 출발한다', () => {
    const hero = workerHero(bannersJson(BANNERS))
    const img = hero.querySelector('img')
    expect(img, '판 안에 사진이 없다 — 화면 코드가 다 돌 때까지 배너 사진이 출발 못 한다(LCP 4.3s)').toBeTruthy()
    expect(img!.getAttribute('src')).toBe(stripBannerImageUrl(BANNERS[1].image_url, 'vouchers'))
    expect(img!.getAttribute('fetchpriority')).toBe('high')
    expect(hero.textContent).toContain('커피 어때요?')
    expect(hero.textContent, '홈 띠(strip) 배너를 교환권에 그리면 안 된다').not.toContain('홈 띠 배너')
  })
  it('시드가 없거나 교환권 배너가 0장이면 종전처럼 빈 판', () => {
    expect(workerHero(null).innerHTML).toBe('')
    expect(workerHero(bannersJson([BANNERS[0]])).innerHTML).toBe('')
    expect(workerHero('{깨진 json').innerHTML).toBe('')
  })
  it('제목은 HTML 탈출', () => {
    const hero = workerHero(bannersJson([{ ...BANNERS[1], title: 'a<b>x</b>&"' }]))
    expect(hero.querySelector('b')).toBeNull()
    expect(hero.textContent).toContain('a<b>x</b>&"')
  })
  it('자리 거르기·장수 상한·모양 검사', () => {
    expect(bannersOfSlot({ success: true, data: BANNERS }, 'vouchers').map(b => b.id)).toEqual([8, 9])
    expect(bannersOfSlot({ success: true, data: [{ id: 'x', banner_slot: 'vouchers' }, null] }, 'vouchers')).toEqual([])
    expect(bannersOfSlot(null, 'vouchers')).toEqual([])
    const many = Array.from({ length: 9 }, (_, i) => ({ ...BANNERS[1], id: 100 + i }))
    expect(bannersOfSlot({ success: true, data: many }, 'vouchers')).toHaveLength(STRIP_BANNER_MAX)
  })
})

describe('② 앱 첫 렌더 = 서버 첫 화면 (응답 오기 전)', () => {
  function renderHero() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={qc}><MemoryRouter><VouchersHero><div /></VouchersHero></MemoryRouter></QueryClientProvider>,
    )
  }
  it('시드가 있으면 첫 렌더부터 같은 카드·같은 사진 주소', () => {
    putSeed(bannersJson(BANNERS))
    const { container } = renderHero()
    const r = container.querySelector('[aria-roledescription="carousel"]')
    expect(r, '앱이 첫 렌더에 배너를 안 그렸다 — 서버가 그린 배너가 사라졌다 다시 나타난다').toBeTruthy()
    const w = workerHero(bannersJson(BANNERS)).querySelector('[aria-roledescription="carousel"]')!
    const toks = (el: Element | null | undefined) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).sort()
    expect(toks(w)).toEqual(toks(r))
    const wRail = w.querySelector('.relative > div'), rRail = r!.querySelector('.relative > div')
    expect(toks(wRail), '레일 클래스가 다르다').toEqual(toks(rRail))
    const wCard = wRail!.firstElementChild, rCard = rRail!.firstElementChild
    expect(toks(wCard), '카드 클래스가 다르다').toEqual(toks(rCard))
    expect(wCard!.getAttribute('href')).toBe(rCard!.getAttribute('href'))
    const wImg = wCard!.querySelector('img')!, rImg = rCard!.querySelector('img')!
    expect(wImg.getAttribute('src'), '사진 주소가 다르면 같은 사진을 두 번 받는다').toBe(rImg.getAttribute('src'))
    expect(toks(wImg)).toEqual(toks(rImg))
    expect(toks(wCard!.querySelector('strong'))).toEqual(toks(rCard!.querySelector('strong')))
  })
})

describe('③ 배선', () => {
  const W = code('src/worker/index.ts')
  it('교환권(쿼리 없음)만 `/api/banners` 를 보조 시드로 받는다 — 예열 키와 같은 경로', () => {
    expect(BANNERS_SEED_PATH).toBe('/api/banners')
    expect(code('src/worker/cron/cache-prewarm.ts')).toContain("'/api/banners'")
    expect(W).toMatch(/if \(!url\.search\) ssrExtra = \{ slot: 'BANNERS', path: BANNERS_SEED_PATH \}/)
  })
  it('보조 시드 script id 는 슬롯 이름을 따른다 — 홈(SECTIONS) 은 종전 그대로', () => {
    expect(W).toMatch(/__SSR_INITIAL_\$\{ssrExtra\?\.slot \?\? 'SECTIONS'\}__/)
  })
  it('앱이 그 시드를 읽는다', () => {
    expect(code('src/components/home/useHomeBanners.ts')).toMatch(/getElementById\('__SSR_INITIAL_BANNERS__'\)/)
  })
})
