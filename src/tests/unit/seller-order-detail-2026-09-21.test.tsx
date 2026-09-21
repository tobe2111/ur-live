/**
 * 🧾 **셀러 주문 상세 — 대표 신고 3건**(2026-09-21)
 *   *"주문 상세 부분 뭐야. 이미지도 안나오고. 주문번호 너무 복잡해. 그리고 어떤 이용권인지도 나와야지"*
 *
 * 세 가지를 고정한다:
 *   ① 서버가 **화면이 읽는 이름**(`image_url`)으로 사진을 싣고, 스냅샷이 비면 상품 사진으로 채운다
 *   ② 주문번호는 짧게 보이되 전체가 사라지지 않고, 짧은 쪽이 **검색에 걸린다**
 *   ③ 이용권 코드가 화면에 나오고, **모르는 것과 없는 것을 구분**한다
 *
 * ## 이 테스트가 못 막는 것
 * - jsdom 엔 레이아웃이 없다 → "표 칸에서 줄바꿈이 안 난다" 는 **못 잰다**(브라우저로 봐야 한다).
 * - 실제 D1 대신 스텁을 쓴다 → SQL 문법 오류는 `check-sql-*` 가드가 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, renderHook, screen } from '@testing-library/react'
import { usePaymentMethodText } from '@/pages/seller-orders/statusHelpers'
import { shortOrderNo } from '@/shared/order-number-display'
import { VoucherCodes } from '@/pages/seller-orders/VoucherCodes'
import { enrichSellerOrderRows } from '@/worker/utils/order-list-enrich'
import { stripComments } from '../helpers/source-text'

const src = (p: string) => readFileSync(p, 'utf8')
const code = (p: string) => stripComments(src(p))

/** 질의 내용으로 결과를 고르는 최소 D1 스텁 — 실제 바인딩 순서까지 흉내 낸다. */
function stubDB(rows: { items?: unknown[]; products?: unknown[]; vouchers?: unknown[]; meta?: unknown[] }) {
  return {
    prepare(sql: string) {
      const pick = () =>
        /FROM order_items/.test(sql) ? rows.items ?? []
        : /FROM products/.test(sql) ? rows.products ?? []
        : /FROM vouchers/.test(sql) ? rows.vouchers ?? []
        : rows.meta ?? []
      return { bind: () => ({ all: async () => ({ results: pick() }) }) }
    },
  } as unknown as D1Database
}

describe('① 사진 — 서버가 화면이 읽는 이름으로 싣는다', () => {
  it('스냅샷이 비면 현재 상품 사진으로 채운다', async () => {
    const orders: Record<string, unknown>[] = [{ id: 89 }]
    await enrichSellerOrderRows(
      stubDB({
        items: [{ order_id: 89, product_id: 2915, product_name: '테스트1', quantity: 1, price: 1000, product_image: null }],
        products: [{ id: 2915, category: 'meal_voucher', deal_only: 0, image_url: 'https://cdn.example/ms.jpg' }],
      }),
      orders,
    )
    const it0 = (orders[0].items as Record<string, unknown>[])[0]
    expect(it0.image_url).toBe('https://cdn.example/ms.jpg')
  })

  it('주문 시점 스냅샷이 있으면 그것을 이긴다 — 그때 팔린 사진이 진실', async () => {
    const orders: Record<string, unknown>[] = [{ id: 1 }]
    await enrichSellerOrderRows(
      stubDB({
        items: [{ order_id: 1, product_id: 7, quantity: 1, product_image: 'https://cdn.example/snap.jpg' }],
        products: [{ id: 7, category: '패션', deal_only: 0, image_url: 'https://cdn.example/now.jpg' }],
      }),
      orders,
    )
    expect((orders[0].items as Record<string, unknown>[])[0].image_url).toBe('https://cdn.example/snap.jpg')
  })

  it('둘 다 없으면 null — 빈 문자열로 채우면 화면이 "사진 있음"으로 오해한다', async () => {
    const orders: Record<string, unknown>[] = [{ id: 1 }]
    await enrichSellerOrderRows(
      stubDB({ items: [{ order_id: 1, product_id: 7, quantity: 1, product_image: null }], products: [{ id: 7, image_url: null }] }),
      orders,
    )
    expect((orders[0].items as Record<string, unknown>[])[0].image_url).toBeNull()
  })

  it('모달이 그 이름을 읽고, 죽은 외부 자리표시자 대신 SSOT 폴백을 쓴다', () => {
    const c = code('src/pages/seller-orders/OrderDetailModal.tsx')
    expect(c).toMatch(/cfImage\(item\.image_url/)
    expect(c).toMatch(/cfImageOnError\(e\.currentTarget, item\.image_url\)/)
    expect(c).not.toContain('via.placeholder.com')
  })
})

describe('② 주문번호 — 짧게 보이되 전체가 사라지지 않는다', () => {
  it('토스 orderId 의 꼬리 6자리를 딴다', () => {
    expect(shortOrderNo('GB-3-1789611467065')).toBe('#467065')
  })

  it('짧은 쪽이 전체 번호의 부분문자열이라 목록 검색에 그대로 걸린다', () => {
    const full = 'GB-3-1789611467065'
    expect(full.includes(shortOrderNo(full).replace('#', ''))).toBe(true)
  })

  it('이미 짧은 번호는 더 줄이지 않는다 — 줄이면 오히려 못 알아본다', () => {
    expect(shortOrderNo('ORD-77')).toBe('ORD-77')
  })

  it('빈 값에 `#` 만 남기지 않는다', () => {
    expect(shortOrderNo(null)).toBe('')
    expect(shortOrderNo('')).toBe('')
  })

  it('부품이 전체 번호를 계속 그린다 — 감추면 셀러↔어드민↔토스 번역 문제가 생긴다', () => {
    const c = code('src/pages/seller-orders/OrderNumber.tsx')
    expect(c).toMatch(/short !== value &&/)
    expect(c).toMatch(/\{value\}/)
  })

  it('표와 모달이 같은 부품을 쓴다(두 벌로 갈리지 않게)', () => {
    expect(code('src/pages/SellerOrdersPage.tsx')).toMatch(/<OrderNumber value=\{order\.order_number\}/)
    expect(code('src/pages/seller-orders/OrderDetailModal.tsx')).toMatch(/<OrderNumber value=\{order\.order_number\} copyable/)
  })
})

describe('③ 이용권 — 어떤 권인지 화면에 나온다', () => {
  it('서버가 주문에 코드를 붙인다', async () => {
    const orders: Record<string, unknown>[] = [{ id: 89 }]
    await enrichSellerOrderRows(
      stubDB({
        items: [{ order_id: 89, product_id: 2915, quantity: 1 }],
        products: [{ id: 2915, category: 'meal_voucher', deal_only: 0, image_url: null }],
        vouchers: [{ order_id: 89, code: 'UR-LUBA-RCP5', status: 'unused', used_at: null, expires_at: null }],
      }),
      orders,
    )
    expect((orders[0].vouchers as { code: string }[])[0].code).toBe('UR-LUBA-RCP5')
  })

  it('이용권이 없는 주문엔 필드를 안 붙인다 — 빈 배열은 "0장"이라는 단언이다', async () => {
    // ⚠️ 픽스처 주의: 조회 결과를 통째로 비우면 함수가 **일찍 반환**해 이 분기를 안 탄다.
    //    그래서 *다른* 주문(89)에는 권이 있고 이 주문(5)에는 없는 상태로 만든다 —
    //    주입 러너가 이걸 잡아 줬다("결함을 심었는데 테스트가 통과").
    const orders: Record<string, unknown>[] = [{ id: 5 }, { id: 89 }]
    await enrichSellerOrderRows(
      stubDB({
        items: [{ order_id: 5, product_id: 7, quantity: 1 }, { order_id: 89, product_id: 7, quantity: 1 }],
        products: [{ id: 7 }],
        vouchers: [{ order_id: 89, code: 'UR-AAAA-BBBB', status: 'unused' }],
      }),
      orders,
    )
    expect(orders[0].vouchers).toBeUndefined()
    expect((orders[1].vouchers as unknown[]).length).toBe(1)
  })

  it('코드와 상태를 실제로 그린다', () => {
    render(<VoucherCodes vouchers={[{ code: 'UR-LUBA-RCP5', status: 'unused' }]} />)
    expect(screen.getByText('UR-LUBA-RCP5')).toBeTruthy()
    expect(screen.getByText('미사용')).toBeTruthy()
  })

  it('모르는 상태를 "미사용"으로 둔갑시키지 않는다 — 셀러가 손님을 받아 버린다', () => {
    render(<VoucherCodes vouchers={[{ code: 'UR-AAAA-BBBB', status: 'refunded' }]} />)
    expect(screen.getByText('refunded')).toBeTruthy()
    expect(screen.queryByText('미사용')).toBeNull()
  })

  it('모르는 것(undefined)과 없는 것([])을 구분한다', () => {
    const { container, rerender } = render(<VoucherCodes vouchers={undefined} />)
    expect(container.textContent).toBe('')
    rerender(<VoucherCodes vouchers={[]} />)
    expect(container.textContent).toContain('아직 발급된 이용권이 없습니다')
  })

  it('모달이 이용권 주문에서 그 목록을 배선한다', () => {
    const c = code('src/pages/seller-orders/OrderDetailModal.tsx')
    expect(c).toMatch(/kind === 'voucher' && order\.vouchers &&/)
    expect(c).toMatch(/<VoucherCodes vouchers=\{order\.vouchers\}/)
  })
})

describe('⑤ CSV 내보내기 — 화면과 같은 말을 쓴다', () => {
  it('믿을 수 없는 결제상태 대신 결제수단을 쓰고, 이용권 코드를 함께 낸다', () => {
    const c = code('src/pages/SellerOrdersPage.tsx')
    expect(c).toMatch(/payMethodText\(order\.payment_method\),/)
    expect(c).toMatch(/order\.vouchers \|\| \[\]\)\.map\(v => v\.code\)/)
  })
})

describe('④ 결제상태 — 믿을 수 없는 컬럼을 셀러에게 보여 주지 않는다', () => {
  it('모달·표 어디에도 payment_status 배지가 없다', () => {
    for (const p of ['src/pages/seller-orders/OrderDetailModal.tsx', 'src/pages/SellerOrdersPage.tsx']) {
      expect(code(p)).not.toMatch(/order\.payment_status/)
    }
  })

  it('대신 결제수단을 보여 준다 — 표·모달이 같은 SSOT 를 쓴다', () => {
    for (const p of ['src/pages/seller-orders/OrderDetailModal.tsx', 'src/pages/SellerOrdersPage.tsx']) {
      expect(code(p)).toMatch(/payMethodText\(order\.payment_method\)/)
    }
  })

  it('모르는 결제수단은 라벨을 지어내지 않고 원문 그대로 돌려준다', () => {
    const { result } = renderHook(() => usePaymentMethodText())
    expect(result.current('toss')).toBe('카드')
    expect(result.current('deal_points')).toBe('딜')
    expect(result.current('carrier_billing')).toBe('carrier_billing')
    expect(result.current(null)).toBe('-')
  })
})
