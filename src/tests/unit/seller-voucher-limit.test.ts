/**
 * 🎟️ 1인당 이용권 구매 한도 — 셀러가 설정할 수 있는가 (2026-08-22 대표 지시)
 *
 * 대표: "1인당 이용권 구매 가능한 갯수를 셀러가 셀러 대시보드에서 설정할 수 있도록 해줘."
 *
 * 조사해 보니 서버(저장·강제)는 이미 있었고 **화면만 막고 있었다**: 수정 폼이
 * `category === 'meal_voucher'` 하나로 게이트돼 있어 **이용권 4종 중 3종**(뷰티·숙박·기타)은
 * 처음부터 끝까지 한도를 설정할 수 없었다. 대표의 상시 지시 —
 * *"앞으로는 이런 개선은 다른 카테고리와 함께 개선이 되어야 해"* — 가 정확히 이 클래스다.
 *
 * 못 막는 것: 실제 브라우저에서 저장이 되는지, 그리고 결제 시 한도가 정말 걸리는지(런타임).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isVoucherCategory, normalizeCategory, VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'

const read = (p: string) => readFileSync(p, 'utf-8')
const EDIT = 'src/pages/SellerProductEditPage.tsx'
/** 이용권 입력 묶음은 2026-08-22 에 컴포넌트로 분리됐다(파일 크기 래칫). */
const FIELDS = 'src/pages/seller-product-edit/VoucherFields.tsx'
// 2026-08-23 위저드 리뉴얼: 카테고리 그리드는 2단계 스텝 컴포넌트로 이동했다.
const NEW = 'src/pages/seller-meal-voucher/VoucherInfoStep.tsx'
const SELLER_API = 'src/features/seller/api/seller-orders.routes.ts'
const JOIN = 'src/features/group-buy/api/group-buy.routes.ts'

describe('수정 폼이 이용권 4종 전부를 다룬다', () => {
  it('이용권 필드 블록이 meal_voucher 하나로 게이트되지 않는다', () => {
    const s = read(EDIT)
    expect(s, '다시 식사 이용권 전용으로 좁혀졌다 — 나머지 3종은 한도를 못 고친다').not.toMatch(
      /\{formData\.category === 'meal_voucher' && \(/,
    )
    expect(s).toContain('{isVoucherCategory(formData.category) && (')
  })

  it('저장 페이로드도 같은 판정을 쓴다 (화면만 열고 저장이 막히면 더 나쁘다)', () => {
    const s = read(EDIT)
    expect(s).toContain('...(isVoucherCategory(formData.category) ? {')
    expect(s).not.toContain("...(formData.category === 'meal_voucher' ? {")
  })

  it('카테고리 select 이 이용권 4종을 모두 갖는다 (빈칸 select = 조용한 카테고리 변경)', () => {
    const s = read(EDIT)
    for (const c of VOUCHER_CATEGORIES) {
      expect(s, `select 에 ${c} 옵션이 없다`).toContain(`<option value="${c}">`)
    }
  })

  it('1인당 한도 입력이 그 블록 안에 살아 있다', () => {
    const s = read(FIELDS)
    expect(s).toMatch(/name="max_per_person"/)
    // 서버 상한과 같아야 한다(1~99). 여기만 늘리면 저장이 조용히 무시된다.
    expect(s).toMatch(/name="max_per_person"[^>]*max=\{99\}/)
    // 분리한 컴포넌트가 실제로 렌더되는가 — 파일만 있고 안 붙으면 화면에서 사라진다.
    expect(read(EDIT)).toContain('<VoucherFields formData={formData} onChange={handleChange} />')
  })

  it('안내 문구가 서버 판정과 같은 말을 한다 (보유분 합산)', () => {
    const s = read(FIELDS)
    const near = s.slice(s.indexOf('name="max_per_person"'))
    expect(near.slice(0, 900), '"이미 보유한 이용권까지 합산" 을 안 말하면 셀러가 "한 번에 N개"로 오해한다')
      .toMatch(/보유한 이용권/)
  })

  it('매장 라벨이 식당 전용 문구가 아니다 (뷰티/숙박에 "식당명"은 거짓말)', () => {
    const s = read(FIELDS)
    expect(s).toContain("t('seller.products.storeName'")
    expect(s).not.toContain("t('seller.products.restaurantName')")
  })
})

describe('레거시 카테고리가 조용히 사라지지 않는다', () => {
  it('등록 화면이 주는 레거시 값이 SSOT 로 정규화된다', () => {
    // 등록 화면은 헬스/반려/액티비티를 고르게 해 주는데, 이들은 소비자 피드 필터
    // (`category IN VOUCHER_CATEGORIES`)에 안 걸린다 → 등록 성공 화면 + 어디에도 안 뜸.
    for (const legacy of ['health_voucher', 'pet_voucher', 'activity_voucher']) {
      expect(read(NEW), `등록 화면에 ${legacy} 가 없어졌다면 이 테스트를 갱신할 것`).toContain(legacy)
      const canon = normalizeCategory(legacy)
      expect(canon, `${legacy} 의 정규화 대상이 없다`).toBeTruthy()
      expect(VOUCHER_CATEGORIES as readonly string[]).toContain(canon!)
    }
  })

  it('서버가 저장 전에 정규화한다 (등록·수정 양쪽)', () => {
    const s = read(SELLER_API)
    // 함수 자체는 SSOT(`shared/constants/voucher-categories.ts`)에 산다 — 라우트는 호출만 한다.
    expect(read('src/shared/constants/voucher-categories.ts')).toContain('export function canonicalCategory')
    expect(s, '등록 경로 미적용').toContain('const category = canonicalCategory(body.category)')
    expect(s, '수정 경로 미적용').toContain("values.push(canonicalCategory(body.category))")
  })

  it('손으로 적은 카테고리 목록이 되살아나지 않는다 (드리프트 원인)', () => {
    const s = read(SELLER_API)
    expect(s, '6-way 하드코딩 목록이 부활했다 — 카테고리가 늘 때마다 여기서 갈린다').not.toMatch(
      /category === 'meal_voucher' \|\| category === 'beauty_voucher'/,
    )
  })
})

describe('서버 강제 — 화면만 고치면 아무것도 아니다', () => {
  it('구매 시 보유분까지 합산해 한도를 넘는지 본다 — 두 지점 모두', () => {
    // ⚠️ 처음엔 "파일에 이 쿼리가 있는가" 로 봤다가 **가드가 헛돌았다**: 같은 쿼리가 두 곳에 있어
    //    한쪽을 지워도 초록이 떴다(되돌려-검증에서 잡힘). 판정은 **개수**로 한다.
    //    두 지점은 서로 다른 일을 한다 — (1) `/join` 사전검증 (2) 과금 직전 재검증(다른 탭에서
    //    한도를 채우는 레이스 차단). 하나만 남으면 그 레이스로 한도가 뚫린다.
    const s = read(JOIN)
    const owned = s.match(
      /SELECT COUNT\(\*\) AS n FROM vouchers WHERE product_id = \? AND user_id = \?/g,
    )
    expect(owned?.length ?? 0, '보유분 합산 검사 지점이 2곳 미만이다 — 사전검증/과금직전 중 하나가 사라졌다')
      .toBeGreaterThanOrEqual(2)
    const limits = s.match(/PER_PERSON_LIMIT/g)
    expect(limits?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('한도 판정이 카테고리를 가리지 않는다 (이용권 4종 공통)', () => {
    const s = read(JOIN)
    const block = s.slice(s.indexOf('maxPerPerson'), s.indexOf('PER_PERSON_LIMIT') + 400)
    expect(block).not.toContain("=== 'meal_voucher'")
  })

  it('SSOT 판정 함수가 4종 + 레거시를 모두 이용권으로 본다', () => {
    for (const c of VOUCHER_CATEGORIES) expect(isVoucherCategory(c)).toBe(true)
    for (const c of ['health_voucher', 'pet_voucher', 'activity_voucher']) expect(isVoucherCategory(c)).toBe(true)
    expect(isVoucherCategory('fashion')).toBe(false)
    expect(isVoucherCategory(null)).toBe(false)
  })
})
