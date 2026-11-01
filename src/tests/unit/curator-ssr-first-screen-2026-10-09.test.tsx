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
import { shouldRenderMobileFirstScreen } from '@/shared/seo/crawler-ua'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { pinHref } from '@/pages/curator-page/pin-nav'
import PinRow from '@/pages/curator-page/PinRow'
import CuratorHeader from '@/pages/curator-page/CuratorHeader'
import { curatorSoldTotal } from '@/shared/curator-pin-order'
import { SHARE_MASCOT_SRC } from '@/shared/ushop-share-card'
import {
  buildCuratorFirstScreen, CURATOR_FS_CLASS, CURATOR_THUMB_WIDTH,
  CURATOR_FS_ROWS, CURATOR_SEARCH_MIN_PINS, CURATOR_LOGO_SIZE,
} from '@/worker/utils/curator-ssr-body'
import { curatorHomePins } from '@/shared/curator-pin-order'
import { cfImage } from '@/utils/cf-image'
import { stripComments } from '../helpers/source-text'
import { showUShopChips, showUShopSort } from '@/shared/ushop-pin-category'

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
      code('src/shared/ushop-row.ts'), // 2026-10-25 D안 — 줄·탭 값의 SSOT(부품과 워커가 같이 쓴다)
    ].join('\n')
    const missing: string[] = []
    for (const [k, v] of Object.entries(CURATOR_FS_CLASS)) {
      // `row` 는 DealRow 가 조립한다(skin 삽입) — 조각으로 확인
      if (k === 'row') {
        for (const part of ['w-full flex items-center', "'gap-4'", 'text-left', 'px-0 py-5', 'active:opacity-60 transition-opacity']) {
          if (!sources.includes(part)) missing.push(`${k}:${part}`)
        }
        continue
      }
      if (k === 'rowThumb') {
        for (const part of ['w-[88px] h-[88px]', 'shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#222225]']) {
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
        <PinRow pin={pin as never} handle="jiwon1228" curatorUserId={3} order={1} />
      </MemoryRouter>,
    )
    const real = container.querySelector('a')!
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
    const served = doc.querySelector('.ur-ushop-rows > a')!

    // 목적지 — 2026-10-18(결재 `2026-10-15-ushop-pin-spa-nav` 안 1) 부터 **일부러 다르다**:
    //   · 서버 첫 화면(React 전)은 귀속 경로 `/u/:handle/p/:productId` — 앱이 안 떴을 때 누르면 서버가 클릭·귀속을 붙인다
    //   · React 줄은 정본 상세로 앱 안 이동 + `onPinClick`(소개 값 저장·비콘) — 같은 일을 화면 안에서 한다
    //   둘이 같은 상품을 가리키는지만 본다(마운트 때 노드가 교체되므로 href 차이는 밀림이 아니다).
    expect(served.getAttribute('href')).toBe('/u/jiwon1228/p/2887')
    expect(real.getAttribute('href')).toBe(pinHref(pin as never))
    expect(real.getAttribute('href')!.endsWith('/2887')).toBe(true)
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
    // 배지는 1,2,3 (화면 순서가 아니라 그 순서의 인덱스) — 2026-10-25 D안부터 가게 줄 앞("1 · 가게")
    expect(rows.map((a) => a.querySelector('p')!.textContent!.split(' · ')[0])).toEqual(['1', '2', '3'])
  })

  it('③-1 줄은 최대 CURATOR_FS_ROWS 개만 그린다', () => {
    const pins = Array.from({ length: 9 }, (_, i) => PIN({ id: i + 1, product_id: 500 + i }))
    const html = buildCuratorFirstScreen(SEED({ pins }), LOADER)
    const n = (html.match(/class="w-full flex items-center gap-4 text-left/g) || []).length
    expect(n).toBe(CURATOR_FS_ROWS)
    expect(CURATOR_FS_ROWS).toBeLessThanOrEqual(6)
  })

  // ─────────────────────────────────────────────── ④ 주인/방문자 폭 — 이 첫 화면의 전제
  /**
   * 🔄 2026-11-01 재조준 (대표 확정 **2안**). 종전 단언은 *"방문자에게도 `관리` 자리를 `invisible` 로
   *   비워 둔다"* 였고, 그것이 지키던 것은 **"이름 칸 폭이 주인/방문자에서 같다"** 하나였다.
   *   2안이 버튼 묶음을 **이름 줄 밖**(로고 줄)으로 옮기면서 그 폭은 **구조적으로** 같아졌다 —
   *   예약은 더 이상 필요 없고, 남겨 두면 PC 프로필 열에서 공유 아이콘이 빈 알약만큼 왼쪽으로 밀린다.
   *   ⇒ **수단(예약) 대신 결과(폭이 같다)를 렌더해서 잰다.** 예약으로 되돌리면 이 단언은 그대로 통과하지만
   *     버튼을 이름 줄로 되돌리면 빨간불이 된다 — 그것이 이 가드가 막으려는 회귀다.
   */
  it('④ 이름 칸의 폭·구조가 주인/방문자에서 같다(서버는 누가 보는지 모른 채 그린다)', () => {
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
    // 이름 줄(= 얼굴 + 이름 칸)의 **구조가 같다** — 그 줄에 소유권으로 갈리는 것이 하나도 없어야 한다.
    const nameRow = (c: Element) => c.querySelector(`.${CURATOR_FS_CLASS.nameRow.split(' ').join('.')}`)!
    expect(nameRow(owner), '이름 줄을 못 찾았다(클래스가 갈렸다)').toBeTruthy()
    expect(nameRow(visitor).outerHTML, '이름 줄은 누가 보든 같다').toBe(nameRow(owner).outerHTML)
    // 버튼 묶음은 **그 줄 밖**에 있고, 거기서만 소유권이 갈린다.
    const cluster = (c: Element) => c.querySelector(`.${CURATOR_FS_CLASS.cluster.split(' ').join('.')}`)!
    expect(nameRow(owner).contains(cluster(owner)), '버튼 묶음이 이름 줄 안에 있으면 안 된다').toBe(false)
    // 줄 높이는 공유(h-9)와 관리(h-9)가 같아 소유권과 무관하다 — 둘 다 같은 높이 토큰을 쓴다.
    expect(tokens(CURATOR_FS_CLASS.iconBtn)).toContain('h-9')
    expect(tokens(CURATOR_FS_CLASS.manageBtn)).toContain('h-9')
    // 주인만 진짜 관리 링크를 갖고, 방문자에겐 그 자리가 아예 없다(예약하지 않는다).
    const manage = (c: Element) => cluster(c).querySelector('a[href="/u/me/manage"]')
    expect(manage(owner), '주인은 진짜 링크').toBeTruthy()
    expect(manage(visitor), '방문자에겐 없다').toBeNull()
    expect(cluster(visitor).querySelectorAll('.invisible').length, '빈 예약도 없다').toBe(0)
    // 공유는 둘 다에게 보인다 — 손님이 친구에게 넘기는 것이 유어샵의 확산 경로다.
    for (const c of [owner, visitor]) expect(cluster(c).querySelector('button')).toBeTruthy()
  })

  it('④-1 워커도 같은 자리를 같은 클래스로 예약한다 + 아이콘 path 는 안 옮긴다', () => {
    const html = buildCuratorFirstScreen(SEED(), LOADER)
    // 🔄 2026-11-01 (2안): `관리` 예약은 사라졌다(④ 참조). 줄 높이는 공유 한 칸이 정한다.
    expect(html, '관리 예약은 되살리지 않는다').not.toContain(CURATOR_FS_CLASS.manageBtn)
    // 🔄 2026-10-14 (유어샵 A): SNS 는 이름 아래 줄의 이름표로 내려갔다 ⇒ 이름 줄의 빈 원은 **공유 하나**.
    expect((html.match(new RegExp(`class="${CURATOR_FS_CLASS.iconBtn.replace(/[[\]]/g, '\\$&')}"`, 'g')) || []).length).toBe(1)
    // SNS 2 = 이름표 자리 2개(글자는 브랜드명, 아이콘은 빈 칸)
    expect((html.match(new RegExp(`class="${CURATOR_FS_CLASS.snsPill.replace(/[[\]]/g, '\\$&')}"`, 'g')) || []).length).toBe(2)
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
    expect(html).not.toContain(CURATOR_FS_CLASS.snsPill) // SNS 없으면 이름표 자리 0
    expect(html).not.toContain(CURATOR_FS_CLASS.bio) // bio 없으면 그 줄 자체가 없다
  })

  // ─────────────────────────────────────────────── ④-3 얼굴·숫자 줄 (2026-10-14 유어샵 A)
  it('④-4 얼굴·숫자 줄이 진짜 `CuratorHeader` 와 같다(사진 URL · 유달이 · 숫자)', () => {
    // 🛍️ 2026-10-15: 누적 구매 = 이 유어샵을 거쳐 팔린 수(`curator.ushop_sold`). 상품 전체 판매수(sold_count)는 **무시**해야 한다.
    const pins = [{ id: 1, product_id: 1, product_name: 'a', price: 1000, sold_count: 300 }, { id: 2, product_id: 2, product_name: 'b', price: 2000, sold_count: 11 }]
    for (const profile_image of ['https://media.ur-team.com/u/3/face.webp', null]) {
      const curator = { id: 3, handle: 'jiwon1228', name: '정지원', bio: '소개', profile_image, youtube_url: 'y', instagram_url: '', tiktok_url: '', ushop_sold: 7 }
      const html = buildCuratorFirstScreen(JSON.stringify({ success: true, curator, pins }), LOADER)
      const host = document.createElement('div'); host.innerHTML = html
      const { container } = render(
        <MemoryRouter>
          <CuratorHeader curator={curator as never} counts={{ pins: pins.length }} soldTotal={curatorSoldTotal(curator)} onCopyLink={() => {}} />
        </MemoryRouter>,
      )
      const sImg = host.querySelector(`.${CURATOR_FS_CLASS.avatar.split(' ').join('.')} img`)!
      // 🩸 2026-11-01: 종전엔 `.w-14.h-14` 를 **손으로** 적어 두어 얼굴이 40px 로 바뀌자 null 이 됐다.
      //   양쪽 다 같은 상수에서 선택자를 파생한다 — 그게 이 검사가 비교하려는 것이기도 하다.
      const cImg = container.querySelector(`.${CURATOR_FS_CLASS.avatar.split(' ').join('.')} img`)!
      expect(sImg.getAttribute('src'), `얼굴 URL (${profile_image ? '사진' : '유달이'})`).toBe(cImg.getAttribute('src'))
      if (!profile_image) expect(sImg.getAttribute('src')).toBe(SHARE_MASCOT_SRC)
      // 숫자 줄 글자가 같다 — 마운트 때 숫자가 바뀌어 보이면 안 된다
      const sStats = host.querySelector('p.' + CURATOR_FS_CLASS.stats.split(' ')[0])!.textContent
      const cStats = container.querySelector('p.' + CURATOR_FS_CLASS.stats.split(' ')[0])!.textContent
      expect(sStats).toBe(cStats)
      expect(sStats).toContain('누적 구매 7')
      expect(sStats).not.toContain('311') // 진열 상품의 전체 판매수 합이 새면 안 된다
    }
    // 유어샵을 거친 판매가 없으면 그 칸 자체가 없다(0 을 적지 않는다) — 서버·화면 둘 다
    const curator0 = { id: 3, handle: 'jiwon1228', name: '정지원', bio: '소개', profile_image: null, youtube_url: '', instagram_url: '', tiktok_url: '' }
    const html0 = buildCuratorFirstScreen(JSON.stringify({ success: true, curator: curator0, pins }), LOADER)
    expect(html0).not.toContain('누적 구매')
    expect(curatorSoldTotal({ ...curator0, ushop_sold: undefined })).toBe(0)
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

  /**
   * 🔄 2026-11-01 재조준 (대표 확정 **2안**). 종전엔 칩 줄의 두 자리를 **무조건** 예약했는데,
   *   화면은 그 둘을 **조건부로** 그린다 — 분류가 하나뿐이면 `PinCategoryChips` 가 `null` 을 내고
   *   (`showUShopChips`), 진열이 적으면 정렬이 안 뜬다(`showUShopSort`). 라이브 `/u/jiwon1228` 이
   *   정확히 그 경우라(이용권 1개) 서버가 그린 줄을 마운트가 **통째로 접었다**.
   *   ⇒ 불변식을 *"무조건 예약"* → **"화면이 그릴 때만, 그리고 그때는 반드시 예약"** 으로 옮긴다.
   *   🔴 판정 함수는 화면과 **같은 것**을 쓴다 — 여기서 조건을 베껴 적으면 언젠가 갈린다.
   */
  it('④-3 칩 줄은 화면이 그리는 조건에서만, 그때는 두 자리를 다 예약한다', () => {
    const mk = (pins: unknown[]) => buildCuratorFirstScreen(JSON.stringify({ success: true, curator: JSON.parse(SEED()).curator, pins }), LOADER)
    const pin = (i: number, category: string) => ({ id: i, product_id: i, product_name: `p${i}`, price: 1000, category })

    // ⓐ 분류 2종 + 진열 5개 이상 → 둘 다 예약한다.
    //    칩은 `-mb-px` 로 1px 올라앉으므로 줄 높이는 **정렬 칸**(음수 마진 없음)이 정한다.
    //    실측: 칩만 예약 44px vs React 45px — 1px 도 밀림이다.
    const many = [1, 2, 3].map((i) => pin(i, 'meal_voucher')).concat([4, 5].map((i) => pin(i, 'stay_voucher')))
    expect(showUShopChips(many) && showUShopSort(many), '픽스처 전제').toBe(true)
    const full = mk(many)
    expect(full).toContain(`class="${CURATOR_FS_CLASS.chip} invisible"`)
    expect(full).toContain(`class="${CURATOR_FS_CLASS.sortSlot}"`)
    expect(full).toContain(`class="${CURATOR_FS_CLASS.sortBtn} invisible"`)

    // ⓑ 분류 1종 + 진열 1개 → **아무것도 예약하지 않는다**(빈 div → `empty:hidden` 이 여백까지 접는다).
    const one = [pin(1, 'meal_voucher')]
    expect(showUShopChips(one) || showUShopSort(one), '픽스처 전제').toBe(false)
    const bare = mk(one)
    expect(bare, '칩 자리 없음').not.toContain(`class="${CURATOR_FS_CLASS.chip} invisible"`)
    expect(bare, '정렬 자리 없음').not.toContain(CURATOR_FS_CLASS.sortSlot)
    expect(bare, '줄 자체는 남고 비어 있다').toContain(`<div class="${CURATOR_FS_CLASS.chipsRow}"></div>`)

    // ⓒ 분류 2종이지만 진열 4개 → 칩만. (두 조건이 **따로** 걸린다는 증거)
    const chipsOnly = [pin(1, 'meal_voucher'), pin(2, 'stay_voucher')]
    expect(showUShopChips(chipsOnly), '픽스처 전제').toBe(true)
    expect(showUShopSort(chipsOnly), '픽스처 전제').toBe(false)
    const mid = mk(chipsOnly)
    expect(mid).toContain(`class="${CURATOR_FS_CLASS.chip} invisible"`)
    expect(mid).not.toContain(CURATOR_FS_CLASS.sortSlot)

    // 페이지 소스에 그 두 자리가 실제로 그 모양으로, **같은 판정 함수 뒤에** 있는가
    const page = code('src/pages/CuratorPage.tsx')
    expect(page).toContain(`<div className="${CURATOR_FS_CLASS.sortSlot}">`)
    expect(page).toContain('<SortMenu')
    expect(page, '정렬 게이트는 SSOT 함수').toMatch(/\{showUShopSort\(pins\) && \(/)
    expect(code('src/pages/curator-page/PinCategoryChips.tsx'), '칩 게이트도 같은 SSOT')
      .toMatch(/if \(!showUShopChips\(pins\)\) return null/)
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
    // 🔀 2026-10-11 재조준: 불변식(**PC 에는 안 그린다**) 그대로, 그려 주는 쪽에 색인 크롤러가
    //   더해졌다 — Yeti 는 유어샵을 6자로 보고 있었다. 동작 판정은 바로 아래 시험이 한다.
    expect(cond).toContain('shouldRenderMobileFirstScreen')
    // 🔀 2026-10-12 재조준: 불변식(**첫 화면이 `''` 면 로더로 폴백**) 그대로. 달라진 것은 그
    //   폴백이 로더 **앞에** `<noscript>` 요약을 깐다는 것뿐이다 — 라이브 실측에서 이 빌더가
    //   `''` 를 주는 세 경우(사업자 유어샵 · 핀 0 · 파싱 실패)가 전부 본문 6자였다.
    //   ⚠️ 로더가 그 자리에 **남아 있는지**를 계속 고정한다(대체하는 방향은 회귀다).
    expect(w).toMatch(/curatorFirst \|\| [^\n]*urdealLoaderHtml/)
    expect(w).toContain('urdealLoaderHtml')
  })

  it('⑥-2 그 조건을 **동작으로** 잰다 — PC 는 안 그리고 색인 크롤러는 그린다', () => {
    expect(shouldRenderMobileFirstScreen('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(shouldRenderMobileFirstScreen('Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)')).toBe(true)
    expect(shouldRenderMobileFirstScreen('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36')).toBe(false)
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
