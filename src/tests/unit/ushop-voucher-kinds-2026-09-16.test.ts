/**
 * 🎟️ **셀러가 올린 이용권은 네 종류 다 유어샵에 뜬다** (2026-09-16 대표 지시).
 *
 * 대표: *"셀러가 셀러대시보드에서 이용권을 올려도 셀러의 계정의 유어샵에 이용권들 보여주는걸로 하자."*
 *
 * ## 🩸 무엇이 틀려 있었나 — 여기가 이 파일에서 제일 값진 부분이다
 * `SellerPublicPage` 가 이용권을 `p.category === 'meal_voucher'` **한 종류로 판정**하고 있었다.
 * 이용권은 네 종류다(`VOUCHER_CATEGORIES` — 식사·미용·숙소·기타) + 레거시 3종.
 *
 * 🔴 **사라지지 않아서 더 나빴다.** 서버는 네 종류를 다 내려준다(`/api/products?seller_id=N` 에는
 * deal_only/voucher 제외 필터가 안 걸린다 — `ProductRepository.findAll` 의 그 블록은
 * `excludeDealOnly` 일 때만 돈다). 그래서 미용·숙소·기타 이용권은 **여집합인 '내 상품'(쇼핑) 섹션**으로
 * 흘러들어갔다. 분류·섹션 제목·헤더 카운트·카드 목적지(`/products/:id` = 쇼핑 상세)가 전부 틀렸는데
 * **에러가 하나도 안 났다.** 미용 이용권 하나만 올린 셀러는 화면에 '이용권' 이라는 단어가
 * 한 번도 안 나왔다.
 *
 * 일반 유저 유어샵(`CuratorPage`)과 카테고리 칩은 **이미 4종을 다뤘다** — 사업자 페이지만 뒤처져 있었다.
 * 즉 같은 개념의 판정이 두 벌이었고, 한 벌만 갱신됐다. 그래서 여기서는 **SSOT 를 쓰는지**를 고정한다.
 *
 * ## 이 검사가 못 하는 것
 * 실제 렌더는 안 한다(서버 응답·라우팅까지는 다른 가드의 몫). 여기서는 **분류 규칙이 SSOT 를
 * 쓰는지**와 그 규칙의 **동작**을 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { VOUCHER_CATEGORIES, isVoucherCategory } from '@/shared/constants/voucher-categories'

const PAGE = readCode('src/pages/SellerPublicPage.tsx')
const CURATOR = readCode('src/worker/routes/curator.routes.ts')

describe('이용권 판정은 SSOT 로 (한 종류로 박지 않는다)', () => {
  it('🔒 SellerPublicPage 가 isVoucherCategory 를 쓴다', () => {
    expect(PAGE, 'SSOT 를 import 하지 않는다').toMatch(
      /import \{[^}]*isVoucherCategory[^}]*\} from '@\/shared\/constants\/voucher-categories'/,
    )
    expect(PAGE, '이용권 목록이 SSOT 로 갈리지 않는다').toMatch(
      /const vouchers = products\.filter\(p => isVoucherCategory\(p\.category\)\)/,
    )
  })

  it('🔒 상품 목록은 이용권의 **여집합**이고 그것도 SSOT 로 판정한다', () => {
    // 한쪽만 SSOT 로 바꾸면 이용권이 두 섹션에 모두 뜨거나 어디에도 안 뜬다.
    expect(PAGE).toMatch(
      /const shopProducts = products\.filter\(p => !isVoucherCategory\(p\.category\) && Number\(p\.deal_only\) !== 1\)/,
    )
  })

  it('🔒 한 종류 하드코딩이 되살아나지 않는다', () => {
    const body = PAGE.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(body, "카테고리를 'meal_voucher' 로 직접 비교하고 있다").not.toMatch(/category\s*[=!]==\s*'meal_voucher'/)
  })
})

describe('SSOT 동작 — 네 종류 + 레거시를 모두 이용권으로 본다', () => {
  it('선언된 네 종류가 전부 이용권이다', () => {
    expect(VOUCHER_CATEGORIES.length).toBe(4)
    for (const c of VOUCHER_CATEGORIES) expect(isVoucherCategory(c), `${c} 가 이용권이 아니라고 나온다`).toBe(true)
  })

  it('레거시 카테고리도 이용권이다 (마이그레이션 중 행이 사라지지 않게)', () => {
    for (const c of ['health_voucher', 'pet_voucher', 'activity_voucher']) {
      expect(isVoucherCategory(c), `${c}`).toBe(true)
    }
  })

  it('일반 쇼핑 카테고리는 이용권이 아니다 (반대 방향 오염 차단)', () => {
    for (const c of ['general', '피자/치킨', '', null, undefined]) {
      expect(isVoucherCategory(c as string), `${String(c)}`).toBe(false)
    }
  })

  it('분류가 양쪽으로 완전히 갈린다 — 겹치거나 빠지는 상품이 없다', () => {
    const products = [
      { id: 1, category: 'meal_voucher', deal_only: 0 },
      { id: 2, category: 'beauty_voucher', deal_only: 0 },
      { id: 3, category: 'stay_voucher', deal_only: 0 },
      { id: 4, category: 'etc_voucher', deal_only: 0 },
      { id: 5, category: 'health_voucher', deal_only: 0 },   // 레거시
      { id: 6, category: 'general', deal_only: 0 },          // 일반 상품
      { id: 7, category: '피자/치킨', deal_only: 1 },         // 교환권 — 어느 쪽도 아니다
    ]
    const vouchers = products.filter((p) => isVoucherCategory(p.category))
    const shop = products.filter((p) => !isVoucherCategory(p.category) && Number(p.deal_only) !== 1)
    expect(vouchers.map((p) => p.id)).toEqual([1, 2, 3, 4, 5])
    expect(shop.map((p) => p.id)).toEqual([6])
    // 교환권(deal_only=1)은 셀러가 등록하지 않는다 — 양쪽 어디에도 안 들어가는 것이 맞다.
    expect(vouchers.concat(shop).some((p) => p.id === 7)).toBe(false)
  })
})

describe('담은 핀의 교환권 판정 — 서버가 근거를 실어 보낸다', () => {
  it('🔒 핀 SELECT 가 deal_only 를 내려준다', () => {
    // 클라(`CuratorPage` isVoucher)가 `deal_only === 1` 을 보는데 이 컬럼이 없으면
    // 값이 늘 undefined 라 그 분기가 **한 번도 참이 안 된다**(담은 교환권이 '추천템' 으로 갔다).
    expect(CURATOR, '핀 SELECT 에 deal_only 가 없다').toMatch(/COALESCE\(p\.deal_only, 0\) AS deal_only/)
  })
})
