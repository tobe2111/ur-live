/**
 * 🏨 서버가 숙소 상세(`/stays/:id`)의 첫 화면을 그린다 〔2026-10-12 · 대표 *"모두 다 진행해줘"*〕
 *
 * 2026-10-12 오전에 canonical 을 `/pass/:id` → `/stays/:id` 로 옮겨 **이쪽이 정본**이 됐는데,
 * 서버 첫 화면은 사본(`/pass/:id`)에만 있었다 — 정본이 더 늦게 떴다. 같은 날 `<noscript>` 요약만
 * 먼저 붙이고(6자 → 146자) 첫 화면은 *"히어로 래퍼를 픽셀로 맞춰야 해 별건"* 으로 남겨 둔 것이다.
 *
 * ## 이 시험이 지키는 것 — **두 벌이 갈리지 않는가**
 * React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 통째로 갈아엎는다. 서버가 그린 것과
 * 어긋나면 그 자리가 **튄다**. 치수 클래스는 `STAY_HEAD`(화면과 **같은 상수**)에서 오므로 갈릴
 * 수가 없고, 손으로 옮긴 부분(갤러리 슬라이드·빵부스러기)만 **컴포넌트 소스와 대조**한다.
 *
 * ## 🔬 머지 전 실측 (390×844, 실제 CSS 로 서버 HTML 과 React 를 각각 렌더해 박스를 쟀다)
 *
 *                        A(서버)              B(React)
 *     빵부스러기          [0,0,390,85]         [0,0,390,85]      ✅
 *     히어로 래퍼/스크롤러 [0,85,390,260]       [0,85,390,260]    ✅
 *     사진 <img>          [0,85,390,260]       [0,85,390,260]    ✅
 *     성급 줄(값 없음)     [16,365,358,0]       [16,365,358,0]    ✅   ← 높이 0 + mb-1(4px)
 *     h1                  [16,369,358,19]      [16,369,358,19]   ✅
 *     성급 줄(값 있음)     [16,365,358,18]      [16,365,358,18]   ✅   ← h1 이 22px 내려간다
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제로 안 튀는지 → **프레임 캡처**만이 판정한다(배포 후 라이브).
 * - PC(lg+) — 서버는 PC 본문을 안 그린다(빵부스러기 + 로더). 이유는 빌더 머리말 "❌ 안 그리는 것".
 * - 라이브 시드의 긴 이름·빈 필드(위 실측은 라이브 한 건이다).
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import { buildStayDetailFirstScreen } from '@/worker/utils/stay-detail-ssr-body'
import { stayNoscriptFromPayload } from '@/worker/utils/crawler-noscript'
import { STAY_HEAD, STAY_PAGE_ROOT, STAY_GRID } from '@/shared/stay-head'
import { STAY_PROPERTY_TYPE_LABELS, propertyTypeLabel } from '@/shared/stay-property-type'
import { DETAIL_HERO_MOBILE_WIDTH, detailHeroMobileUrl } from '@/shared/detail-hero-image'
import { DETAIL_CRUMB_ITEM_CLASS, DETAIL_CRUMB_LINK_CLASS, DETAIL_CRUMB_CURRENT_CLASS } from '@/worker/utils/detail-ssr-body'

const LOADER = '<div style="min-height:100dvh;display:flex">urdeal.</div>'
const IMG = 'https://ldb-phinf.pstatic.net/stay.jpg'
const seed = (over: Record<string, unknown> = {}) => JSON.stringify({
  data: {
    product: {
      id: 2887, name: '평일 1박 숙박권', restaurant_name: '그랑블루글램핑&펜션',
      property_type: 'glamping', star_rating: null, image_url: IMG,
      region_sido: '강원', region_sigungu: '속초시', address: '강원특별자치도 양양군 …',
      ...over,
    },
    rooms: [{ name: '스탠다드 텐트', base_price_weekday: 149000 }],
  },
})

describe('🖼️ ① 히어로 — 화면이 실제로 그리는 것과 같은 URL·같은 프레임', () => {
  it('🔴 URL 이 `DetailGallery` 와 **같은 SSOT 함수**로 나온다 (갈리면 사진을 두 번 받는다)', () => {
    const expected = detailHeroMobileUrl(IMG, DETAIL_HERO_MOBILE_WIDTH)
    expect(expected).toBeTruthy()
    expect(buildStayDetailFirstScreen(seed(), LOADER)).toContain(expected)
  })

  it('프레임 3:2 · 바탕 #1D1F29 · cover — 갤러리의 모바일 슬라이드와 같은 값', () => {
    const gal = readCode('src/pages/group-buy/DetailGallery.tsx')
    expect(gal).toContain("aspectRatio: '3/2'")
    expect(gal).toContain("backgroundColor: '#1D1F29'")
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    expect(html).toContain('aspect-ratio:3/2')
    expect(html).toContain('background-color:#1D1F29')
    expect(html, 'object-fit 이 빠지면 사진이 늘어난다').toContain('object-fit:cover')
    expect(html, 'position 은 인라인이어야 한다 — 절대배치 <img> 의 포함 블록은 구조 요건이다')
      .toContain('style="position:relative;flex:0 0 100%')
  })

  it('🔴 히어로 **래퍼**를 그린다 — `-mx-4 -mt-5` 풀블리드를 빼먹으면 사진이 안쪽으로 들어간다', () => {
    expect(STAY_HEAD.heroWrap).toContain('-mx-4')
    expect(STAY_HEAD.heroWrap).toContain('-mt-5')
    expect(buildStayDetailFirstScreen(seed(), LOADER)).toContain(STAY_HEAD.heroWrap)
  })

  it('🔴 그라디언트(scrim)를 그리지 않는다 — 숙소는 `badges` 를 안 넘긴다(그리면 서버만 어둡다)', () => {
    const page = readCode('src/pages/StayDetailPage.tsx')
    expect(page, '숙소가 badges 를 넘기기 시작했다면 이 단언을 다시 판단할 것')
      .not.toMatch(/<DetailGallery[\s\S]{0,400}?badges=/)
    expect(buildStayDetailFirstScreen(seed(), LOADER)).not.toContain('linear-gradient')
  })
})

describe('🏷️ ② 성급 줄 + 제목 — 경계는 h1 까지', () => {
  it('🔴 성급이 없어도 **그 div 는 그린다** (`mb-1` 4px — 라이브 49건 중 37건이 이 경우다)', () => {
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    expect(html).toContain(`<div class="${STAY_HEAD.metaRow}"></div>`)
    expect(STAY_HEAD.metaRow, '4px 를 만드는 것이 이 클래스다').toContain('mb-1')
  })

  it('성급이 있으면 `N성급`', () => {
    expect(buildStayDetailFirstScreen(seed({ star_rating: 4 }), LOADER))
      .toContain(`<div class="${STAY_HEAD.metaRow}"><span>4성급</span></div>`)
  })

  it('제목은 `restaurant_name` 우선 — 화면과 같은 규칙', () => {
    expect(readCode('src/pages/StayDetailPage.tsx')).toContain('{stay.restaurant_name || stay.name}')
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    expect(html).toContain(`<h1 class="${STAY_HEAD.h1}">그랑블루글램핑&amp;펜션</h1>`)
  })

  it('🔴 h1 **아래**는 안 그린다 — 주소·평점은 SVG 아이콘을 품는다(두 벌이 갈리는 클래스)', () => {
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    const body = html.slice(0, html.indexOf('<noscript'))
    expect(body, '주소를 그리면 PinIcon path 를 손으로 옮기게 된다').not.toContain('양양군')
    expect(body).not.toContain('<svg')
    expect(body).not.toMatch(/개 리뷰/)
  })
})

describe('📐 ③ 치수는 SSOT 에서만 — 손으로 적은 클래스 0', () => {
  it('화면과 워커가 **같은 상수**를 쓴다', () => {
    const page = readCode('src/pages/StayDetailPage.tsx')
    for (const [k, v] of [['STAY_PAGE_ROOT', STAY_PAGE_ROOT], ['STAY_GRID', STAY_GRID]] as const) {
      expect(page, `${k} 를 손으로 다시 적으면 갈린다`).toContain(`className={${k}}`)
      expect(v.length).toBeGreaterThan(10)
    }
    for (const k of ['shell', 'heroWrap', 'titleBlock', 'metaRow', 'h1'] as const) {
      expect(page, `STAY_HEAD.${k} 배선이 사라졌다`).toContain(`STAY_HEAD.${k}`)
    }
    // 치수 클래스가 빌더 출력에 실제로 실린다(상수만 있고 안 쓰면 아무 일도 안 한다).
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    for (const k of ['pageBg', 'shell', 'gridPad', 'heroWrap', 'titleBlock', 'metaRow', 'h1'] as const) {
      expect(html, `STAY_HEAD.${k} 가 출력에 없다`).toContain(STAY_HEAD[k])
    }
  })

  it('🔴 PC(lg+) 는 본문을 안 그린다 — 그리드 밖 제목 헤더 때문에 반쪽만 그리면 밀린다', () => {
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    expect(html).toContain(`<div class="${STAY_HEAD.gridPad} lg:hidden">`)
    expect(readCode('src/pages/group-buy/DetailTitleHeader.tsx'), 'PC 제목 헤더는 lg 전용이다')
      .toContain('hidden lg:block')
  })
})

describe('🍞 ④ 빵부스러기 — 컴포넌트와 같은 모양·같은 라벨', () => {
  it('3단(`홈 / 숙소 / {유형}`) — `stayCrumbs` 와 같다', () => {
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    expect(html).toContain('>홈</a>')
    expect(html).toContain('href="/stays"')
    expect(html).toContain(`>${propertyTypeLabel('glamping')}</span>`)
    // 마지막 칸은 링크가 아니다(컴포넌트도 `aria-current="page"` span 이다).
    expect(html).toContain(`<span aria-current="page" class="${DETAIL_CRUMB_CURRENT_CLASS}">글램핑</span>`)
    expect(readRaw('src/components/deal/DetailBreadcrumb.tsx'), 'stayCrumbs 가 3단이 아니게 됐다')
      .toMatch(/stayCrumbs[\s\S]{0,320}?label: '숙소', to: '\/stays'/)
  })

  it('🩸 클래스가 `DetailBreadcrumb` 과 **글자까지** 같다 (2026-10-12 에 `gap-1.5` ↔ `gap-2` 로 갈려 있었다)', () => {
    const comp = readCode('src/components/deal/DetailBreadcrumb.tsx')
    expect(comp).toContain(`className="${DETAIL_CRUMB_ITEM_CLASS}"`)
    expect(comp).toContain(`className="${DETAIL_CRUMB_LINK_CLASS}"`)
    expect(comp).toContain(`className="${DETAIL_CRUMB_CURRENT_CLASS}"`)
  })

  it('유형이 없으면 2단 — 그래도 경로다(빵부스러기를 통째로 잃지 않는다)', () => {
    const html = buildStayDetailFirstScreen(seed({ property_type: null }), LOADER)
    expect(html).toContain('href="/stays"')
    expect(html).not.toContain('aria-current="page"')
  })
})

describe('🏨 ⑤ 유형 라벨 — 표가 하나다', () => {
  it('🔴 워커가 자기 사본을 갖지 않는다 (guesthouse 13건이 "게스트하우스" ↔ "스테이" 로 갈려 있었다)', () => {
    const meta = readCode('src/worker/utils/detail-ssr-meta.ts')
    expect(meta, '5종짜리 사본이 되살아났다').not.toMatch(/STAY_TYPE_LABEL\s*:\s*Record|const STAY_TYPE_LABEL/)
    expect(meta).toContain('propertyTypeLabel(')
    expect(readCode('src/pages/stay-detail/StayInfoSections.tsx'), '화면도 같은 표를 재수출만 한다')
      .toContain("export { propertyTypeLabel } from '@/shared/stay-property-type'")
  })

  it('라벨이 시드 SSOT(`STAY_TYPES`)와 일치한다', () => {
    const seedSrc = readCode('src/features/admin/api/admin-stays.routes.ts')
    for (const [type, label] of Object.entries(STAY_PROPERTY_TYPE_LABELS)) {
      const m = seedSrc.match(new RegExp(`type: '${type}', label: '([^']+)'`))
      if (m) expect(m[1], `${type} 라벨이 시드와 갈렸다`).toBe(label)
    }
    expect(STAY_PROPERTY_TYPE_LABELS.guesthouse).toBe('스테이')
    expect(propertyTypeLabel('zzz'), '모르는 유형은 원문 — "숙소" 로 뭉개지 않는다').toBe('zzz')
  })
})

describe('📰 ⑥ `<noscript>` — 첫 화면이 그린 것은 반복하지 않는다', () => {
  it('첫 화면 경로는 숙소명·성급을 뺀다(규율 ②), 지역·가격·주소·객실은 남는다', () => {
    const html = buildStayDetailFirstScreen(seed({ star_rating: 4 }), LOADER)
    const ns = html.slice(html.indexOf('<noscript'))
    expect(ns).toContain('강원 속초시')
    expect(ns).toContain('149,000원')
    expect(ns, '숙소명이 두 번 나온다').not.toContain('그랑블루')
    expect(ns, '성급이 두 번 나온다').not.toContain('4성급')
  })

  it('🔴 폴백 경로는 **전체**를 낸다 — 첫 화면이 없으니 이름까지 빠지면 본문이 다시 빈다', () => {
    const full = stayNoscriptFromPayload(seed({ star_rating: 4 }))
    expect(full).toContain('그랑블루글램핑&amp;펜션')
    expect(full).toContain('4성급')
    const idx = readRaw('src/worker/index.ts')
    expect(idx, '워커 폴백이 skipTitle 을 쓰면 안 된다')
      .toContain('stayNoscriptFromPayload(ssrPayload) + urdealLoaderHtml')
  })
})

describe('🧯 ⑦ 폴백·배선·이스케이프', () => {
  it('만들 수 없으면 `\'\'` — 호출부가 종전 동작으로 떨어진다', () => {
    expect(buildStayDetailFirstScreen('{{', LOADER)).toBe('')
    expect(buildStayDetailFirstScreen(JSON.stringify({ data: { product: { name: 'x' } } }), LOADER)).toBe('')
    expect(buildStayDetailFirstScreen(JSON.stringify({ data: { product: { image_url: IMG } } }), LOADER)).toBe('')
    expect(buildStayDetailFirstScreen(JSON.stringify({ data: {} }), LOADER)).toBe('')
  })

  it('로더는 사진 **아래**로 줄어든다 (100dvh 그대로면 문서가 화면보다 길어진다)', () => {
    const html = buildStayDetailFirstScreen(seed(), LOADER)
    expect(html).toContain('min-height:34dvh')
    expect(html).not.toContain('min-height:100dvh')
  })

  it('클라가 되붙일 수 있게 `ur-first-screen` 으로 감싼다', () => {
    expect(buildStayDetailFirstScreen(seed(), LOADER)).toContain('id="ur-first-screen"')
    expect(readCode('src/lib/boot-first-screen.ts')).toContain('ur-first-screen')
  })

  it('상품명이 속성을 탈출하지 못한다 (셀러-제어 값이다)', () => {
    const html = buildStayDetailFirstScreen(seed({ restaurant_name: '"><script>x</script>' }), LOADER)
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('워커가 이 빌더를 쓴다 (안 쓰면 아무것도 안 바뀐다)', () => {
    const idx = readRaw('src/worker/index.ts')
    expect(idx).toContain('const stayFirst = buildStayDetailFirstScreen(ssrPayload, urdealLoaderHtml);')
    expect(idx).toContain("import { buildStayDetailFirstScreen } from './utils/stay-detail-ssr-body'")
  })
})
