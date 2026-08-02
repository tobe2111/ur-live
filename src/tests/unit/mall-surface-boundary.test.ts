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
import { isMallSlugCandidate, isMallSurfacePath, isMallProduct, MAIN_MALL } from '@/shared/mall/resolve'
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

describe('isMallSurfacePath — 한 세그먼트만 몰 표면', () => {
  it('두 세그먼트 이상은 몰 표면이 아니다', () => {
    // 🔴 상품 상세(`/products/123`)까지 몰 표면으로 잡으면 본진 상품 페이지에서 네비가 사라진다.
    expect(isMallSurfacePath('/products/123')).toBe(false)
    expect(isMallSurfacePath('/bangbae-mart/anything')).toBe(false)
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
    expect(/\)\.mall_id = Number\(sup\?\.mall_id \?\? MAIN_MALL\)/.test(routes)).toBe(true)
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
