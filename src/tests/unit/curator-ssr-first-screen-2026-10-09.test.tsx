/**
 * 🛍️ 유어샵(`/u/:handle`)의 **서버가 그리는 첫 화면** 〔2026-10-09〕
 *
 * 대표: *"처음에 유어딜 페이지 들어올 때 만큼은 로딩 장면 없이"* → *"그럼 그 홈 로딩 말고도
 * 전체적으로 다른 페이지들은?"* → ***"모두 다 하자"***. ①`/vouchers/:id` ④홈 다음의 마지막 조각.
 *
 * ## 이 시험이 지키는 것
 * 워커는 React 를 못 돌리므로 마크업이 **두 벌**이 된다. 갈려도 **에러가 안 난다** — 마운트 때
 * 그 자리가 조용히 튀기만 한다. ⇒ 소스 문자열을 비교하지 않고 **진짜 `PinRow`·`CuratorHeader` 를
 * 렌더해서** 워커 HTML 과 대조한다.
 *
 * 그리고 이 화면에만 있는 위험 하나를 따로 고정한다 — **주인/방문자 폭**. `[관리]` 버튼이
 * 주인에게만 뜨면 이름 칸이 `222 ↔ 140px`(390px·SNS 2, 실측)로 갈려 헤더가 `126 ↔ 148px` 가 된다.
 * 서버는 누가 보는지 모르므로 그 차이는 밀림이다. ⇒ `CuratorHeader` 가 **방문자에게도 그 자리를
 * 비워 두는지**를 검사한다(그게 이 첫 화면의 전제다).
 *
 * ## 못 막는 것
 * - jsdom 은 레이아웃이 없어 **픽셀을 못 잰다** → "같은 클래스·같은 줄 순서"로 대신 본다.
 *   실제 치수는 브라우저로 쟀다(2026-10-09, 390×844, 라이브 시드):
 *     헤더 110 · 칩 줄 45(top 110) · 줄 1~4 top 155/266/367/468 — **React 와 전부 동일**.
 * - 번역이 ko 가 아니면 `관리` 알약 폭이 달라져 서버와 어긋날 수 있다(워커엔 i18n 이 없다).
 * - 사진이 실제로 한 번만 내려오는지는 브라우저 네트워크 로그가 판정한다(여기선 URL 동치까지).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PinRow from '@/pages/curator-page/PinRow'
import CuratorHeader from '@/pages/curator-page/CuratorHeader'
import {
  buildCuratorFirstScreen, CURATOR_FS_CLASS, CURATOR_THUMB_WIDTH,
  CURATOR_FS_ROWS, CURATOR_SEARCH_MIN_PINS, CURATOR_LOGO_SIZE,
} from '@/worker/utils/curator-ssr-body'
import { curatorHomePins } from '@/shared/curator-pin-order'
import { cfImage } from '@/utils/cf-image'
import { stripComments } from '../helpers/source-text'

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const code = (p: string) => stripComments(read(p))

const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'

/** 라이브 시드 모양(2026-10-09 `/api/curator/jiwon1228` 실측). */
const PIN = (over: Record<string, unknown> = {}) => ({
  id: 11, product_id: 2887, position: 1, note: null,
  product_name: '평일 1박 숙박권 (프리미엄 리버뷰 스위트)',
  restaurant_name: '그랑블루글램핑&펜션',
  restaurant_address: '충북 단양군',
  image_url: 'https://media.ur-team.com/uploads/demo/2026-09/e8a023cd.jpg',
  thumbnail: null,
  price: 209000, original_price: 272000, discount_rate: 0,
  category: 'stay_voucher', deal_only: 0, deal_pct: 0,
  dominant_color: '#958c80', is_active: 1,
  avg_rating: 4.6, review_count: 12, sold_count: 3, commission_rate: 5, click_count: 0,
  ...over,
})
const SEED = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  curator: {
    id: 3, handle: 'jiwon1228', name: '정지원', bio: '전국의 맛집을 소개합니다.',
    profile_image: null, banner_url: null, headline: null, accent: null,
    youtube_url: 'Live', instagram_url: 'Liv', tiktok_url: '',
    linkshop_show_recommend: 1,
  },
  pins: [PIN(), PIN({ id: 12, product_id: 2835, product_name: '곱창전골 2인', category: 'meal_voucher', price: 35100, original_price: 41000, restaurant_name: '부용한우곱창' })],
  linked_seller: null,
  ...over,
})

const classesOf = (html: string) => Array.from(html.matchAll(/class="([^"]*)"/g)).map((m) => m[1])
const tokens = (s: string) => new Set(s.split(/\s+/).filter(Boolean))

describe('유어샵 서버 첫 화면 — 워커 HTML ↔ 진짜 컴포넌트', () => {
  // ─────────────────────────────────────────────── ① 클래스가 소스와 같은가
  it('① CURATOR_FS_CLASS 의 모든 값이 실제 페이지/부품 소스에 있다', () => {
    const sources = [
      code('src/pages/CuratorPage.tsx'),
      code('src/pages/curator-page/CuratorHeader.tsx'),
      code('src/pages/curator-page/PinRow.tsx'),
      code('src/components/deal/DealRow.tsx'),
      code('src/pages/curator-page/PinCategoryChips.tsx'),
    ].join('\n')
    const missing: string[] = []
    for (const [k, v] of Object.entries(CURATOR_FS_CLASS)) {
      // `row` 는 DealRow 가 조립한다(skin 삽입) — 조각으로 확인
      if (k === 'row') {
        for (const part of ['w-full flex items-center gap-3 text-left', 'px-1 py-3', 'active:opacity-60 transition-opacity']) {
          if (!sources.includes(part)) missing.push(`${k}:${part}`)
        }
        continue
      }
      if (k === 'rowThumb') {
        for (const part of ['w-[76px] h-[76px]', 'shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#222225]']) {
          if (!sources.includes(part)) missing.push(`${k}:${part}`)
        }
        continue
      }
      // 예약 전용 치수 클래스는 소스에 같은 문자열이 없다(자리만 만든다)
      if (k === 'sortBtn' || k === 'brandLink') continue
      if (!sources.includes(v)) missing.push(`${k}=${v}`)
    }
    expect(missing).toEqual([])
    // 가드가 헛돌지 않게 — 비교한 항목이 충분히 많아야 한다
    expect(Object.keys(CURATOR_FS_CLASS).length).toBeGreaterThanOrEqual(20)
  })

  // ─────────────────────────────────────────────── ② 줄: 진짜 PinRow 와 대조
  it('② 진열 줄의 클래스·순서·사진 속성이 진짜 `PinRow` 와 같다', () => {
    const pin = PIN()
    const { container } = render(
      <MemoryRouter>
        <PinRow pin={pin as never} handle="jiwon1228" order={1} />
      </MemoryRouter>,
    )
    const real = container.querySelector('a')!
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
    const served = doc.querySelector('.ur-ushop-rows > a')!

    // 목적지 — 반드시 귀속 경로(`/u/:handle/p/:productId`)
    expect(served.getAttribute('href')).toBe(real.getAttribute('href'))
    expect(served.getAttribute('href')).toBe('/u/jiwon1228/p/2887')
    // 루트 클래스 토큰 동치
    expect(tokens(served.className)).toEqual(tokens(real.className))
    // 줄 안 요소들의 클래스 순서까지 같은가
    // ⚠️ 공백 정규화: React 는 `${thumbClassName}`(빈 문자열) 때문에 **꼬리 공백**을 남긴다.
    //   토큰이 같은지를 묻는 것이고 공백 수를 묻는 게 아니다.
    const seq = (el: Element) => Array.from(el.querySelectorAll('*'))
      .map((n) => (typeof n.className === 'string' ? n.className.trim().replace(/\s+/g, ' ') : ''))
      .filter(Boolean)
    expect(seq(served)).toEqual(seq(real))
    // 사진 속성
    const si = served.querySelector('img')!
    const ri = real.querySelector('img')!
    for (const a of ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'class']) {
      expect(`${a}=${si.getAttribute(a)}`).toBe(`${a}=${ri.getAttribute(a)}`)
    }
    // 글자
    expect(served.textContent).toBe(real.textContent)
  })

  it('②-1 사진 URL 이 `PinRow` 와 **같은 cfImage 인자**로 만들어진다(갈리면 두 번 받는다)', () => {
    const raw = 'https://media.ur-team.com/uploads/demo/2026-09/e8a023cd.jpg'
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    const expected = cfImage(raw, { width: CURATOR_THUMB_WIDTH, format: 'auto' })
    expect(expected).toBeTruthy()
    expect(html).toContain(`src="${expected}"`)
    // 폭은 PinRow 소스가 들고 있는 값과 같아야 한다
    expect(code('src/pages/curator-page/PinRow.tsx')).toContain(`width: ${CURATOR_THUMB_WIDTH}, format: 'auto'`)
  })

  it('②-2 `thumbnail` 이 있으면 그것을 쓴다(PinRow 와 같은 우선순위)', () => {
    const t = 'https://media.ur-team.com/uploads/demo/thumb.jpg'
    const seed = SEED({ pins: [PIN({ thumbnail: t })] })
    const html = buildCuratorFirstScreen(seed, LOADER)
    expect(html).toContain(`src="${cfImage(t, { width: CURATOR_THUMB_WIDTH, format: 'auto' })}"`)
  })

  // ─────────────────────────────────────────────── ③ 순번 = 주인 순서 SSOT
  it('③ 순번 배지가 `curatorHomePins` 순서로 1부터 — 딜 있는 핀이 위', () => {
    const pins = [
      PIN({ id: 1, product_id: 101, product_name: '그냥 상품', category: 'general', deal_only: 0, deal_pct: 0 }),
      PIN({ id: 2, product_id: 102, product_name: '딜 붙은 것', category: 'meal_voucher', deal_pct: 5 }),
      PIN({ id: 3, product_id: 103, product_name: '이용권', category: 'beauty_voucher', deal_pct: 0 }),
    ]
    const html = buildCuratorFirstScreen(SEED({ pins }), LOADER)
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
    const rows = Array.from(doc.querySelectorAll('.ur-ushop-rows > a'))
    const order = curatorHomePins(pins as never[]).map((p: { product_id: number }) => p.product_id)
    expect(rows.map((a) => a.getAttribute('href'))).toEqual(order.map((id) => `/u/jiwon1228/p/${id}`))
    // 배지는 1,2,3 (화면 순서가 아니라 그 순서의 인덱스)
    expect(rows.map((a) => a.querySelector('span')!.textContent)).toEqual(['1', '2', '3'])
  })

  it('③-1 줄은 최대 CURATOR_FS_ROWS 개만 그린다', () => {
    const pins = Array.from({ length: 9 }, (_, i) => PIN({ id: i + 1, product_id: 500 + i }))
    const html = buildCuratorFirstScreen(SEED({ pins }), LOADER)
    const n = (html.match(/class="w-full flex items-center gap-3 text-left/g) || []).length
    expect(n).toBe(CURATOR_FS_ROWS)
    expect(CURATOR_FS_ROWS).toBeLessThanOrEqual(6)
  })

  // ─────────────────────────────────────────────── ④ 주인/방문자 폭 — 이 첫 화면의 전제
  it('④ `CuratorHeader` 는 방문자에게도 `관리` 자리를 비워 둔다(폭이 같아야 서버가 그릴 수 있다)', () => {
    const curator = {
      id: 3, handle: 'jiwon1228', name: '지원의 동네가게 연남점', bio: '소개',
      profile_image: null, youtube_url: 'y', instagram_url: 'i', tiktok_url: '',
    }
    const renderHeader = (canEdit: boolean) => {
      const { container } = render(
        <MemoryRouter>
          <CuratorHeader curator={curator as never} canEdit={canEdit} onCopyLink={() => {}} />
        </MemoryRouter>,
      )
      return container
    }
    const owner = renderHeader(true)
    const visitor = renderHeader(false)
    const cluster = (c: Element) => c.querySelector('.ml-3')!
    // 버튼 자리 개수가 같다(SNS 2 + 공유 + 관리 = 4)
    expect(cluster(visitor).children.length).toBe(cluster(owner).children.length)
    // 관리 자리의 클래스가 같다 — 폭을 정하는 것은 이 클래스들이다
    const last = (c: Element) => cluster(c).lastElementChild!
    for (const t of tokens(CURATOR_FS_CLASS.manageBtn)) {
      expect(tokens(last(owner).className)).toContain(t)
      expect(tokens(last(visitor).className)).toContain(t)
    }
    // 방문자 쪽은 보이지 않고, **누를 수도 읽힐 수도 없다**
    expect(tokens(last(visitor).className)).toContain('invisible')
    expect(last(visitor).tagName).toBe('SPAN')
    expect(last(visitor).getAttribute('aria-hidden')).toBe('true')
    // 주인 쪽은 진짜 링크다
    expect(last(owner).tagName).toBe('A')
    expect(last(owner).getAttribute('href')).toBe('/u/me/manage')
    // 글자는 같은 번역 키 하나에서 온다(폭이 번역마다 달라도 둘이 같이 달라진다)
    expect(last(visitor).textContent).toBe(last(owner).textContent)
  })

  it('④-1 워커도 그 자리를 같은 클래스로 비워 둔다 + 아이콘 path 는 안 옮긴다', () => {
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    expect(html).toContain(`class="${CURATOR_FS_CLASS.manageBtn} invisible pointer-events-none"`)
    // SNS 2 + 공유 = 빈 원 3개
    expect((html.match(new RegExp(`class="${CURATOR_FS_CLASS.iconBtn.replace(/[[\]]/g, '\\$&')}"`, 'g')) || []).length).toBe(3)
    // 🔴 SVG 를 손으로 옮기지 않는다(두 벌이 갈리는 클래스)
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<path')
  })

  it('④-2 SNS 가 없으면 공유 한 칸만 예약한다', () => {
    const seed = SEED({
      curator: {
        id: 3, handle: 'jongmun', name: '디스크프리', bio: null,
        youtube_url: null, instagram_url: null, tiktok_url: null,
      },
    })
    const html = buildCuratorFirstScreen(seed, LOADER)
    expect((html.match(new RegExp(`class="${CURATOR_FS_CLASS.iconBtn.replace(/[[\]]/g, '\\$&')}"`, 'g')) || []).length).toBe(1)
    expect(html).not.toContain(CURATOR_FS_CLASS.bio) // bio 없으면 그 줄 자체가 없다
  })

  // ─────────────────────────────────────────────── ⑤ 안 그리는 것 / 폴백
  it('⑤ 그릴 수 없으면 `\'\'` — 호출부가 기존 로더로 돌아간다(무회귀)', () => {
    expect(buildCuratorFirstScreen('{bad json', LOADER)).toBe('')
    expect(buildCuratorFirstScreen(JSON.stringify({ success: false }), LOADER)).toBe('')
    expect(buildCuratorFirstScreen(SEED({ pins: [] }), LOADER)).toBe('') // 빈 유어샵 = EmptyUrShop(문구가 갈린다)
    expect(buildCuratorFirstScreen(SEED({ linked_seller: { id: 24, username: 'user_40' } }), LOADER)).toBe('') // 사업자 = SellerPublicPage
    expect(buildCuratorFirstScreen(JSON.stringify({ success: true, curator: { handle: 'x' }, pins: [PIN()] }), LOADER)).toBe('') // 이름 없음
  })

  it('⑤-1 검색창은 핀 12개 이상일 때만 자리를 예약한다(페이지 상수와 같은 값)', () => {
    expect(code('src/pages/CuratorPage.tsx')).toContain(`const SEARCH_MIN_PINS = ${CURATOR_SEARCH_MIN_PINS}`)
    const few = buildCuratorFirstScreen(SEED(), LOADER)
    expect(few).not.toContain(CURATOR_FS_CLASS.searchBox)
    const many = buildCuratorFirstScreen(
      SEED({ pins: Array.from({ length: CURATOR_SEARCH_MIN_PINS }, (_, i) => PIN({ id: i + 1, product_id: 700 + i })) }),
      LOADER,
    )
    expect(many).toContain(CURATOR_FS_CLASS.searchBox)
  })

  it('④-3 칩 줄의 **높이를 만드는 두 자리**를 다 예약한다(칩 + 정렬 칸)', () => {
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    // 칩은 `-mb-px` 로 1px 올라앉으므로 줄 높이는 **정렬 칸**(음수 마진 없음)이 정한다.
    // 실측: 칩만 예약 44px vs React 45px — 1px 도 밀림이다.
    expect(html).toContain(`class="${CURATOR_FS_CLASS.chip} invisible"`)
    expect(html).toContain(`class="${CURATOR_FS_CLASS.sortSlot}"`)
    expect(html).toContain(`class="${CURATOR_FS_CLASS.sortBtn} invisible"`)
    // 페이지 소스에 그 두 자리가 실제로 그 모양으로 있는가
    const page = code('src/pages/CuratorPage.tsx')
    expect(page).toContain(`<div className="${CURATOR_FS_CLASS.sortSlot}">`)
    expect(page).toContain('<SortMenu')
  })

  it('⑤-2 로더는 첫 화면 **아래**로 — 34dvh 로 줄여 붙인다', () => {
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    expect(html).toContain('min-height:34dvh')
    expect(html).not.toContain('min-height:100dvh')
    expect(html.indexOf('ur-loader')).toBeGreaterThan(html.indexOf('ur-ushop-rows'))
    // 🧷 클라가 이 노드를 들고 있다가 폴백에 도로 붙인다
    expect(html).toContain('id="ur-first-screen"')
  })

  it('⑤-3 이름·소개·매장명을 이스케이프한다', () => {
    const seed = SEED({
      curator: { id: 3, handle: 'x', name: '<script>a</script>', bio: '"따옴표" & 앰퍼샌드' },
    })
    const html = buildCuratorFirstScreen(seed, LOADER)
    expect(html).not.toContain('<script>a</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&quot;따옴표&quot; &amp; 앰퍼샌드')
  })

  it('⑤-4 브랜드 바는 `UrDealLogo` 의 값을 그대로 미러한다', () => {
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    expect(code('src/pages/curator-page/CuratorHeader.tsx')).toContain(`<UrDealLogo size={${CURATOR_LOGO_SIZE}} />`)
    expect(html).toContain(`font-size:${CURATOR_LOGO_SIZE}px`)
    expect(html).toContain(`width:${Math.max(2, CURATOR_LOGO_SIZE * 0.18)}px`)
    expect(html).toContain('>urdeal<')
    // 🩸 `<a>` 가 없으면 바가 5px 낮아진다(실측 36 → 31)
    expect(html).toMatch(/<a href="\/"[^>]*>\s*<span class="inline-flex items-baseline/)
  })

  // ─────────────────────────────────────────────── ⑥ 배선
  it('⑥ 워커가 **한 세그먼트 `/u/:handle` · 모바일 UA** 에서만 그린다', () => {
    const w = code('src/worker/index.ts')
    expect(w).toContain("import { buildCuratorFirstScreen } from './utils/curator-ssr-body'")
    // ⚠️ `[^{]*` 로 잡으면 정규식의 `{1,40}` 에서 끊긴다 — 줄 끝(`) {`)까지 잡는다.
    const m = w.match(/ssrSlot === 'CURATOR' && ssrPayload &&.*\) \{/)
    expect(m).toBeTruthy()
    const cond = m![0]
    // `/u/:handle/p/:id`(핀 귀속 경로)는 같은 슬롯이라 반드시 제외된다
    expect(cond).toContain('^\\/u\\/[A-Za-z0-9_-]{1,40}\\/?$')
    expect(cond).toContain('isMobileUserAgent')
    expect(w).toContain('curatorFirst || urdealLoaderHtml')
  })

  it('⑥-1 순서 SSOT 를 페이지와 워커가 **같이** 쓴다(두 벌 금지)', () => {
    expect(code('src/pages/CuratorPage.tsx')).toContain('curatorHomePins(data.pins)')
    expect(code('src/worker/utils/curator-ssr-body.ts')).toContain('curatorHomePins(pins)')
    // 페이지가 옛 인라인 가르기로 돌아가지 않았는가
    expect(code('src/pages/CuratorPage.tsx')).not.toContain('const hasDeal = (p: CuratorPin)')
  })

  it('⑥-2 `/u/` 는 사진 preload 가 없다 — 있다면 첫 화면 URL 과 같아야 한다(지금은 둘 다 없음)', () => {
    const pre = code('src/worker/utils/home-card-preload.ts')
    expect(pre).not.toContain('curator') // 생기는 날 이 단언이 깨져 URL 동치를 맞추게 한다
  })
})
