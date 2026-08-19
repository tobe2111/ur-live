import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { derivePricing } from '@/pages/group-buy/pricing'

const read = (p: string) => readFileSync(p, 'utf8')
/** 주석을 걷어낸 코드만 본다 — "주석에만 남아도 통과"하는 헛도는 가드를 막는다. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const DETAIL = 'src/pages/GroupBuyDetailPage.tsx'
const MAP = 'src/pages/RestaurantMapPage.tsx'
const TOPBAR = 'src/pages/restaurant-map/MapTopBar.tsx'

/**
 * 🎟️ 이용권 상세 — 그루폰 정석(1안) · 🗺️ /map PC 컨트롤 이동 (2026-08-19 대표 확정).
 *
 * ⚠️ 이 파일이 **못 막는 것**: 실제 렌더 결과(높이·겹침·읽기 쉬움). 소스 문자열만 본다.
 *   최종 판정은 라이브 스크린샷이다.
 */
describe('이용권 상세 — 제목이 사진 위로 (대표 확정 1안)', () => {
  it('제목 헤더가 갤러리보다 **먼저** 온다', () => {
    const s = code(DETAIL)
    const header = s.indexOf('<DetailTitleHeader')
    const gallery = s.indexOf('<DetailGallery')
    expect(header).toBeGreaterThan(-1)
    expect(gallery).toBeGreaterThan(-1)
    expect(header).toBeLessThan(gallery)
  })

  it('제목·가격이 PC 에서 두 벌로 나오지 않는다 (모바일 블록은 lg:hidden)', () => {
    const s = code(DETAIL)
    // 모바일 타이틀/가격 블록은 반드시 lg:hidden 을 달고 있어야 한다.
    expect(s).toMatch(/className="lg:hidden" style=\{\{ padding: '20px 18px 0' \}\}/)
    expect(s).toMatch(/className="lg:hidden" style=\{\{ padding: '18px 18px 22px' \}\}/)
  })

  it('제목 헤더는 PC 전용이다 (모바일은 사진이 먼저)', () => {
    expect(code('src/pages/group-buy/DetailTitleHeader.tsx')).toMatch(/hidden lg:block/)
  })

  it('제목 헤더에 별점·주소가 함께 온다 (그루폰 상단 3요소)', () => {
    const s = code('src/pages/group-buy/DetailTitleHeader.tsx')
    expect(s).toMatch(/<StarRating/)
    expect(s).toMatch(/address/)
  })

  it('구매 패널이 최종가를 스스로 말한다 — 할인율 pill + 정가 취소선', () => {
    const s = code('src/pages/group-buy/DealPurchaseBox.tsx')
    // PC 본문에서 가격 블록을 뺐으므로 여기가 유일한 가격 자리다.
    expect(s).toMatch(/discountPct > 0[\s\S]{0,400}-\{discountPct\}%/)
    expect(s).toMatch(/unitSaving > 0[\s\S]{0,300}<s[\s\S]{0,200}formatNumber\(refPrice\)/)
  })
})

describe('할인율은 카드·상세·공유가 같은 값을 쓴다 (표시 SSOT)', () => {
  it('상세는 표시용 할인율을 쓰고, 서버값을 직접 찍지 않는다', () => {
    const s = code(DETAIL)
    // 타입 선언(interface) 한 곳을 빼면 화면·공유 어디에서도 raw 값을 쓰지 않아야 한다.
    const raws = s.match(/detail\.current_discount_pct/g) || []
    expect(raws).toHaveLength(0)
    expect(s).toMatch(/displayDiscountPct/)
  })

  it('결제가는 표시용 폴백에 오염되지 않는다 (서버 할인율만)', () => {
    // 정가 32,000 · 공구가 23,800 · 서버 할인율 0  → 결제가는 23,800 그대로,
    // 화면 할인율만 26% 로 채운다(카드가 보여 주는 값과 같아진다).
    const p = derivePricing({ price: 23800, original_price: 32000, current_discount_pct: 0 })
    expect(p.unitPrice).toBe(23800)          // ⚠️ 26% 를 또 곱하면 안 된다(이중 할인)
    expect(p.displayDiscountPct).toBe(26)
    expect(p.unitSaving).toBe(8200)
  })

  it('서버 할인율이 있으면 그게 이긴다 (티어 할인 존중)', () => {
    const p = derivePricing({ price: 10000, original_price: 12000, current_discount_pct: 30 })
    expect(p.unitPrice).toBe(7000)
    expect(p.displayDiscountPct).toBe(30)
  })

  it('할인이 없으면 0 — 안 깎인 상품에 취소선/할인율을 만들지 않는다', () => {
    const p = derivePricing({ price: 10000, current_discount_pct: 0 })
    expect(p.displayDiscountPct).toBe(0)
    expect(p.unitSaving).toBe(0)
    expect(derivePricing(null).unitPrice).toBe(0)
  })
})

describe('/map — 지도 위 컨트롤이 왼쪽 리스트 상단으로 (PC)', () => {
  it('지도 오버레이는 PC 에서 숨는다 (지도는 지도만)', () => {
    const s = code(TOPBAR)
    // overlay 분기의 클래스에 lg:hidden 이 있어야 한다.
    expect(s).toMatch(/lg:hidden absolute top-0/)
  })

  it('PC 는 같은 바를 좌측 패널 안에 그린다', () => {
    const s = code(MAP)
    expect(s).toMatch(/<MapTopBar variant="panel"/)
    // 패널 호출은 **좌측 400px 시트 컨테이너 안**, 그리고 결과 리스트보다 위(헤더 자리)에 있어야 한다.
    // ⚠️ `<SheetFilterBar` 로 위치를 잡으면 안 된다 — 홈 리스트 모드에도 하나 있어서 첫 번째가 잡힌다
    //    (이 테스트를 만들 때 실제로 그렇게 헛짚었다).
    const panelAt = s.indexOf('<MapTopBar variant="panel"')
    expect(panelAt).toBeGreaterThan(s.indexOf('lg:w-[400px]'))
    expect(panelAt).toBeLessThan(s.indexOf('<RestaurantList', panelAt))
  })

  it('두 자리가 같은 props 를 쓴다 — 칩 하나만 한쪽에 추가되는 드리프트 차단', () => {
    const s = code(MAP)
    expect(s).toMatch(/const topBarProps = \{/)
    // 두 호출부 모두 spread 로만 넘긴다(개별 나열로 되돌아가면 반드시 갈린다).
    expect(s).toMatch(/<MapTopBar \{\.\.\.topBarProps\} \/>/)
    expect(s).toMatch(/<MapTopBar variant="panel" \{\.\.\.topBarProps\} \/>/)
  })

  /**
   * 🗺️ 2026-08-19 (대표 시안 — 카카오맵): "한 줄 안에 모든 카테고리가 다 들어가면 좋겠는데?"
   *
   * ⚠️ 이 항목은 **같은 날 한 번 뒤집혔다.** 처음엔 알약 칩을 `flex-wrap` 으로 2줄에 넣었는데
   *   (잘림 방지), 대표가 카카오맵처럼 한 줄을 원했다. 알약으로는 400px 에 7개가 안 들어가므로
   *   모양 자체를 [아이콘 위 · 라벨 아래] 7칸 그리드로 바꿨다. ⇒ **줄바꿈으로 되돌아가면 실패**다.
   */
  it('패널 칩은 한 줄 7칸 그리드다 (줄바꿈 금지 — 카카오맵식)', () => {
    const s = code(TOPBAR)
    expect(s).toMatch(/panel \? 'grid grid-cols-7/)
    expect(s).not.toMatch(/panel \? 'flex-wrap'/)
  })

  it('좁은 칸에서 긴 라벨이 잘리지 않게 짧은 라벨을 쓴다', () => {
    // 칸당 ~53px 라 '뷰티·헬스'(5자)는 잘린다. SSOT 에 shortLabel 을 두고 패널에서만 쓴다
    // (지도 오버레이는 폭이 넓어 긴 라벨 유지 — 카테고리 이름 자체를 줄이는 게 아니다).
    expect(code('src/pages/restaurant-map/voucher-types.ts')).toMatch(/shortLabel: '뷰티'/)
    expect(code(TOPBAR)).toMatch(/panel && v\.shortLabel \? v\.shortLabel :/)
  })

  it('/map 에서는 헤더의 딜 카테고리를 숨긴다 (좌측 패널과 두 벌 금지)', () => {
    const s = code('src/components/main/DesktopTopNav.tsx')
    expect(s).toMatch(/const hideDealCats = location\.pathname === '\/map'/)
    expect(s).toMatch(/\{!hideDealCats && DEAL_CATS\.map/)
    // ⚠️ 서비스 축(홈·교환권·동네딜·링크샵·블로그)까지 지우면 /map 에서 나갈 통로가 없어진다.
    expect(s).toMatch(/categoryItems\.map/)
  })
})

/**
 * 💀 죽은 사진 (2026-08-19 대표 신고 — "눌러보면 사진이 안 뜨는 경우가 있어").
 *
 * 라이브 실측: 활성 50개 · 갤러리 226장 중 **7장이 앱 경로로도 실패**(인스타 CDN·siksinhot·
 * daumcdn 403 · alba.kr 415). 그중 **6장이 커버가 아닌 갤러리 사진**이었다 — 이전 판은 대형
 * 사진만 감시해서 썸네일 칸의 실패를 못 잡았고, 그 칸이 회색으로 남았다.
 */
describe('이용권 상세 — 죽은 사진이 빈 칸으로 남지 않는다', () => {
  const GAL = 'src/pages/group-buy/DetailGallery.tsx'

  it('화면에 그려지는 사진 전부를 감시한다 (대형 + PC 썸네일)', () => {
    const s = code(GAL)
    // 감시 목록에 썸네일이 포함돼야 한다 — 대형 한 장만 넣으면 예전 상태로 되돌아간다.
    expect(s).toMatch(/images\.slice\(1, 1 \+ PC_THUMBS\)[\s\S]{0,120}list\.push/)
    expect(s).toMatch(/probes\.map\(/)
  })

  it('감시 URL 이 실제 렌더 URL 과 같은 폭을 쓴다 (추가 트래픽 0)', () => {
    // 폭이 다르면 리사이저 URL 이 달라져 요청이 재사용되지 않는다 = 진짜 추가 다운로드.
    const s = code(GAL)
    expect(s).toMatch(/\{ src: main, w: 1200 \}/)   // 대형 bg 도 1200
    expect(s).toMatch(/list\.push\(\{ src: t, w: 600 \}\)/) // 썸네일 bg 도 600
    expect(s).toMatch(/bg\(src, 600\)/)
  })

  it('실패한 사진은 목록에서 빠진다 (다음 사진이 그 자리로)', () => {
    const s = code(GAL)
    expect(s).toMatch(/onError=\{\(\) => setDead\(/)
    expect(s).toMatch(/rawImages\.filter\(\(u\) => !dead\.has\(u\)\)/)
  })
})

/**
 * 🧩 상세 페이지는 **한 벌의 갤러리**를 쓴다 (2026-08-19 대표 지시 —
 * *"앞으로는 이런 개선은 다른 카테고리와 함께 개선이 되어야 해"*).
 *
 * ## 왜 이 가드가 필요한가
 * 그루폰식 갤러리(좌 대형 + 우 썸네일 + `+N` 모달 + 죽은 사진 대체)를 만들었을 때 그것을 쓰는 곳은
 * **이용권/공구 상세 하나뿐**이었다. 숙소 상세는 자체 스와이프 갤러리라 개편이 닿지 않았고,
 * 대표가 숙소 화면을 보고 *"상세페이지 여전한데?"* 라고 신고했다. 원인은 디자인이 아니라 **구조**다 —
 * 같은 것을 두 벌로 갖고 있으면 반드시 한쪽만 고쳐진다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 쇼핑 상세(`/products/:id`)는 아직 단일 이미지 구조라 대상 밖이다.
 *   그쪽을 갤러리로 올릴 때 이 목록에 추가할 것.
 */
describe('상세 페이지는 같은 갤러리를 쓴다 (카테고리별로 갈리지 않게)', () => {
  const PAGES = [
    ['이용권·공구', 'src/pages/GroupBuyDetailPage.tsx'],
    ['숙소', 'src/pages/StayDetailPage.tsx'],
  ] as const

  for (const [label, file] of PAGES) {
    it(`${label} 상세가 공용 DetailGallery 를 쓴다`, () => {
      expect(code(file)).toMatch(/<DetailGallery\b/)
    })

    it(`${label} 상세가 공용 제목 헤더를 쓴다 (제목·별점·주소가 사진 위)`, () => {
      expect(code(file)).toMatch(/<DetailTitleHeader\b/)
    })
  }

  it('자체 스와이프 갤러리를 다시 만들지 않는다', () => {
    // 숙소가 갖고 있던 형태(scroll-snap + 자체 인덱스 상태)가 되살아나면 또 갈린다.
    const stay = code('src/pages/StayDetailPage.tsx')
    expect(stay).not.toMatch(/snap-x snap-mandatory/)
    expect(stay).not.toMatch(/setActiveImage/)
  })

  it('공용 제목 헤더는 표면에 의존하는 색을 쓰지 않는다', () => {
    // `.gbd` CSS 변수는 공구 상세 표면에서만 정의된다 — 숙소에서 쓰면 글자가 안 보인다.
    expect(code('src/pages/group-buy/DetailTitleHeader.tsx')).not.toMatch(/var\(--gbd-/)
  })

  it('라이트박스는 사진을 자르지 않고 화면 안에 넣는다', () => {
    // 대표 신고 2건이 한 줄에 있었다: 4:3 cover 배경 → 화면 밖으로 넘치고, 404 여도 검은 화면.
    const gal = code('src/pages/group-buy/DetailGallery.tsx')
    expect(gal).toMatch(/max-h-\[85vh\] object-contain/)
    expect(gal).not.toMatch(/aspectRatio: '4 \/ 3', \.\.\.bg\(main, 1600\)/)
  })
})

/**
 * 🖥️ PC 친화성 (2026-08-19 대표 — "PC 친화적이지 않은 페이지들 확인해서 PC 버전의 페이지도 완벽히").
 *
 * 실측(1440px, 소비자 라우트 15개): **9개가 430px 모바일 액자**에 갇혀 있었다. 가장 아까운 건
 * `/cart` — PC 2단(좌 목록 + 우 sticky 요약) 코드를 **이미 갖고 있었는데** 액자 폭이 430px 이라
 * `lg:grid` 가 발현될 자리가 없어 죽은 코드였다.
 */
describe('PC 풀너비 등재 (모바일 액자에 갇히지 않게)', () => {
  const fb = code('src/shared/pc-fullbleed.ts')

  it('장바구니·알림·쇼핑이 PC 풀너비다', () => {
    for (const p of ["'/cart'", "'/notifications'", "'/browse'"]) expect(fb).toContain(p)
  })

  it('하단 고정바가 PC 에서도 뜨는 페이지는 등재하지 않는다', () => {
    // pc-fullbleed 는 `app-frame-bar` 를 숨긴다 — `lg:hidden` 없이 그 바를 쓰는 페이지를 넣으면
    // PC 에서 CTA 가 통째로 사라진다. /referral 이 그런 페이지라 일부러 제외했다.
    expect(fb).not.toMatch(/'\/referral'/)
    const cart = code('src/pages/CartPage.tsx')
    expect(cart).toMatch(/app-frame-bar[\s\S]{0,160}lg:hidden/)  // 카트 하단바는 PC 에서 숨는다
  })

  it('쇼핑 그리드가 넓은 화면에서 열을 늘린다', () => {
    // 풀너비인데 3열이면 카드가 과하게 커진다.
    expect(code('src/pages/BrowsePage.tsx')).toMatch(/lg:grid-cols-4/)
  })
})
