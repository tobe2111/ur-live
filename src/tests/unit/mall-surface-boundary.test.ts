/**
 * 🏬 **몰 표면 경계** 불변식 — 대표 UX 기준 ⑤ *"본진 입구 금지"* (2026-08-02)
 *
 * 배경: 몰 홈(`MallHomePage`)은 기준 ⑤ 를 지키려고 `powered by 유어딜` 조차 클릭 못 하게 두는데,
 * 정작 **셸과 상품 상세가 새고 있었다** — 실측 3층:
 *   ① 앱 셸: `/{슬러그}` 에 유어딜 5탭 하단바 + PC 상단 네비 + 사이드배너
 *   ② 상품 상세: 비로그인 손님에게 *"🎁 회원가입하고 …적립받기"*, 로그인엔 *"내 링크샵에 담기"*
 *   ③ 상품 상세: **픽업 상품인데** "내일 도착 · 5만원 이상 무료" 배송 약속
 *
 * ⚠️ **이 파일이 못 막는 것**: 렌더 결과를 보지 않는다(React 미실행). 게이트가 *배선돼 있는지*만 본다.
 *   게이트 조건이 배선은 됐는데 **의미가 틀린** 경우(예: `mallProduct` 를 항상 false 로 계산)는
 *   못 잡는다 — 그 부분은 아래 순수함수 불변식이 담당한다.
 *
 * ⚠️ **주석 함정 주의**: 이 레포는 *"주석에 이름이 남아 있어 가드가 늘 통과"* 하는 사고를 반복했다.
 *   그래서 아래 배선 검사는 **산문에 나올 수 없는 코드 모양**(JSX 게이트 형태)으로만 앵커한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMallSlugCandidate, isMallSurfacePath, isMallProduct, mallRedirectPathFor, MAIN_MALL } from '@/shared/mall/resolve'
import { RESERVED_SLUGS } from '@/shared/mall/slug'
import { hasPickupInfo } from '@/pages/product-detail/ReceiveMethodNotice'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('isMallSlugCandidate — 예약어가 먼저다', () => {
  it('실제 소비자 라우트는 하나도 몰 후보가 아니다', () => {
    // 이게 깨지면 그 라우트가 몰로 해석돼 **페이지가 통째로 죽는다**.
    for (const r of RESERVED_SLUGS) expect(isMallSlugCandidate(r)).toBe(false)
  })
  it('예약어는 대소문자·공백에 관계없이 걸러진다', () => {
    expect(isMallSlugCandidate(' Products ')).toBe(false)
    expect(isMallSlugCandidate('ADMIN')).toBe(false)
  })
  it('문법 밖은 후보가 아니다', () => {
    expect(isMallSlugCandidate('ab')).toBe(false)          // 3자 미만
    expect(isMallSlugCandidate('a'.repeat(31))).toBe(false) // 30자 초과
    expect(isMallSlugCandidate('한글가게')).toBe(false)
    expect(isMallSlugCandidate('my_shop')).toBe(false)      // 밑줄 불가
    expect(isMallSlugCandidate('')).toBe(false)
    expect(isMallSlugCandidate(null)).toBe(false)
    expect(isMallSlugCandidate(undefined)).toBe(false)
  })
  it('정상 슬러그는 후보다', () => {
    expect(isMallSlugCandidate('bangbae-mart')).toBe(true)
    expect(isMallSlugCandidate('shop3')).toBe(true)
  })
})

describe('isMallSurfacePath — 몰 홈 + 몰 상품 상세만', () => {
  it('본진 상품 상세와 몰 하위 임의 경로는 몰 표면이 아니다', () => {
    // 🔴 본진 상품 상세(`/products/123`)를 몰 표면으로 잡으면 **본진** 상품 페이지에서 네비가 사라진다.
    //   (`products` 는 예약어라 슬러그 후보 자체가 아니다.)
    expect(isMallSurfacePath('/products/123')).toBe(false)
    // 🔴 넓힌 것은 `/p/{숫자}` **정확히 그 모양뿐**이다 — 나머지 몰 하위 경로는 그대로 false.
    expect(isMallSurfacePath('/bangbae-mart/anything')).toBe(false)
    expect(isMallSurfacePath('/bangbae-mart/p')).toBe(false)          // id 없음
    expect(isMallSurfacePath('/bangbae-mart/p/abc')).toBe(false)      // 숫자 아님
    expect(isMallSurfacePath('/bangbae-mart/p/0')).toBe(false)        // 0 은 상품 id 가 아니다
    expect(isMallSurfacePath('/bangbae-mart/p/12/extra')).toBe(false) // 더 깊은 경로
  })

  /**
   * 🔴 2026-08-11 〔대표 "그 서비스는 유어딜과 철저히 분리되어야 해"〕
   *
   * 그전까지 몰 표면은 **홈 한 장뿐**이었다. 그래서 손님이 상품을 누르는 순간 본진
   * `/products/:id` 로 나가 유어딜 탭바·배너를 보고, **가격도 상시가로 바뀌었다**
   * (몰 카드는 공구가 — 본진 상세는 `resolveGbPricing` 을 안 부른다).
   * ⇒ 상품 상세를 몰 표면에 포함한다. 그러면 App 셸의 `mallSurface` 배선이
   *   그 화면에서도 유어딜 크롬을 안 그린다(아래 '배선' 블록이 그 배선을 고정한다).
   */
  it('몰 상품 상세는 몰 표면이다', () => {
    expect(isMallSurfacePath('/bangbae-mart/p/123')).toBe(true)
    expect(isMallSurfacePath('/bangbae-mart/p/123/')).toBe(true)
    expect(isMallSurfacePath('/bangbae-mart/p/123?utm=kakao')).toBe(true)
    expect(isMallSurfacePath('/bangbae-mart/p/123#top')).toBe(true)
  })

  it('예약어는 몰 상품 상세 모양이어도 몰 표면이 아니다', () => {
    // `/products/p/1` 처럼 생겨도 1st 세그먼트가 예약어면 몰이 아니다.
    expect(isMallSurfacePath('/products/p/1')).toBe(false)
    expect(isMallSurfacePath('/admin/p/1')).toBe(false)
  })
  it('루트와 예약 라우트는 몰 표면이 아니다', () => {
    expect(isMallSurfacePath('/')).toBe(false)
    expect(isMallSurfacePath('')).toBe(false)
    expect(isMallSurfacePath('/vouchers')).toBe(false)
    expect(isMallSurfacePath('/browse')).toBe(false)
  })
  it('쿼리·해시·후행 슬래시가 판정을 바꾸지 않는다', () => {
    expect(isMallSurfacePath('/bangbae-mart')).toBe(true)
    expect(isMallSurfacePath('/bangbae-mart/')).toBe(true)
    expect(isMallSurfacePath('/bangbae-mart?utm=kakao')).toBe(true)
    expect(isMallSurfacePath('/bangbae-mart#top')).toBe(true)
  })
})

describe('isMallProduct — 모르면 본진', () => {
  it('신호가 없으면 본진으로 본다(현행 동작 유지)', () => {
    // 🔴 이 방향이 중요하다. 반대로 fail 하면 **본진 상품 전체**에서 성장 CTA 가 사라진다.
    expect(isMallProduct(null)).toBe(false)
    expect(isMallProduct(undefined)).toBe(false)
    expect(isMallProduct(Number.NaN)).toBe(false)
    expect(isMallProduct(MAIN_MALL)).toBe(false)
    expect(isMallProduct(0)).toBe(false)
    expect(isMallProduct(-3)).toBe(false)
  })
  it('본진이 아닌 몰이면 몰 상품이다', () => {
    expect(isMallProduct(2)).toBe(true)
    expect(isMallProduct(17)).toBe(true)
  })
})

describe('배선 — 앱 셸이 몰 표면에서 유어딜 크롬을 안 그린다', () => {
  const app = read('src/App.tsx')
  it('hideBottomNav 계산에 mallSurface 가 들어간다', () => {
    // 하단바·상단 네비가 같은 플래그를 쓰므로 이 한 줄이 둘 다 막는다.
    expect(/const hideBottomNav[\s\S]{0,400}?\|\|\s*mallSurface/.test(app)).toBe(true)
  })
  it('SideBanner 도 몰 표면에서 렌더되지 않는다', () => {
    expect(/!mallSurface[\s\S]{0,300}?<SideBanner/.test(app)).toBe(true)
  })
  it('mallSurface 는 shared SSOT 로 계산된다(자체 정규식 금지)', () => {
    expect(/const mallSurface = isMallSurfacePath\(location\.pathname\)/.test(app)).toBe(true)
  })
})

describe('배선 — 상품 상세가 두 신호를 각각 쓴다', () => {
  const page = read('src/pages/ProductDetailPage.tsx')
  it('유어딜 영입 CTA 는 !mallProduct 게이트 뒤다', () => {
    expect(/\{!mallProduct && \(\(\) => \{/.test(page)).toBe(true)
  })
  it('추천 섹션도 !mallProduct 게이트 뒤다', () => {
    expect(/\{!mallProduct && \(\s*<ReferralSection/.test(page)).toBe(true)
  })
  it('받는 방법은 형제 컴포넌트 둘이 담당한다(200줄 떨어진 두 자리로 되돌리지 않는다)', () => {
    expect(/<PickupNotice pickup=\{product\.pickup\} \/>/.test(page)).toBe(true)
    expect(/<DeliveryNotice pickup=\{product\.pickup\} \/>/.test(page)).toBe(true)
    // 🔴 페이지가 배송 문구를 **다시 인라인으로** 갖는 순간 이 사고가 재발한다.
    expect(page.includes('tomorrowDelivery')).toBe(false)
  })
  it('공유 버튼은 남는다 — 단톡방 확산은 운영자 이득이지 유어딜 영입이 아니다', () => {
    expect(page.includes('<KakaoShareButton')).toBe(true)
  })
})

/**
 * 🏬 **몰 손님이 본진으로 새지 않는다** (2026-08-11) 〔대표 "철저히 분리"〕
 *
 * 실측이 이 블록을 만들게 했다 — 같은 상품 하나가 세 화면에서 세 값을 냈다:
 *   몰 카드 = 공구가 / 본진 상세 = **상시가** / 결제 = 공구가.
 * 원인은 가격 한 줄이 아니라 **몰 카드가 본진으로 링크한 것**이었다(브랜드도 거기서 바뀌었다).
 *
 * ⚠️ 이 블록이 못 막는 것: 렌더/네트워크를 보지 않는다. **배선이 있는지**만 본다.
 *   실제 화면의 가격 일치는 배포 후 눈으로(또는 스모크) 확인해야 한다.
 */
describe('배선 — 몰 손님이 본진 상세로 새지 않는다', () => {
  it('몰 카드는 몰 경로로 링크한다 — 본진 /products 로 나가지 않는다', () => {
    const home = read('src/pages/MallHomePage.tsx')
    expect(/<Link to=\{mallProductPath\(mall\.slug, it\.product_id\)\}/.test(home)).toBe(true)
    // 🔴 되돌아가면 즉시 빨강: 카드가 본진 상품 상세로 링크하는 순간 분리가 깨진다.
    expect(/to=\{`\/products\/\$\{it\.product_id\}`\}/.test(home)).toBe(false)
  })

  it('본진 상세는 몰 상품을 그 가게로 되돌린다', () => {
    const page = read('src/pages/ProductDetailPage.tsx')
    // 단톡방에 남은 옛 링크·검색 유입도 전부 여기로 떨어지므로 링크 교체만으로는 안 막힌다.
    expect(page.includes('mallRedirectPathFor(product)')).toBe(true)
  })

  it('되돌림 판정과 canonical 리다이렉트가 **한 effect** 안에 있다', () => {
    const page = read('src/pages/ProductDetailPage.tsx')
    // 🔴 둘을 별도 effect 로 나누면 둘 다 navigate 해서 경합하고, 마지막 것이 이겨
    //   몰 손님이 다시 본진으로 나간다. 한 표현식 안에서 갈려야 한다.
    const m = page.match(/useEffect\(\(\) => \{[\s\S]*?canonicalDetailPath\(product\)[\s\S]*?\}, \[product, navigate\]\)/)
    expect(m).not.toBeNull()
    expect(m![0].includes('mallRedirectPathFor(')).toBe(true)
  })

  /** 되돌림 판정 자체(순수) — 배선 검사가 못 보는 '의미'를 여기서 값으로 고정한다. */
  it('mallRedirectPathFor — 슬러그를 모르면 안 보낸다(막다른 골목 방지)', () => {
    expect(mallRedirectPathFor({ id: 5, mall_id: 2, mall_slug: 'bangbae-mart' })).toBe('/bangbae-mart/p/5')
    expect(mallRedirectPathFor({ id: 5, mall_id: 2, mall_slug: null })).toBeNull()   // 경로로 못 여는 몰
    expect(mallRedirectPathFor({ id: 5, mall_id: MAIN_MALL, mall_slug: 'x' })).toBeNull() // 본진
    expect(mallRedirectPathFor(null)).toBeNull()
  })

  it('서버가 몰 상품에 mall_slug 를 실어야 되돌릴 수 있다', () => {
    const routes = read('src/features/products/api/products.routes.ts')
    expect(routes).toContain('stampConsumerMall(DB,')
    const mc = read('src/worker/utils/mall-consumer.ts')
    expect(/mall_slug/.test(mc)).toBe(true)
    // 🔴 본진 상품은 슬러그 조회 자체를 안 한다 — 핫패스에 왕복이 붙으면 안 된다.
    expect(/if \(mid !== MAIN_MALL\)/.test(mc)).toBe(true)
  })
})

/**
 * 🖼️ **몰 상품 링크의 카톡 카드** (2026-08-11)
 *
 * 경로를 옮기면 2026-08-09 에 PRODUCT 슬롯으로 막아 둔 *"몰 상품 공유가 본진 일반 카드로 나가는"*
 * 갭이 **새 경로에서 재발한다.** 잘못 나간 카드는 카톡 스크랩 캐시에 **박제**되고 회수 시점의
 * 통제권이 우리에게 없다 — 그래서 경로 이전과 **같은 커밋**에서 막는다.
 */
describe('배선 — 몰 상품 경로에 OG 슬롯이 있다', () => {
  const worker = read('src/worker/index.ts')
  it('MALLPRODUCT 슬롯이 몰 상품 API 를 가리킨다', () => {
    const helper = read('src/worker/utils/mall-ssr-meta.ts')
    expect(/slot: 'MALLPRODUCT', path: `\/api\/mall\/\$\{encodeURIComponent\(mp\.slug\)\}\/products\/\$\{mp\.productId\}`/.test(helper)).toBe(true)
    expect(worker).toContain('resolveMallProductSlot(url.pathname)')
  })
  it('경로 판정은 shared SSOT 를 쓴다 — 워커가 자체 정규식을 갖지 않는다', () => {
    const helper = read('src/worker/utils/mall-ssr-meta.ts')
    expect(/const mp = parseMallProductPath\(pathname\)/.test(helper)).toBe(true)
  })
  it('payload 가 없으면 메타를 만들지 않는다(fail-closed — 추측해서 박제하지 않는다)', () => {
    expect(/ssrSlot === 'MALLPRODUCT' && ssrPayload/.test(worker)).toBe(true)
  })
})

describe('픽업 상품에 배송을 약속하지 않는다', () => {
  it('hasPickupInfo — 빈 껍데기는 "픽업 없음"이다', () => {
    expect(hasPickupInfo(null)).toBe(false)
    expect(hasPickupInfo(undefined)).toBe(false)
    expect(hasPickupInfo({ date: null, place: null, storage: null })).toBe(false)
  })
  it('hasPickupInfo — 한 조각만 있어도 픽업이다', () => {
    // 🔴 운영자가 픽업일만 넣고 장소를 비워 둔 경우가 흔하다. 그때도 배송 약속은 나가면 안 된다.
    expect(hasPickupInfo({ date: '2026-08-10', place: null, storage: null })).toBe(true)
    expect(hasPickupInfo({ date: null, place: null, storage: 'cold' })).toBe(true)
  })
  it('두 컴포넌트가 같은 판정을 써서 배타성이 구조로 보장된다', () => {
    const src = read('src/pages/product-detail/ReceiveMethodNotice.tsx')
    expect(/export function DeliveryNotice[\s\S]{0,200}?if \(hasPickupInfo\(pickup\)\) return null/.test(src)).toBe(true)
    expect(/export function PickupNotice[\s\S]{0,200}?if \(!hasPickupInfo\(pickup\)/.test(src)).toBe(true)
  })
})

describe('배선 — 서버가 mall_id 를 상세 응답에 싣는다', () => {
  const routes = read('src/features/products/api/products.routes.ts')
  it('기존 가드 쿼리에 mall_id 를 얹어 왕복을 늘리지 않는다', () => {
    expect(/SELECT is_supply_product, supply_source_id, mall_id FROM products WHERE id = \?/.test(routes)).toBe(true)
  })
  it('응답 본문에 mall_id 를 스탬프한다', () => {
    // ⚠️ 2026-08-11 — 스탬프가 `stampConsumerMall`(mall-consumer)로 이동했다. 불변식은
    //   *"응답에 mall_id 를 싣는다 · 값의 출처는 DB 행이고 폴백은 MAIN_MALL 상수"* 이므로 그리로 앵커한다.
    expect(routes).toContain('stampConsumerMall(DB,')
    const mc = read('src/worker/utils/mall-consumer.ts')
    expect(/target\.mall_id = mid/.test(mc)).toBe(true)
    expect(/Number\(rawMallId \?\? MAIN_MALL\) \|\| MAIN_MALL/.test(mc)).toBe(true)
  })
})

describe('배선 — 슬러그 판정이 한 벌뿐이다', () => {
  const worker = read('src/worker/utils/mall-consumer.ts')
  it('워커는 shared 판정을 위임한다', () => {
    expect(/return isMallSlugCandidate\(seg\)/.test(worker)).toBe(true)
  })
  it('워커가 자기 정규식·예약어 집합을 다시 정의하지 않는다', () => {
    // 두 벌이 되는 순간 "워커는 몰로 보는데 클라는 아닌" 경로가 생기고, 거기서 탭바가 몰 위에 뜬다.
    expect(/\[a-z0-9-\]\{3,30\}/.test(worker)).toBe(false)
    expect(/new Set\(RESERVED_SLUGS\)/.test(worker)).toBe(false)
  })
})
