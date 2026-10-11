/**
 * 💸 이용권 최소 판매가 1,000원 (2026-10-11 대표 *"1000원 이상으로만 이용권 가격을 올릴 수 있게 … 최소가격을 정하는게 좋겠네"*)
 *
 * 왜: 이용권 1장이 팔리면 알림톡 2통(약 16원)이 나가는데, 중개 매장의 남는 몫은 판매가의 약 2.25%라
 *   1,000원 아래로는 팔수록 손해가 날 수 있다.
 *
 * 규칙은 `voucherMinPriceError`(shared/constants/voucher-categories) 하나이고, 서버 세 자리
 * (셀러 등록·셀러 수정·대행 등록)와 등록 화면이 그것을 부른다. 화면만 막으면 API 로 우회되고,
 * 등록만 막으면 수정으로 우회된다 — 그래서 셋 다 본다.
 *
 * ⚠️ 못 보는 것: 어드민이 만드는 상품(데모·교환권)은 의도적으로 대상이 아니다 · 이미 1,000원 미만으로
 *   등록된 상품은 고치지 않는다(실측 2026-10-11: 비활성 시험 상품 1건뿐).
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'
import { VOUCHER_MIN_PRICE, voucherMinPriceError } from '@/shared/constants/voucher-categories'

describe('규칙', () => {
  it('최소가는 1,000원', () => {
    expect(VOUCHER_MIN_PRICE).toBe(1000)
  })
  it('이용권은 1,000원 미만이면 막고, 1,000원부터 허용', () => {
    expect(voucherMinPriceError('meal_voucher', 999)).toMatch(/1,000원 이상/)
    expect(voucherMinPriceError('beauty_voucher', 0)).not.toBeNull()
    expect(voucherMinPriceError('meal_voucher', 1000)).toBeNull()
    expect(voucherMinPriceError('stay_voucher', 50000)).toBeNull()
  })
  it('레거시 카테고리도 이용권으로 본다', () => {
    expect(voucherMinPriceError('health_voucher', 500)).not.toBeNull()
  })
  it('이용권이 아니면(일반 상품·카테고리 없음) 막지 않는다', () => {
    expect(voucherMinPriceError('general', 500)).toBeNull()
    expect(voucherMinPriceError(null, 500)).toBeNull()
  })
})

describe('배선 — 우회 경로가 없다', () => {
  const seller = readCode('src/features/seller/api/seller-orders.routes.ts')
  it('셀러 등록(POST /products)이 막는다', () => {
    const post = sliceFrom(seller, "sellerOrdersRoutes.post('/products'", 'INSERT INTO products', 8000)
    expect(post.length).toBeGreaterThan(0)
    expect(post).toMatch(/voucherMinPriceError\(category, price\)/)
    expect(post).toMatch(/if \(priceErr\) return c\.json/)
  })
  it('셀러 수정(PUT /products/:id)이 막는다 — 바꾸지 않는 카테고리는 저장된 값으로', () => {
    const put = sliceFrom(seller, "sellerOrdersRoutes.put('/products/:id'", 'UPDATE products SET', 8000)
    expect(put.length).toBeGreaterThan(0)
    expect(put).toMatch(/SELECT id, category FROM products WHERE id = \? AND seller_id = \?/)
    expect(put).toMatch(/voucherMinPriceError\(canonicalCategory\(body\.category\) \?\? existing\.category, body\.price\)/)
    expect(put).toMatch(/if \(priceErr\) return c\.json/)
  })
  it('대행 등록(proxy-product)이 막는다', () => {
    const proxy = sliceFrom(readCode('src/worker/routes/curator.routes.ts'), "'/me/proxy-product'", 'INSERT INTO products', 4000)
    expect(proxy.length).toBeGreaterThan(0)
    expect(proxy).toMatch(/const minErr = voucherMinPriceError\(/)
    expect(proxy).toMatch(/if \(minErr\) return c\.json/)
  })
  it('등록 화면이 같은 규칙으로 미리 알려 준다(단계 이동 + 제출)', () => {
    const page = readCode('src/pages/SellerMealVoucherNewPage.tsx')
    expect(page.match(/voucherMinPriceError\(form\.category, form\.price\)/g)?.length).toBe(2)
  })
})
