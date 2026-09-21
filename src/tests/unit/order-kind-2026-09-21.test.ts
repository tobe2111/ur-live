/**
 * 🧾 **주문 종류 판정 + 주문관리 배송 UI 분기** (2026-09-21 대표 신고).
 *
 * 대표: *"이거 지금 이용권 결제인데 배송이고, 지금 셀러대시보드고 어드민대시보드고 주문관리 페이지가
 * 알맞지 않아."* / *"제품 배송이 아니라 이용권 구매잖아."*
 *
 * 라이브 주문 89(상품 2915 "테스트1", `category='meal_voucher'` · `deal_only=0`)가
 * 셀러 주문 상세에서 **배송 정보 빈 칸 셋 + "준비중으로 변경" 버튼 + 상품 0원**으로 떴다.
 *
 * ## 이 테스트가 못 막는 것
 * 실제 렌더 픽셀은 안 본다(jsdom 에 레이아웃이 없다). 여기서 고정하는 것은 **판정과 배선**이다 —
 * 서버가 종류를 실어 보내는가 · 화면이 그 값으로 갈리는가 · 판정이 SSOT 를 우회하지 않는가.
 * "배송 정보 섹션이 눈에 안 보인다" 는 배포 후 화면으로 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { orderKindOfItems, orderKindOf, isNoShippingOrder, ORDER_KIND_META } from '@/shared/order-kind'
import { stripComments } from '../helpers/source-text'

const ENRICH = readFileSync('src/worker/utils/order-list-enrich.ts', 'utf8')
const MODAL = readFileSync('src/pages/seller-orders/OrderDetailModal.tsx', 'utf8')
const ADMIN = readFileSync('src/pages/AdminOrdersPage.tsx', 'utf8')
const ADMIN_API = readFileSync('src/features/admin/api/admin-orders.routes.ts', 'utf8')

describe('🧾 주문 종류 판정 (SSOT)', () => {
  it('이용권 — meal_voucher + deal_only=0 (라이브 주문 89 의 실제 값)', () => {
    expect(orderKindOfItems([{ category: 'meal_voucher', deal_only: 0 }])).toBe('voucher')
  })

  it('교환권 — deal_only=1 이면 카테고리와 무관하게 교환권', () => {
    expect(orderKindOfItems([{ category: 'meal_voucher', deal_only: 1 }])).toBe('deal')
    expect(orderKindOfItems([{ category: null, deal_only: 1 }])).toBe('deal')
  })

  it('배송 — 일반 쇼핑 상품', () => {
    expect(orderKindOfItems([{ category: 'general', deal_only: 0 }])).toBe('shipping')
  })

  it('🔴 group_buy_status 로 분류하지 않는다 (migration 0146 이 전 상품을 active 로 만들었다)', () => {
    // 쇼핑 상품인데 group_buy_status='active' — 이걸로 갈랐다면 이용권으로 잘못 잡힌다.
    expect(orderKindOfItems([{ category: 'general', deal_only: 0, group_buy_status: 'active' }])).toBe('shipping')
  })

  it('🔒 모르면 배송이다 — 라인이 비면 운송장 칸을 지우지 않는다', () => {
    expect(orderKindOfItems([])).toBe('shipping')
  })

  it('🔒 하나라도 배송 상품이 섞이면 배송이다', () => {
    expect(orderKindOfItems([
      { category: 'meal_voucher', deal_only: 0 },
      { category: 'general', deal_only: 0 },
    ])).toBe('shipping')
  })

  it('서버 값이 없거나 이상하면 배송으로 읽는다 (구 응답 호환)', () => {
    expect(orderKindOf(undefined)).toBe('shipping')
    expect(orderKindOf(null)).toBe('shipping')
    expect(orderKindOf('나중에생길종류')).toBe('shipping')
    expect(orderKindOf('voucher')).toBe('voucher')
  })

  it('배송 없는 주문만 배송 UI 를 감춘다', () => {
    expect(isNoShippingOrder('voucher')).toBe(true)
    expect(isNoShippingOrder('deal')).toBe(true)
    expect(isNoShippingOrder('shipping')).toBe(false)
  })

  it('🏷️ 명칭 SSOT — 이용권과 교환권을 바꿔 부르지 않는다', () => {
    expect(ORDER_KIND_META.voucher.label).toBe('이용권')
    expect(ORDER_KIND_META.deal.label).toBe('교환권')
  })
})

describe('🔌 배선 — 서버가 종류를 실어 보낸다', () => {
  it('enrich 가 order_kind 를 SSOT 로 붙인다', () => {
    const src = stripComments(ENRICH)
    expect(src).toMatch(/orderKindOfItems\(/)
    expect(src).toMatch(/order_kind\s*=/)
  })

  it('💸 enrich 가 price 를 싣는다 (없으면 화면이 0원을 찍는다)', () => {
    const select = stripComments(ENRICH).match(/SELECT[^`]*FROM order_items/)?.[0] ?? ''
    expect(select, 'order_items SELECT 를 못 찾았다 — 이 검사가 헛돌고 있다').not.toBe('')
    expect(select).toMatch(/\bprice\b/)
  })

  it('어드민 쿼리가 deal_only 를 함께 읽는다 (카테고리만으론 이용권↔교환권이 안 갈린다)', () => {
    // 🩸 첫 판은 별칭(`as first_item_deal_only`)만 봤다 — 값을 NULL 로 바꿔도 통과했다(주입이 잡았다).
    //    별칭이 아니라 **products 에서 실제로 읽는지**를 앵커한다.
    expect(stripComments(ADMIN_API)).toMatch(/SELECT p\.deal_only FROM order_items[^)]*\) as first_item_deal_only/)
  })
})

describe('🔌 배선 — 화면이 그 값으로 갈린다', () => {
  it('셀러 상세가 배송 없는 주문에서 배송 상태 전이를 막는다', () => {
    const src = stripComments(MODAL)
    expect(src).toMatch(/noShipping\s*\?\s*null\s*:\s*nextStatusOf\(/)
  })

  it('셀러 상세가 배송 없는 주문에서 운송장 폼을 감춘다', () => {
    expect(stripComments(MODAL)).toMatch(/!noShipping\s*&&\s*order\.status\s*!==\s*'DELIVERED'/)
  })

  it('셀러 상세가 배송 정보 섹션을 종류로 가른다', () => {
    expect(stripComments(MODAL)).toMatch(/\{noShipping\s*\?\s*\(/)
  })

  it('🔴 화면이 종류를 다시 판정하지 않는다 — 서버 값만 읽는다', () => {
    // 화면이 카테고리로 종류를 정하기 시작하면 어드민이 이용권을 "교환권"이라 부르던 사고가 재발한다.
    const src = stripComments(MODAL)
    expect(src).toMatch(/orderKindOf\(order\.order_kind\)/)
    expect(src).not.toMatch(/isVoucherCategory|deal_only/)
  })

  it('어드민 종류 칸이 SSOT 로 판정한다 (isVoucherCategory 단독 판정 금지)', () => {
    const src = stripComments(ADMIN)
    expect(src).toMatch(/getNoShippingKind\(\{\s*category,\s*deal_only:/)
    expect(src).toMatch(/orderKind\(order\.first_item_category,\s*order\.first_item_deal_only\)/)
    expect(src, '카테고리 단독 판정이 되살아났다').not.toMatch(/isVoucherCategory\(/)
  })
})
