/**
 * 💸🔐 2026-11-18 — 돈이 새던 구멍 5건 (대표 승인 "5건 모두 지금 수정").
 *
 * ① 딜 결제 수량은 1 이상의 정수만 (0.01 개 → 값 1%, 교환권 한 장)
 * ② 광고 보상은 시청 증명이 붙을 때까지 지급하지 않는다
 * ③ 매장 쿠폰은 그 매장 상품에만 · 교환권은 쿠폰으로 안 깎는다 · 사업자 쿠폰의 값 범위
 * ④ 다객실 숙소 예약에서 방 하나 취소 = 그 방 값만 환불
 * ⑤ 카드 공구 확정이 과금 전에 /join 과 같은 문을 통과시킨다
 *
 * ## ⚠️ 못 보는 것
 * - **실결제**. 토스가 `cancelAmount` 를 받고 실제로 그 금액만 돌려주는지, 거절된 확정이 토스 쪽에서 자동 만료되는지는
 *   staging 실결제로만 판정된다(대표 몫 — `docs/STAGING_CHECKLIST.md`).
 * - 한 결제 키를 서로 다른 확정 주소 두 곳에 내미는 재사용(조사에서 SUSPECT) — 이 시험의 범위가 아니다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'
import {
  couponAppliesToOrder, capCouponToCouponable, isValidPurchaseQty, cleanSellerCoupon, AD_REWARD_DISABLED,
} from '@/shared/coupon-scope'
import { stayCancelAmount, stayIsSoleBooking, stayCancelAmountFor } from '@/features/group-buy/api/stay-cancel-amount'
import { confirmTossGate } from '@/features/group-buy/api/gb-purchase-guards'

describe('① 결제 수량', () => {
  it('정수 1~999 만', () => {
    for (const ok of [1, 2, 999]) expect(isValidPurchaseQty(ok), String(ok)).toBe(true)
    for (const no of [0.01, 1.5, 0, -1, 1000, NaN, Infinity, '1', null, undefined]) expect(isValidPurchaseQty(no), String(no)).toBe(false)
  })
  it('딜 결제가 그 판정을 쓴다', () => {
    const code = readCode('src/features/points/api/points.routes.ts')
    expect(code).toMatch(/const qty = Number\(item\.quantity\) \|\| 0;\s*if \(!isValidPurchaseQty\(qty\)\) \{/)
    expect(code).not.toMatch(/if \(qty <= 0\) \{/)
  })
})

describe('② 광고 보상', () => {
  it('꺼져 있고, 지급 로직보다 먼저 거절한다', () => {
    expect(AD_REWARD_DISABLED).toBe(true)
    const code = readCode('src/features/points/api/points.routes.ts')
    const seg = code.slice(code.indexOf("pointsRoutes.post('/ad-reward'"))
    const gate = seg.indexOf('AD_REWARD_DISABLED')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(seg.indexOf('point_transactions'))
    expect(seg.slice(0, 600)).toMatch(/code: 'AD_REWARD_DISABLED' \}, 403\)/)
  })
})

describe('③ 쿠폰', () => {
  it('매장 쿠폰은 모든 상품이 그 매장 것일 때만', () => {
    expect(couponAppliesToOrder({ seller_id: 7 }, [7, '7'])).toBe(true)
    expect(couponAppliesToOrder({ seller_id: 7 }, [7, 8])).toBe(false)
    expect(couponAppliesToOrder({ seller_id: 7 }, ['0'])).toBe(false) // 매장 없는 상품
    expect(couponAppliesToOrder({ seller_id: 7 }, [])).toBe(false)
    expect(couponAppliesToOrder({ seller_id: null }, [7, 8])).toBe(true) // 플랫폼 쿠폰은 종전대로
    expect(couponAppliesToOrder({}, [7])).toBe(true)
  })
  it('시작 전 쿠폰은 안 통한다', () => {
    const now = Date.parse('2026-11-18T00:00:00Z')
    expect(couponAppliesToOrder({ starts_at: '2026-11-19T00:00:00Z' }, [1], now)).toBe(false)
    expect(couponAppliesToOrder({ starts_at: '2026-11-17T00:00:00Z' }, [1], now)).toBe(true)
  })
  it('교환권 값은 쿠폰으로 안 깎인다', () => {
    const items = [{ deal_only: true, price: 5000, quantity: 1 }, { deal_only: false, price: 100, quantity: 2 }]
    expect(capCouponToCouponable(1_000_000, items)).toBe(200)
    expect(capCouponToCouponable(150, items)).toBe(150)
    expect(capCouponToCouponable(500, [{ deal_only: true, price: 5000, quantity: 1 }])).toBe(0)
    expect(capCouponToCouponable(-5, items)).toBe(0)
  })
  it('사업자 쿠폰 값 범위', () => {
    expect(cleanSellerCoupon({ type: 'percent', value: 10 })).toMatchObject({ ok: true, type: 'percent', value: 10, totalCount: 100, maxDiscount: null })
    expect(cleanSellerCoupon({ value: 3000 })).toMatchObject({ ok: true, type: 'fixed', value: 3000 })
    for (const bad of [
      { type: 'percent', value: 91 }, { type: 'percent', value: 0 }, { type: 'fixed', value: 1_000_001 }, { type: 'fixed', value: -1 },
      { type: 'fixed', value: 1.5 }, { type: 'free', value: 10 }, { type: 'fixed', value: 10, total_count: 0 },
      { type: 'fixed', value: 10, min_order: -1 }, { type: 'fixed', value: 10, max_discount: -3 }, { type: 'fixed', value: 'abc' },
    ]) expect(cleanSellerCoupon(bad).ok, JSON.stringify(bad)).toBe(false)
  })
  it('두 결제 경로와 쿠폰 만들기가 그 함수를 쓴다', () => {
    const pay = readCode('src/features/points/api/points.routes.ts')
    expect(pay).toMatch(/expires_at, starts_at, seller_id FROM coupons WHERE id = \? AND is_active = 1/)
    expect(pay).toMatch(/if \(!coupon \|\| !couponAppliesToOrder\(coupon, normalizedItems\.map\(i => i\.seller_id\)\)\) return c\.json\(/)
    expect(pay).toMatch(/computed = capCouponToCouponable\(computed, normalizedItems\);/)
    const ord = readCode('src/worker/routes/order.routes.ts')
    expect(ord).toMatch(/const inScope = couponAppliesToOrder\(coupon, orderItems\.map\(i => i\.seller_id\), now\);\s*if \(!expired && !notStarted && !soldOut && !belowMin && inScope\) \{/)
    const mk = readCode('src/features/seller/api/seller-analytics.routes.ts')
    expect(mk).toMatch(/const clean = cleanSellerCoupon\(\{ type, value, min_order, max_discount, total_count \}\)\s*if \(!clean\.ok\) return c\.json\(/)
    expect(mk).toMatch(/\.bind\(code, name, clean\.type, clean\.value, clean\.minOrder, clean\.maxDiscount, clean\.totalCount, sellerId, expires_at \|\| null\)/)
  })
})

describe('④ 숙소 취소 금액', () => {
  it('단독 예약의 100% 환불만 전체 취소(금액 생략)', () => {
    expect(stayCancelAmount(1.0, 80_000, true)).toBeUndefined()
    expect(stayCancelAmount(1.0, 80_000, false)).toBe(80_000) // 다객실 — 이 방 값만
    expect(stayCancelAmount(0.5, 40_000, true)).toBe(40_000)
    expect(stayCancelAmount(0.5, 40_000, false)).toBe(40_000)
  })
  it('예약 수를 모르면 단독이 아니다', () => {
    expect(stayIsSoleBooking(1)).toBe(true)
    for (const n of [2, 0, null, undefined, NaN]) expect(stayIsSoleBooking(n as number), String(n)).toBe(false)
  })
  it('조회 → 금액 (실패하면 이 방 값만)', async () => {
    const db = (n: number | Error) => ({
      prepare: () => ({ bind: () => ({ first: async () => { if (n instanceof Error) throw n; return { n } } }) }),
    }) as unknown as D1Database
    expect(await stayCancelAmountFor(db(1), 9, 1.0, 80_000)).toBeUndefined()
    expect(await stayCancelAmountFor(db(2), 9, 1.0, 80_000)).toBe(80_000)
    expect(await stayCancelAmountFor(db(new Error('d1')), 9, 1.0, 80_000)).toBe(80_000)
  })
  it('취소 라우트가 그 함수를 쓴다', () => {
    const code = readCode('src/features/group-buy/api/stays-public.routes.ts')
    // 2026-11-25: 같은 모듈을 핸들러 머리에서 한 번 불러(`sca`) 환불율·만료 판정과 함께 쓴다 — 부르는 함수와 인자는 그대로.
    expect(code).toMatch(/const sca = await import\('\.\/stay-cancel-amount'\)/)
    expect(code).toMatch(/amount: await sca\.stayCancelAmountFor\(c\.env\.DB, booking\.order_id, refundRate, refundAmount\),/)
    expect(code).not.toMatch(/amount: refundRate < 1\.0 \? refundAmount : undefined/)
  })
})

describe('⑤ 카드 공구 확정의 과금 전 문', () => {
  it('이용권/교환권만 · 본인 상품 거절 · 종료된 공구 거절', () => {
    expect(confirmTossGate({ category: 'meal_voucher', group_buy_status: 'active' }, false)).toBeNull()
    expect(confirmTossGate({ category: 'fashion', deal_only: 1, group_buy_status: 'active' }, false)).toBeNull()
    expect(confirmTossGate({ category: 'fashion', group_buy_status: 'active' }, false)?.status).toBe(404)
    expect(confirmTossGate({ category: 'meal_voucher', group_buy_status: 'active' }, true)).toMatchObject({ status: 403, code: 'SELF_PARTICIPATION_BLOCKED' })
    for (const st of ['expired', 'cancelled']) expect(confirmTossGate({ category: 'meal_voucher', group_buy_status: st }, false)?.status, st).toBe(400)
  })
  it('토스 승인보다 먼저 돈다', () => {
    const code = readCode('src/features/group-buy/api/group-buy.routes.ts')
    const seg = code.slice(code.indexOf("groupBuyRoutes.post('/confirm-toss'"))
    const gate = seg.indexOf('confirmTossGate(product, await isSelfOwnedGroupBuy(DB, product.seller_id, userId))')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(seg.indexOf('confirmTossPayment('))
  })
})
