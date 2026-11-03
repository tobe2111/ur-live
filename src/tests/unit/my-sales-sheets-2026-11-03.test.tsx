/**
 * 🧾 마이 판매 시트 — 마이용으로 새로 (2026-11-03 대표 *"이런 페이지들 너무 붕 떠보이잖아"* → *"마이 용으로 만들어야"*
 *   → *"좋다 다 해줘"*, 시안 M1~M5 · `docs/design/my-seller-sheets-2026-11-03.md`).
 *
 * 지키는 것:
 *  ① 이용권·주문·매출 분석 세 주소는 마이용 시트로 연다(바로가기·전체 도구·깊은 링크 모두 `openPage` → `COVERED_BY_SHEET`).
 *  ② 마이용 시트 안의 깊은 화면(고치기·더 보기)은 `openRawPage` 로 — `openPage` 로 열면 자기 자신으로 되돌아와 **영영 못 연다**.
 *  ③ 데이터·서버 호출은 셀러 화면과 **한 벌**(같은 캐시 키 · 같은 동작 훅) — 두 벌이면 한쪽만 고쳐진다.
 *  ④ 주문은 단계 SSOT 로 묶고, 처리 대기 주문엔 [주문 확인]이 선다(이용권 주문엔 없다).
 *  ⑤ 아직 판매가 없으면 0원 + 등록 버튼 + '판매가 생기면 보이는 것'(빈 흰 면 금지).
 * ⚠️ 못 보는 것: 실기기 모양 · 셀러 화면 안의 폼(고치기) 자체.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const SECTION = readFileSync('src/pages/user-profile/SellerSection.tsx', 'utf8')
const HOST = readFileSync('src/pages/user-profile/my-sales/MySalesSheets.tsx', 'utf8')
const ORDERS = readFileSync('src/pages/user-profile/my-sales/MyOrdersSheet.tsx', 'utf8')
const VOUCHERS = readFileSync('src/pages/user-profile/my-sales/MyVouchersSheet.tsx', 'utf8')
const ACTIONS = readFileSync('src/pages/user-profile/my-sales/voucher-actions.ts', 'utf8')
const SELLER_ORDERS = readFileSync('src/pages/SellerOrdersPage.tsx', 'utf8')

describe('① 세 주소 → 마이용 시트', () => {
  it('표에 있다', () => {
    expect(SECTION).toContain("'/seller/group-buy': 'myVouchers', '/seller/orders': 'myOrders', '/seller/analytics': 'myAnalytics'")
  })
  it('openPage 가 표를 먼저 본다', () => {
    expect(SECTION).toMatch(/async function openPage[\s\S]{0,200}const covered = COVERED_BY_SHEET\[path\.split\(\/\[\?#\]\/\)\[0\]\]\s*\n\s*if \(covered\) \{ setPageFrom\(from\); setTool\(covered\); return \}/)
  })
  it('등록을 마치면 마이용 이용권 시트로', () => {
    expect(SECTION).toContain("setPage(null); setPageFrom(null); setTool('myVouchers')")
  })
})

describe('② 깊은 화면은 openRawPage', () => {
  it('자기 자신으로 되돌아오지 않는다', () => {
    expect(SECTION).toContain('onDeep={(p, t, from) => openRawPage(p, t, from)}')
    expect(HOST).toContain('onOpenPage={(p, t) => onDeep(p, t, which)}')
  })
})

describe('③ 데이터 한 벌', () => {
  it('주문: 같은 캐시 키 · 같은 동작 훅(셀러 화면도 그 훅)', () => {
    expect(ORDERS).toContain("queryKey: ['seller', 'orders']")
    expect(ORDERS).toContain("useOrderActions(")
    expect(SELLER_ORDERS).toContain("useOrderActions(")
    expect(SELLER_ORDERS, '셀러 화면이 환불을 따로 부르면 두 벌이 된다').not.toMatch(/api\.post\(`\/api\/seller\/orders\/\$\{orderNumber\}\/refund`/)
  })
  it('이용권: 같은 훅 · 같은 서버 계약(ACTIVE/HIDDEN)', () => {
    expect(VOUCHERS).toMatch(/useSellerVouchers, useSellerDeletedVouchers, useSellerWithdrawable/)
    expect(ACTIONS).toContain("status: next ? 'ACTIVE' : 'HIDDEN'")
  })
})

function withQuery(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: { success: true, data: [
      { id: '1', order_number: 'A1', user_name: '정지원', total_amount: 7500, status: 'DONE', payment_status: 'approved', shipping_name: '', shipping_phone: '', shipping_address: '', courier: null, tracking_number: null, created_at: '2026-10-12 02:11:00', updated_at: '', order_kind: 'voucher', vouchers: [{ code: 'x', status: 'used' }], items: [{ id: 1, product_id: 1, product_name: '등심돈까스', image_url: null, quantity: 1 }] },
      { id: '2', order_number: 'B2', user_name: '손님', total_amount: 20000, status: 'PAID', payment_status: 'approved', shipping_name: '손님', shipping_phone: '', shipping_address: '', courier: null, tracking_number: null, created_at: '2026-10-13 02:11:00', updated_at: '', order_kind: 'shipping', items: [{ id: 2, product_id: 2, product_name: '선물세트', image_url: null, quantity: 2 }] },
    ] } })),
    put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  },
}))

describe('④ 주문 시트', () => {
  it('날짜별 판 · 상태 배지 · 처리 대기엔 [주문 확인]', async () => {
    const { default: MyOrdersSheet } = await import('@/pages/user-profile/my-sales/MyOrdersSheet')
    withQuery(<MyOrdersSheet onClose={() => {}} />)
    // 처리 대기가 있으니 자동으로 그 탭이 열린다 — 할 일만 보인다
    expect(await screen.findByText('선물세트 ×2')).toBeTruthy()
    expect(screen.queryByText('등심돈까스')).toBeNull()
    expect(screen.getAllByRole('button', { name: '주문 확인' }).length).toBe(1)
    // 전체를 누르면 끝난 이용권 주문도 보이고, 그 줄엔 [주문 확인]이 없다
    fireEvent.click(screen.getByRole('button', { name: /^전체/ }))
    expect(screen.getByText('등심돈까스')).toBeTruthy()
    expect(screen.getByText('사용 완료')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '주문 확인' }).length).toBe(1)
  })
})

describe('⑤ 판매 없음', () => {
  it('0원 + 등록 + 미리 보기', async () => {
    vi.doMock('@/hooks/queries/useApiQuery', () => ({ useApiQuery: () => ({ data: { conversion_rate: 0, repeat_purchase_rate: 0, repeat_buyers: 0, total_buyers: 0 }, isLoading: false }) }))
    vi.resetModules()
    const { default: MyAnalyticsSheet } = await import('@/pages/user-profile/my-sales/MyAnalyticsSheet')
    withQuery(<MyAnalyticsSheet onClose={() => {}} onOpenPage={() => {}} onNew={() => {}} />)
    expect(screen.getByTestId('my-analytics-empty').textContent).toContain('0원')
    expect(screen.getByRole('button', { name: '이용권 등록하기' })).toBeTruthy()
    expect(screen.getByText('판매가 생기면 보이는 것')).toBeTruthy()
    vi.doUnmock('@/hooks/queries/useApiQuery')
  })
})
