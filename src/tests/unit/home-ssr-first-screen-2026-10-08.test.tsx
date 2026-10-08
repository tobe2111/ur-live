/**
 * 🏠 모바일 홈의 **서버가 그리는 첫 화면** 〔2026-10-08〕
 *
 * 대표: *"처음에 유어딜 페이지 들어올 때 만큼은 로딩 장면 없이 바로 페이지가 나타날 수 없나?"*
 * → *"그럼 그 홈 로딩 말고도 전체적으로 다른 페이지들은?"* → *"모두 다 하자"* → *"진행해줘"*.
 *
 * ## 이 시험이 지키는 것 — **두 벌이 갈리는 것**
 * 워커는 React 를 못 돌린다(번들 gzip 게이트 — `home-first-screen.ts` 머리말에 산수가 있다).
 * 그래서 카드 마크업이 **두 벌**이 된다. 이 레포가 반복해 당한 클래스이고, 갈려도 **에러가
 * 안 난다** — 마운트 때 그 자리가 조용히 튀기만 한다.
 *
 * ⇒ 그래서 이 시험은 소스 문자열을 비교하지 않고 **진짜 `GroupBuyFeedCard` 를 렌더해서**
 *   워커가 그린 HTML 과 대조한다. 클래스 한 토큰, 사진 속성 하나가 달라지면 빨간불이다.
 *
 * ## 못 막는 것
 * - jsdom 은 레이아웃이 없어 **픽셀 높이를 못 잰다** → "같은 클래스·같은 줄 순서"로 대신 본다.
 *   실제 밀림은 프레임 캡처가 판정한다(`out/firstpaint.mjs` · `layout-shift` 워크플로).
 * - 크롬(3줄)과 섹션 머리글은 렌더로 못 잰다(`MobileHomePage` 는 측위·쿼리·i18n 에 매달려 있다)
 *   → 그 자리는 **페이지 소스에서 클래스를 파싱해** 대조한다(2026-09-15 `/pass/` 와 같은 방식).
 * - 배너(`HomeBannerStrip`)는 시드에 없다 — 어드민이 자리를 고르면 카드가 그만큼 내려간다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import {
  buildHomeFirstScreen, HOME_FS_CLASS, homeCardSizes, starFillPct,
} from '@/worker/utils/home-first-screen'
import { HOME_CARD_IMG_WIDTH_BASE, HOME_CARD_ABOVE_FOLD, HOME_CARD_BASE_QUERY } from '@/shared/home-card-image'
import { buildHomeCardPreloadLinks } from '@/worker/utils/home-card-preload'
import { DEAL_CAT_LABELS } from '@/shared/deal-cats'
import { stripComments } from '../helpers/source-text'

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const code = (p: string) => stripComments(read(p))

const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'

/** 라이브 시드에서 가져온 모양(2026-10-08 `/api/sections` 실측). */
const RICH = {
  id: 2764,
  name: '평일 1박 숙박권 (프리미엄 계곡 앞 독채)',
  restaurant_name: '연정풀빌라',
  restaurant_address: '경북 경주시 손곡3길 37-14',
  image_url: 'https://media.ur-team.com/uploads/seller/26/2026-10/abc.jpg',
  price: 229000,
  original_price: 298000,
  discount_rate: 0,
  avg_rating: 4.7,
  review_count: 30,
  category: 'stay_voucher',
  deal_only: 0,
}
/** 최소 모양 — 매장명·주소·평점·할인 전부 없음(줄이 줄어드는 쪽). */
const BARE = {
  id: 2915,
  name: '홍대 돈가스 세트',
  image_url: 'https://media.ur-team.com/uploads/seller/26/2026-10/x.jpg',
  price: 7500,
  category: 'meal_voucher',
  deal_only: 0,
}

const seedJson = (products: unknown[], title = '지금 인기 이용권', subtitle: string | null = '많이 팔린 순으로 모았어요') =>
  JSON.stringify({ success: true, data: [{ id: 2, title, subtitle, products }] })

/** 워커 HTML 을 DOM 으로 — 첫 카드(`<a>`)를 돌려준다. */
function workerCard(p: unknown): HTMLAnchorElement {
  const host = document.createElement('div')
  host.innerHTML = buildHomeFirstScreen(seedJson([p]), LOADER)
  const a = host.querySelector('#ur-first-screen a')
  if (!a) throw new Error('워커가 카드를 안 그렸다')
  return a as HTMLAnchorElement
}

/** 진짜 컴포넌트 렌더 — 카드의 `<a>`. */
function reactCard(p: Record<string, unknown>): HTMLAnchorElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <GroupBuyFeedCard p={p as any} imgWidth={HOME_CARD_IMG_WIDTH_BASE} aboveFold />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const a = container.querySelector('a')
  if (!a) throw new Error('컴포넌트가 카드를 안 그렸다')
  return a as HTMLAnchorElement
}

/** CSS 는 토큰 순서를 안 보므로 집합으로 비교한다(클라는 템플릿 때문에 공백이 남는다). */
const tokens = (cls: string) => cls.trim().split(/\s+/).filter(Boolean).sort()

describe('① 카드 — 워커 HTML 과 진짜 컴포넌트가 같은 클래스를 쓴다', () => {
  for (const [label, p] of [['정보가 많은 카드', RICH], ['최소 카드', BARE]] as const) {
    it(`🔴 ${label}: 링크·사진칸·본문 클래스가 같다`, () => {
      const w = workerCard(p)
      const r = reactCard(p as Record<string, unknown>)
      expect(tokens(w.className)).toEqual(tokens(r.className))
      expect(w.getAttribute('href')).toBe(r.getAttribute('href'))

      const wm = w.firstElementChild as HTMLElement
      const rm = r.firstElementChild as HTMLElement
      expect(tokens(wm.className)).toEqual(tokens(rm.className))

      const wb = w.children[1] as HTMLElement
      const rb = r.children[1] as HTMLElement
      expect(tokens(wb.className)).toEqual(tokens(rb.className))
    })

    it(`🔴 ${label}: 본문 **줄 순서와 줄마다의 클래스**가 같다 (한 줄이 늘면 그만큼 밀린다)`, () => {
      const rows = (a: HTMLAnchorElement) =>
        [...(a.children[1] as HTMLElement).children].map((c) => tokens(c.className).join(' '))
      expect(rows(workerCard(p))).toEqual(rows(reactCard(p as Record<string, unknown>)))
    })
  }

  it('🔴 사진 속성이 **글자까지** 같다 (하나만 달라도 같은 사진을 두 번 받는다)', () => {
    const pick = (a: HTMLAnchorElement) => {
      const img = a.querySelector('img')
      if (!img) throw new Error('사진이 없다')
      return {
        src: img.getAttribute('src'),
        srcset: img.getAttribute('srcset'),
        sizes: img.getAttribute('sizes'),
        loading: img.getAttribute('loading'),
        fetchpriority: img.getAttribute('fetchpriority'),
        decoding: img.getAttribute('decoding'),
        cls: tokens(img.className).join(' '),
      }
    }
    expect(pick(workerCard(RICH))).toEqual(pick(reactCard(RICH as Record<string, unknown>)))
  })

  it('🔴 글자(매장·제목·주소·평점·가격)가 같다', () => {
    const text = (a: HTMLAnchorElement) =>
      [...(a.children[1] as HTMLElement).querySelectorAll('span')]
        .map((s) => s.textContent?.trim())
        .filter((t) => t && t !== '★★★★★')
    // 클라에만 있는 거리(`N km`)는 내 위치 기준이라 서버가 모른다 — 시드에 좌표가 없으면 양쪽 동일.
    expect(text(workerCard(RICH))).toEqual(text(reactCard(RICH as Record<string, unknown>)))
  })

  /**
   * 🩸 첫 판은 `getAttribute('style')` 을 비교했는데 **늘 빨간불**이었다 — React 는
   *   `width: 94%;`(공백·세미콜론)로 쓰고 워커는 `width:94%` 로 쓴다. 같은 값인데 글자가 다르다.
   *   ⇒ 비교는 **파싱된 값**(`style.width`)으로 한다. 지키려는 것은 "같은 비율"이지 "같은 글자"가 아니다.
   */
  it('🔴 별 채움 비율이 같다 (`StarRating` 과 같은 식)', () => {
    const w = workerCard(RICH).querySelector('[role="img"] span:nth-child(2)') as HTMLElement
    const r = reactCard(RICH as Record<string, unknown>).querySelector('[role="img"] span:nth-child(2)') as HTMLElement
    expect(w.style.width).toBe(r.style.width)
    expect(w.style.width).not.toBe('') // 둘 다 비면 "같다"가 아무것도 안 지킨다
    expect(starFillPct(4.7)).toBe((4.7 / 5) * 100)
  })
})

describe('② 경계 — 서버가 그리는 범위', () => {
  it('🔴 첫 섹션의 카드를 **above-fold 개수만큼만** 그린다', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...BARE, id: 100 + i }))
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seedJson(many), LOADER)
    expect(host.querySelectorAll('#ur-first-screen a').length).toBe(HOME_CARD_ABOVE_FOLD)
  })

  it('🔴 둘째 섹션·피드·유어쇼츠는 안 그린다 (첫 화면 밖)', () => {
    const seed = JSON.stringify({
      success: true,
      data: [
        { id: 2, title: '지금 인기 이용권', products: [BARE] },
        { id: 4, title: '주말에 떠나는 숙소', products: [RICH] },
      ],
    })
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seed, LOADER)
    expect(host.querySelectorAll('#ur-first-screen section').length).toBe(1)
    expect(host.querySelector('#ur-first-screen')?.textContent).not.toContain('주말에 떠나는 숙소')
  })

  it('🔴 위치 이름을 **지어내지 않는다** (저장된 지역·측위는 서버가 모른다)', () => {
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seedJson([BARE]), LOADER)
    const label = host.querySelector(`#ur-first-screen .${CSS.escape('text-[24px]')}`)
    expect(label).toBeTruthy()
    expect(label?.textContent?.trim()).toBe('') // &nbsp; → 줄 높이만
    const txt = host.querySelector('#ur-first-screen')?.textContent || ''
    expect(txt).not.toContain('전국')
    expect(txt).not.toContain('내 주변')
  })

  it('🔴 거리(km)와 찜 하트는 안 그린다 (클라 상태 · absolute)', () => {
    const withLoc = { ...RICH, restaurant_lat: 37.5, restaurant_lng: 127.0 }
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seedJson([withLoc]), LOADER)
    const txt = host.querySelector('#ur-first-screen')?.textContent || ''
    expect(txt).not.toMatch(/\d+km/)
    expect(host.querySelectorAll('#ur-first-screen button').length).toBe(0)
  })

  it('🔴 그린 내용 **아래**에 짧아진 로더가 붙는다', () => {
    const out = buildHomeFirstScreen(seedJson([BARE]), LOADER)
    expect(out).toContain('min-height:34dvh')
    expect(out).not.toContain('min-height:100dvh')
    expect(out.indexOf('id="ur-first-screen"')).toBeLessThan(out.indexOf('ur-loader'))
  })
})

describe('③ 폴백 — 못 그리면 빈 문자열(호출부가 종전 로더로 되돌아간다)', () => {
  it.each([
    ['시드가 JSON 이 아니다', 'not json'],
    ['data 가 없다', JSON.stringify({ success: true })],
    ['섹션이 0건', JSON.stringify({ success: true, data: [] })],
    ['상품이 0건', JSON.stringify({ success: true, data: [{ id: 2, title: 'x', products: [] }] })],
    ['제목이 없다', JSON.stringify({ success: true, data: [{ id: 2, products: [BARE] }] })],
  ])('🔴 %s → 빈 문자열', (_label, seed) => {
    expect(buildHomeFirstScreen(seed, LOADER)).toBe('')
  })
})

describe('④ 이스케이프 — 시드는 DB 문자열이다', () => {
  it('🔴 제목·매장명의 꺾쇠·따옴표가 태그가 되지 않는다', () => {
    const evil = { ...BARE, name: '<img src=x onerror="alert(1)">', restaurant_name: '"가게\'' }
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seedJson([evil]), LOADER)
    const fs0 = host.querySelector('#ur-first-screen') as HTMLElement
    expect(fs0.querySelectorAll('img').length).toBe(1) // 카드 사진 하나뿐 — 주입된 img 0
    expect(fs0.textContent).toContain('<img src=x')
  })
})

describe('⑤ 크롬·섹션 머리글 — 페이지 소스에서 파싱해 대조한다', () => {
  const home = code('src/pages/mobile-home/MobileHomePage.tsx')
  const sections = code('src/components/home/HomeSections.tsx')
  const loc = code('src/pages/pc-home/PcHomeLocationBar.tsx')

  it.each([
    ['chrome', () => home],
    ['topRow', () => home],
    ['locRow', () => home],
    ['viewToggle', () => home],
    ['viewOn', () => home],
    ['viewOff', () => home],
    ['catRow', () => home],
    ['catNav', () => home],
    ['catBase', () => home],
    ['catOn', () => home],
    ['catOff', () => home],
    ['panel', () => sections],
    ['secHead', () => sections],
    ['secTitle', () => sections],
    ['secSub', () => sections],
    ['grid', () => sections],
    ['locTrigger', () => loc],
    ['locLabel', () => loc],
  ] as const)('🔴 %s 클래스가 페이지 소스에 그대로 있다', (key, src) => {
    const want = HOME_FS_CLASS[key as keyof typeof HOME_FS_CLASS] as string
    /**
     * 🩸 소스에서 **삼항·템플릿으로 조립되는** 클래스는 한 덩어리로 안 나타난다 — 그대로 찾으면
     *   코드가 멀쩡한데 빨간불이 난다(`locLabel` 이 실제로 그랬다). 그 둘만 조각으로 쪼개 대조한다.
     *   ⚠️ 조각이 **둘 다** 있어야 통과다(한쪽만 보면 나머지 절반이 조용히 갈린다).
     */
    const needles =
      key === 'grid' ? [want.split(' gap-')[0]]
        : key === 'locLabel' ? ['text-[24px] font-black tracking-[-0.02em] text-gray-900 dark:text-white', 'max-w-[220px] truncate']
          : [want]
    for (const n of needles) {
      expect(src(), `${key} 가 갈렸다(${n}) — 마운트 때 그 자리가 튄다`).toContain(n)
    }
  })

  it('🔴 카테고리 라벨이 화면과 같은 표에서 온다', () => {
    const host = document.createElement('div')
    host.innerHTML = buildHomeFirstScreen(seedJson([BARE]), LOADER)
    const nav = host.querySelector('#ur-first-screen nav') as HTMLElement
    expect([...nav.children].map((c) => c.textContent)).toEqual(DEAL_CAT_LABELS.map((c) => c.label))
    expect(home).toContain('DEAL_CATS.map')
  })

  /**
   * 🖼️ **preload 와 같은 URL 인가** — 이 수리의 값이 통째로 여기에 달려 있다.
   *   워커는 2026-08-27 부터 첫 4장을 `<link rel=preload as=image>` 로 당긴다. 첫 화면의
   *   `<img>` 가 **한 글자라도** 다른 URL 을 쓰면 브라우저는 그 preload 를 버리고 같은 사진을
   *   다시 받는다 — 느려지고 트래픽만 두 배다(에러는 안 난다).
   */
  it('🔴 첫 화면 사진이 워커 preload 와 **같은 URL**이다', () => {
    const seed = seedJson([RICH])
    const img = workerCard(RICH).querySelector('img') as HTMLImageElement
    const base = buildHomeCardPreloadLinks(seed).find((l) => l.includes(HOME_CARD_BASE_QUERY))
    expect(base, 'base 폭 preload 링크가 없다').toBeTruthy()
    const attr = (name: string) => base!.match(new RegExp(`${name}="([^"]+)"`))?.[1]
    expect(img.getAttribute('src')).toBe(attr('href'))
    expect(img.getAttribute('srcset')).toBe(attr('imagesrcset'))
  })

  it('🔴 사진 `sizes` 식이 `DealCardMedia` 와 같다', () => {
    const media = code('src/components/deal/DealCardMedia.tsx')
    expect(media).toContain('(max-width: 640px) 50vw, (max-width: 1024px) 33vw, ${width}px')
    expect(homeCardSizes(200)).toBe('(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px')
  })
})

describe('⑥ 배선 — 워커가 이 모듈을 홈에서만 쓴다', () => {
  const worker = code('src/worker/index.ts')

  it('🔴 MAIN 슬롯 + 홈 + 모바일 UA 일 때만 그린다', () => {
    expect(worker).toContain(
      "ssrSlot === 'MAIN' && ssrExtraPayload && isMainPage && isMobileUserAgent(c.req.header('user-agent'))",
    )
  })

  it('🔴 실패하면 종전 로더로 되돌아간다', () => {
    expect(worker).toContain('buildHomeFirstScreen(ssrExtraPayload, urdealLoaderHtml)')
    expect(worker).toContain('homeFirst || urdealLoaderHtml')
  })

  it('🔴 상세 분기들 **뒤**에 온다 (앞에 두면 상세가 홈 카드를 받는다)', () => {
    const passAt = worker.indexOf("url.pathname.startsWith('/pass/')")
    const voucherAt = worker.indexOf("ssrSlot === 'DETAIL' && ssrPayload && url.pathname.startsWith('/vouchers/')")
    const homeAt = worker.indexOf("ssrSlot === 'MAIN' && ssrExtraPayload && isMainPage")
    expect(passAt).toBeGreaterThan(-1)
    expect(voucherAt).toBeGreaterThan(-1)
    expect(homeAt).toBeGreaterThan(voucherAt)
    expect(voucherAt).toBeGreaterThan(passAt)
  })

  it('🔴 워커가 lucide 를 끌고 들어오지 않는다 (번들 gzip 게이트 — 여유 40KB)', () => {
    const util = read('src/worker/utils/home-first-screen.ts')
    expect(util).not.toContain('lucide-react')
    expect(util).not.toContain('deal-category-icon')
    expect(util).not.toContain('PcHomeRail')
  })
})
