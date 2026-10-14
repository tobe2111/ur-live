/**
 * 🎫 홈 상단 배너를 **서버 첫 화면에** 〔2026-10-14〕
 *
 * ## 무엇이 틀렸나 (라이브 실측 — 아이폰 13 에뮬, 첫 방문)
 * 홈 첫 섹션 패널이 2초쯤 **y 132 → 329** 로 197px 내려앉았다(CLS **0.197**, 위치 유무와 무관하게 매번).
 * 원인은 상단 배너(`HomeBannerStrip` strip)다 — 첫 섹션 **위**에 오는데 서버 첫 화면의 시드
 * (`/api/sections`)에 없어서, 마운트 뒤 `/api/banners` 가 도착하면 끼어들었다. 2026-10-08
 * `home-first-screen.ts` 머리말이 *"어드민이 자리를 고르면 카드가 배너 높이만큼 내려간다(별건)"* 이라고
 * 미리 적어 둔 바로 그 일이 대표가 배너를 등록하자 현실이 됐다. 에러는 0 이다.
 *
 * ## 처방 — 세 자리가 **같은 배너**를 본다
 *   ① `/api/sections` 응답이 `strip_banners` 를 싣는다(`/api/banners` 와 **같은 조회 함수**)
 *   ② 서버 첫 화면이 그 첫 장을 그린다(클래스는 부품과 **같은 상수** `STRIP_CLS`)
 *   ③ 앱은 응답이 오기 전 그 시드로 첫 렌더부터 배너를 그린다(`placeholderData`)
 *
 * ## 못 막는 것
 * - jsdom 은 레이아웃이 없어 197px 를 못 잰다 → 같은 클래스·같은 사진 URL 로 대신 본다.
 *   실제 밀림은 라이브 프레임 측정이 판정한다(CLS 0.197 → 0 이 E4 기준).
 * - 어드민이 배너를 바꾼 직후 최대 2분은 서버 첫 화면과 `/api/banners` 가 다를 수 있다(엣지 TTL).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api', () => ({
  // 응답이 **영영 안 오는** 상태 = 마운트 직후. 이때 무엇이 그려지는지가 시험 대상이다.
  default: { get: vi.fn(() => new Promise(() => {})) },
}))

import HomeBannerStrip from '@/components/home/HomeBannerStrip'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'
import { STRIP_CLS, STRIP_BANNER_MAX, stripBannersOf } from '@/shared/home-strip-banners'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(fs.readFileSync(p, 'utf8'))
const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'

const BANNERS = [
  { id: 11, title: '서울에서 쓰는 이용권', description: '동네 맛집 할인', image_url: 'https://media.ur-team.com/uploads/b/seoul.jpg', link_url: 'https://urdeal.kr/region/서울', banner_slot: 'strip', display_order: 1 },
  { id: 12, title: '커피·편의점 교환권', description: null, image_url: 'https://media.ur-team.com/uploads/b/cafe.jpg', link_url: null, banner_slot: 'strip', display_order: 2 },
]
const PRODUCT = { id: 2915, name: '홍대 돈가스 세트', image_url: 'https://media.ur-team.com/x.jpg', price: 7500, category: 'meal_voucher', deal_only: 0 }
const seed = (strip?: unknown[]) => JSON.stringify({
  success: true,
  data: [{ id: 2, title: '이런 이용권은 어떠세요?', subtitle: '많이 팔린 순으로 모았어요', products: [PRODUCT] }],
  ...(strip ? { strip_banners: strip } : {}),
})

function workerDom(json: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = buildHomeFirstScreen(json, LOADER)
  return host
}

function putSeed(json: string) {
  const el = document.createElement('script')
  el.id = '__SSR_INITIAL_SECTIONS__'
  el.type = 'application/json'
  el.textContent = json
  document.body.appendChild(el)
}

function renderStrip() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><HomeBannerStrip variant="strip" /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => document.getElementById('__SSR_INITIAL_SECTIONS__')?.remove())
afterEach(() => { cleanup(); document.getElementById('__SSR_INITIAL_SECTIONS__')?.remove() })

describe('① 서버 첫 화면이 배너를 그린다 — 첫 섹션 **위**', () => {
  it('배너가 있으면 첫 장이 패널보다 먼저 나온다', () => {
    const host = workerDom(seed(BANNERS))
    const banner = host.querySelector('[aria-roledescription="carousel"]')
    const panel = host.querySelector('section.ur-home-panel')
    expect(banner, '서버 첫 화면에 배너가 없다 — 마운트 뒤 끼어들며 카드를 197px 민다').toBeTruthy()
    expect(panel).toBeTruthy()
    expect(banner!.compareDocumentPosition(panel!) & Node.DOCUMENT_POSITION_FOLLOWING, '배너는 첫 섹션 위여야 한다').toBeTruthy()
    expect(banner!.textContent).toContain('서울에서 쓰는 이용권')
  })

  it('배너가 없으면 아무것도 안 그린다 (종전 첫 화면 그대로)', () => {
    const host = workerDom(seed())
    expect(host.querySelector('[aria-roledescription="carousel"]')).toBeNull()
    expect(host.querySelector('section.ur-home-panel')).toBeTruthy()
  })

  it('모양이 이상한 배너 행은 버린다 — 깨진 시드가 홈을 못 열게 하면 안 된다', () => {
    expect(stripBannersOf({ strip_banners: [{ id: 'x' }, null, { title: '제목만' }] })).toEqual([])
    expect(stripBannersOf({ strip_banners: 'nope' })).toEqual([])
    expect(stripBannersOf(null)).toEqual([])
    const many = Array.from({ length: 9 }, (_, i) => ({ ...BANNERS[0], id: i + 1 }))
    expect(stripBannersOf({ strip_banners: many })).toHaveLength(STRIP_BANNER_MAX)
  })

  it('제목·설명은 HTML 탈출 — 어드민 입력이 마크업이 되지 않는다', () => {
    const host = workerDom(seed([{ ...BANNERS[0], title: 'a<b>x</b>&"', description: '<img src=x onerror=1>' }]))
    const banner = host.querySelector('[aria-roledescription="carousel"]')!
    expect(banner.querySelector('b')).toBeNull()
    expect(banner.querySelectorAll('img')).toHaveLength(1) // 배너 사진 하나뿐
    expect(banner.textContent).toContain('a<b>x</b>&"')
  })
})

describe('② 앱 첫 렌더 = 서버 첫 화면 (응답 오기 전)', () => {
  it('시드가 있으면 응답을 기다리지 않고 첫 렌더부터 배너를 그린다', () => {
    putSeed(seed(BANNERS))
    const { container } = renderStrip()
    expect(container.textContent, '앱이 첫 렌더에 배너를 안 그렸다 — 서버가 그린 배너가 사라졌다 다시 나타난다').toContain('서울에서 쓰는 이용권')
  })

  it('시드가 없으면 종전처럼 아무것도 안 그린다', () => {
    const { container } = renderStrip()
    expect(container.innerHTML).toBe('')
  })

  it('카드·사진·레일 클래스와 사진 URL 이 서버와 **같다** (갈리면 마운트 때 튄다)', () => {
    putSeed(seed(BANNERS))
    const { container } = renderStrip()
    const host = workerDom(seed(BANNERS))
    const w = host.querySelector('[aria-roledescription="carousel"]')!
    const r = container.querySelector('[aria-roledescription="carousel"]')!
    const toks = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).sort()
    expect(toks(w)).toEqual(toks(r))
    const wRail = w.querySelector('.relative > div')
    const rRail = r.querySelector('.relative > div')
    expect(toks(wRail)).toEqual(toks(rRail))
    const wCard = wRail!.firstElementChild
    const rCard = rRail!.firstElementChild
    expect(toks(wCard), '첫 카드 클래스가 다르다').toEqual(toks(rCard))
    expect(wCard!.getAttribute('href'), '링크가 다르다').toBe(rCard!.getAttribute('href'))
    const wImg = wCard!.querySelector('img')!, rImg = rCard!.querySelector('img')!
    expect(wImg.getAttribute('src'), '사진 URL 이 다르면 같은 사진을 두 번 받는다').toBe(rImg.getAttribute('src'))
    expect(toks(wImg)).toEqual(toks(rImg))
    expect(toks(wCard!.querySelector('strong'))).toEqual(toks(rCard!.querySelector('strong')))
  })
})

describe('③ 배선 — 세 자리가 같은 배너를 본다', () => {
  const SECTIONS = code('src/features/sections/api/sections.routes.ts')
  const BANNERS_ROUTE = code('src/features/banners/api/banners.routes.ts')
  const STRIP = code('src/components/home/HomeBannerStrip.tsx')

  it('섹션 응답이 `/api/banners` 와 같은 조회 함수로 strip 배너를 싣는다', () => {
    expect(SECTIONS).toMatch(/listActiveBanners\(DB, 'strip'\)/)
    expect(SECTIONS).toMatch(/strip_banners:/)
  })

  it('`/api/banners` 도 그 함수를 쓴다 — SQL 이 두 벌이면 기간·자리 규칙이 갈린다', () => {
    expect(BANNERS_ROUTE).toMatch(/listActiveBanners\(DB, slotFilter/)
    expect((BANNERS_ROUTE.match(/FROM banners\b/g) || []).length, '공개 GET 쪽 배너 SELECT 는 함수 하나여야 한다').toBe(1)
  })

  it('부품이 장수 상한·치수 클래스를 공용 상수에서 받는다 (손으로 적으면 서버와 갈린다)', () => {
    expect(STRIP).toMatch(/banners\.slice\(0, STRIP_BANNER_MAX\)/)
    expect(STRIP).toMatch(/className=\{STRIP_CLS\.root\}/)
    expect(STRIP).toMatch(/STRIP_CLS\.card\}/)
    expect(STRIP).not.toMatch(/aspect-\[2\/1\]/)
    expect(STRIP_CLS.card).toMatch(/aspect-\[2\/1\]/)
  })
})
