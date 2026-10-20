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

/**
 * 🔴 **어드민 주문 목록이 폴백으로 조용히 떨어지던 것** (2026-09-21 배포 후 라이브 실측).
 *
 * 머지·배포 뒤 어드민 응답을 실제로 재 보니 `first_item_category`·`first_item_deal_only` 가
 * **키 자체가 없었다**(행에 20개 키뿐). 내가 추가한 필드만이 아니라 그 전부터 있던
 * `first_item_name`·`item_count` 도 없었다 — **주 쿼리가 던지고 폴백이 서빙 중**이었다.
 *
 * 원인: `COALESCE(o.shipping_zipcode, …)`. 그 컬럼은 `migrations/0010` 이 추가하지만
 * **마이그레이션이 라이브에 안 돈다**(D1 권한 없음 — CLAUDE.md 기술부채). 라이브의 실제 컬럼은
 * `shipping_postal_code` 하나다. SQLite 는 없는 컬럼에 파싱 단계에서 던지므로 쿼리 전체가 죽고,
 * 폴백이 고객명·셀러명·상품명·주문종류를 **빈 값**으로 채워 `success: true` 로 돌려줬다.
 * 그래서 어드민 주문관리가 몇 달간 반쪽이었는데 **아무도 몰랐다.**
 *
 * ⚠️ 이 가드가 못 잡는 것: `check-sql-column-exists` 는 INSERT/UPDATE 만 본다(`select-hits=0`).
 *    SELECT 전반을 검사하면 별칭·조인 때문에 오탐이 많아, 여기서는 **이 라우트의 `o.` 참조만**
 *    `production-schema.ts` 의 `OrdersTable`(라이브를 미러하는 SSOT)과 대조한다.
 */
describe('🔴 어드민 주문 SQL — 라이브에 없는 컬럼 참조 금지', () => {
  const SCHEMA = readFileSync('src/shared/db/production-schema.ts', 'utf8')

  /** `production-schema.ts` 의 `OrdersTable` 필드 이름 집합. */
  const ordersColumns = (() => {
    const body = SCHEMA.split('export interface OrdersTable {')[1]?.split('\n}')[0] ?? ''
    return new Set([...body.matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1]))
  })()

  it('SSOT 를 실제로 읽었다 (0개면 이 검사가 헛돈다)', () => {
    expect(ordersColumns.size).toBeGreaterThan(20)
    expect(ordersColumns.has('shipping_postal_code')).toBe(true)
    expect(ordersColumns.has('shipping_zipcode'), 'SSOT 에 없어야 이 검사가 의미 있다').toBe(false)
  })

  it('admin-orders 의 o.<컬럼> 참조가 전부 OrdersTable 에 있다', () => {
    const src = stripComments(ADMIN_API)
    const refs = [...src.matchAll(/\bo\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1])
    expect(refs.length, 'o. 참조를 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(10)
    const missing = [...new Set(refs)].filter((c) => !ordersColumns.has(c))
    expect(missing, `라이브 orders 에 없는 컬럼을 SELECT 한다 → 쿼리 전체가 던지고 폴백이 빈 값을 서빙한다: ${missing.join(', ')}`).toEqual([])
  })

  it('폴백이 조용하지 않다 — DEV 게이트 없이 로그를 남기고 응답에 표시한다', () => {
    const src = stripComments(ADMIN_API)
    expect(src, '폴백 경고가 DEV 게이트 뒤에 있으면 프로덕션에서 안 보인다')
      .toMatch(/^\s*console\.error\('\[Admin\] orders primary query failed/m)
    expect(src).toMatch(/degraded\s*=/)
    expect(src).toMatch(/\.\.\.\(degraded\s*\?\s*\{\s*degraded\s*\}\s*:\s*\{\}\)/)
  })
})

/**
 * 🛠️ **셀러 이용권 편집·삭제가 500** (2026-09-21 대표 신고 — 라이브 콘솔 `/api/seller/products/2915` 500).
 *
 * `GET /api/seller/products/:id` 가 `p.live_only_price`·`p.live_price_enabled` 를 SELECT 하는데
 * **라이브에 그 컬럼이 없다**(0112 마이그레이션에만 있고 repair-schema 가 안 만든다 — D1 실측
 * `no such column: p.live_only_price`). SQLite 는 파싱 단계에서 던지므로 **쿼리 전체가 죽어**
 * 편집 화면이 아예 안 열렸고, 그래서 삭제 버튼에도 못 닿았다(삭제 핸들러 자체는 멀쩡하다).
 *
 * 저장도 같이 막혀 있었다: 편집 페이지는 `LivePriceSection` 을 **렌더하지도 않으면서** 폼 기본값으로
 * 이 필드를 항상 실어 보내(`null`), `!== undefined` 가 늘 참이라 UPDATE 에 섞여 들어갔다.
 * 라이브커머스는 영구중단이라 되살릴 값이 아니다 — 서버가 쓰지 않는다.
 */
describe('🛠️ 셀러 상품 편집 — 라이브에 없는 컬럼으로 500 나지 않는다', () => {
  const SELLER_API = readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf8')

  it('상세 SELECT 가 라이브 컬럼 부재를 흡수한다 (있으면 읽고 없으면 그 둘만 뺀다)', () => {
    const src = stripComments(SELLER_API)
    expect(src).toMatch(/detailSql\s*=\s*\(withLive:\s*boolean\)/)
    expect(src).toMatch(/\$\{withLive\s*\?\s*' p\.live_only_price, p\.live_price_enabled,'\s*:\s*''\}/)
    expect(src, '폴백 재시도가 없으면 컬럼 부재가 그대로 500 이 된다').toMatch(/no such column/i)
  })

  it('🔴 컬럼 부재 외의 에러는 삼키지 않는다 (삼키면 다음 결함이 조용해진다)', () => {
    const src = stripComments(SELLER_API)
    expect(src).toMatch(/if\s*\(!\/no such column\/i\.test\([\s\S]{0,60}\)\)\s*throw e/)
  })

  it('UPDATE 가 죽은 라이브 전용가 컬럼을 더는 쓰지 않는다', () => {
    const src = stripComments(SELLER_API)
    expect(src).not.toMatch(/fields\.push\('live_only_price = \?'\)/)
    expect(src).not.toMatch(/fields\.push\('live_price_enabled = \?'\)/)
  })
})
