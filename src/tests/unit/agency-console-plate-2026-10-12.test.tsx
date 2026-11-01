/**
 * 🏢 셀러 대시보드 제거 2단계 — 에이전시 콘솔 안 A(모바일 + PC) (2026-10-12)
 *   대표: *"A안으로 해줘. 이건 PC버전도 중요해"*
 *
 * 지키는 것:
 *   ① 오늘 숫자는 마이와 **같은 규칙**으로 센다(같은 매장을 사장님·에이전시가 다른 숫자로 보면 안 된다)
 *   ② 운영 중인 매장만 센다 — 맡김 요청 단계는 아직 우리 매장이 아니다
 *   ③ 좌석은 누를 때만 받고, '내 좌석' 은 매장 id + **직원 id** 로 판정한다
 *   ④ 판의 생김새를 정하는 클래스가 마이 판과 같다(두 벌이 갈리면 빨간불)
 *   ⑤ 도구는 대시보드로 보내지 않고 시트로 연다 · 정산은 보기만(출금 시트 없음)
 *   ⑥ PC 는 소비자 액자 밖(두 칸이 액자 안에서는 성립하지 않는다)
 *   ⑦ 실제로 그려서 숫자·빈 값·정지 매장을 본다
 *
 * 이 시험이 **못 보는 것**: 실제 좌석 발급과 시트 안 화면(라이브 E4 — 에이전시 계정으로 판의 도구를 눌러 볼 것) ·
 *   PC 두 칸의 실제 배치(그림은 `node scripts/visual-preview.mjs --route=/agency --auth=agency --stub-file=… --pc`).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { pickStore, isAgencyScreen, AGENCY_PLATE_SCOPE_NOTE, type StoreRow } from '@/pages/agency-console/agency-stores-model'
import { isMyAgencySeat } from '@/pages/agency-console/agency-api'
import { storeRowHint } from '@/pages/agency-console/AgencyStoresPanel'
import AgencyStorePlate from '@/pages/agency-console/AgencyStorePlate'
import { stripComments } from '../helpers/source-text'

vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const row = (over: Partial<StoreRow> = {}): StoreRow => ({
  linkId: 1, sellerId: 401, status: 'active', name: '합정 살롱드합정', storeStatus: 'approved',
  requestedAt: '', acceptedAt: '', today: { todayRevenue: 412000, todayOrders: 9, pending: 2, activeProducts: 6 }, ...over,
})
const jwt = (claims: Record<string, unknown>) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`

describe('① 오늘 숫자 — 마이와 같은 판정 문장 · 🤝 이 에이전시 이용권만(2026-10-24 대표 확정)', () => {
  const agency = code('src/features/agency-console/api/agency-store-today.ts')
  const mine = code('src/features/seller/api/seller-operators.routes.ts')
  // 상태·KST 날짜·배송 판정·판매 중 판정은 마이와 같은 말이다(별칭만 다르다). 갈리면 둘이 다른 숫자를 말한다.
  it.each([
    ["o.status IN ('PAID','DONE') AND DATE(o.created_at, '+9 hours') = ?", "status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?"],
    ["o.status IN ('PAID','DONE','PAY_COMPLETE') AND o.created_at >= datetime('now', '-30 days')", "o.status IN ('PAID','DONE','PAY_COMPLETE') AND o.created_at >= datetime('now', '-30 days')"],
    ['${shippingOrderSql(\'o\')}', '${shippingOrderSql(\'o\')}'],
    ["p.is_active = 1 AND COALESCE(p.status, '') != 'DELETED'", "is_active = 1 AND COALESCE(status, '') != 'DELETED'"],
  ])('같은 판정: %s', (a, m) => {
    expect(agency).toContain(a)
    expect(mine).toContain(m)
  })
  it('🔴 세 숫자 모두 이 에이전시 이용권만 센다 — 판매는 맡은 기간(agency_product_periods), 판매 중은 지금 맡음', () => {
    const fn = agency.slice(agency.indexOf('export async function agencyStoreToday'))
    // 📊 2026-10-24 — 판매 귀속은 '판 순간 맡고 있던 에이전시'(사장님 성과표와 같은 문장 — channel-sales.periodMatchSql).
    expect(fn).toContain("JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'oi.product_id', 'o.seller_id')} AND pr.agency_id = ?")
    expect(fn).toContain('JOIN agency_products ap ON ap.product_id = p.id AND ap.agency_id = ?')
    expect(fn).not.toMatch(/SUM\(total_amount\)/) // 주문 총액이 아니라 자기 이용권 줄의 금액
  })
})

describe('② 운영 중인 매장만 센다', () => {
  const src = code('src/features/agency-console/api/agency-stores.routes.ts')
  it('active 만 넘기고(+ 이 에이전시 id), 응답도 active 에만 숫자를 싣는다', () => {
    expect(src).toContain("agencyStoreToday(c.env.DB, (results || []).filter((r) => r.status === 'active').map((r) => r.seller_id), me.agencyId)")
    expect(src).toContain("today: r.status === 'active' ? today.get(r.seller_id) ?? null : null,")
  })
})

describe('③ 좌석 — 누를 때만 · 내 좌석은 직원 id 까지', () => {
  it('같은 매장 · 같은 직원이면 내 좌석', () => {
    expect(isMyAgencySeat(401, 7, jwt({ seller_id: 401, agency_staff_id: 7 }))).toBe(true)
  })
  it('🔴 같은 매장이어도 다른 직원의 좌석은 아니다(매장 컴퓨터를 같이 쓴다)', () => {
    expect(isMyAgencySeat(401, 7, jwt({ seller_id: 401, agency_staff_id: 8 }))).toBe(false)
  })
  it('사장님 본인 좌석(직원 id 없음)도 아니다', () => {
    expect(isMyAgencySeat(401, 7, jwt({ seller_id: 401 }))).toBe(false)
  })
  it('다른 매장 · 토큰 없음 · 깨진 토큰', () => {
    expect(isMyAgencySeat(401, 7, jwt({ seller_id: 402, agency_staff_id: 7 }))).toBe(false)
    expect(isMyAgencySeat(401, 7, null)).toBe(false)
    expect(isMyAgencySeat(401, 7, 'garbage')).toBe(false)
  })
  it('판은 화면을 여는 것만으로 좌석을 받지 않는다 — 발급은 ensureSeat 한 곳, effect 에서 부르지 않는다', () => {
    const src = code('src/pages/agency-console/AgencyStorePlate.tsx')
    expect(src.match(/enterAgencyStore\(/g)?.length).toBe(1)
    const fn = src.slice(src.indexOf('async function ensureSeat'), src.indexOf('async function openPage'))
    expect(fn).toContain('enterAgencyStore(')
    expect(fn).toContain('if (isMyAgencySeat(store.sellerId, staffId)) return true')
    expect(src).not.toMatch(/useEffect/)
  })
  it('매장을 고르면 기억하고, 목록에 없으면 첫 매장으로 돌아간다', () => {
    const a = row({ sellerId: 401 }); const b = row({ sellerId: 402, linkId: 2 })
    expect(pickStore([a, b], 402)?.sellerId).toBe(402)
    expect(pickStore([a, b], 999)?.sellerId).toBe(401)
    expect(pickStore([], 401)).toBeNull()
  })
})

/**
 * 🔁 2026-10-25 — 대표가 **마이 '내 가게'** 를 안 G 로 확정했다(사용처리·등록 두 칸 + 목록 판). 이 확정은
 *   마이 화면의 것이고 **에이전시 콘솔 판은 범위 밖**이라 그대로 둔다(콘솔은 자기 이용권만 다루는 다른 판이다 —
 *   사용처리도 주문·정산도 없다). 그래서 두 판의 *같은 클래스* 대조는 **판 상수 · 진한 블루 면** 둘로 좁힌다.
 *   ⚠️ 콘솔도 G 로 맞추라는 지시가 오면 이 목록을 다시 넓힐 것.
 */
describe('④ 생김새 — 마이 판과 같은 클래스', () => {
  const agency = code('src/pages/agency-console/AgencyStorePlate.tsx')
  const mine = code('src/pages/user-profile/SellerSection.tsx')
  it('콘솔 판은 자기 모양(오늘 숫자 · 진한 블루 등록 줄)을 지킨다', () => {
    expect(agency).toContain('mt-2 text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap')
    expect(agency).toContain('flex-1 min-w-0 text-[15px] font-extrabold truncate">이용권 등록 · 관리')
  })
  it('두 판의 진한 블루 면은 같은 클래스 묶음이다', () => {
    expect(agency).toContain('bg-brand text-white text-left active:opacity-90')
    expect(mine).toContain('bg-brand text-white text-left active:opacity-90')
  })
  it('판은 같은 판 상수를 쓴다', () => {
    expect(agency).toContain('<div className={LIST_PLATE_CLS}>')
  })
})

describe('⑤ 🤝 판은 자기 이용권만 — 매장 전체 도구는 없다 (2026-10-24 대표 확정)', () => {
  const plate = code('src/pages/agency-console/AgencyStorePlate.tsx')
  const panel = code('src/pages/agency-console/AgencyStoresPanel.tsx')
  it('이용권만 시트로 연다', () => {
    expect(plate).toContain("openPage('/seller/group-buy'")
    expect(plate).toContain('<ToolPageSheet')
  })
  it('🔴 주문 · 정산 · 매출 분석 · 전체 도구 · 사용처리를 판에서 열지 않는다(서버도 에이전시 좌석에게 막는다)', () => {
    for (const p of ["'/seller/orders'", "'/seller/settlements'", "'/seller/analytics'"]) expect(plate).not.toContain(`openPage(${p}`)
    expect(plate).not.toMatch(/AllToolsSheet|goScan\(/)
  })
  it('깊은 링크도 에이전시 화면만 받는다 — 매장 전체 화면 주소면 판으로 연다', () => {
    expect(plate).toContain('if (initialPath && !isAgencyScreen(initialPath)) initialPath = undefined')
    expect(isAgencyScreen('/seller/group-buy')).toBe(true)
    expect(isAgencyScreen('/seller/meal-voucher/new')).toBe(true)
    expect(isAgencyScreen('/seller/products/12/edit')).toBe(true)
    for (const p of ['/seller/orders', '/seller/settlements', '/seller/analytics', '/seller/scan', '/seller/products']) expect(isAgencyScreen(p)).toBe(false)
  })
  it('출금 시트를 두지 않는다(돈은 사장님만 — 서버가 주인만 받는다)', () => {
    expect(plate).not.toMatch(/WithdrawSheet|PinSheet|BankSheet/)
  })
  it('🔴 콘솔 어디서도 셀러 대시보드로 보내지 않는다(대시보드를 지우는 단계다)', () => {
    for (const src of [plate, panel, code('src/pages/agency-console/AgencyHomePage.tsx')]) {
      expect(src).not.toMatch(/navigate\('\/seller'\)/)
    }
  })
  it('왜 주문·정산이 없는지 판이 직접 말한다', () => {
    expect(plate).toContain('{AGENCY_PLATE_SCOPE_NOTE}')
    expect(AGENCY_PLATE_SCOPE_NOTE).toMatch(/사장님/)
  })
})

describe('⑥ PC — 소비자 액자 밖 · 두 칸', () => {
  it('/agency 는 액자에서 빠진다', () => {
    const src = code('src/components/MobileAppLayout.tsx')
    const list = src.slice(src.indexOf('const HIDE_SIDEBAR_PREFIXES = ['), src.indexOf(']', src.indexOf('const HIDE_SIDEBAR_PREFIXES = [')))
    expect(list).toContain("'/agency',")
  })
  it('같은 DOM 을 순서만 바꿔 쓴다(폰: 판이 먼저 / PC: 목록이 왼쪽)', () => {
    const src = code('src/pages/agency-console/AgencyStoresPanel.tsx')
    expect(src).toContain('order-2 lg:order-1 lg:w-[300px] lg:shrink-0')
    expect(src).toContain('order-1 lg:order-2 min-w-0 flex-1')
  })
  it('페이지 폭이 PC 에서 넓어진다', () => {
    // 🏠 2026-10-26 안 A — 콘솔 화면이 마이로 옮겨갔다. 이메일 전용 에이전시 마이가 그 넓은 폭을 이어받는다
    //   (`/agency` 는 이제 마이로 보내는 문이다). 손님 마이 안에서는 칸이 좁아 한 칸(`stacked`)으로 그린다.
    expect(code('src/pages/agency-console/AgencyMyPage.tsx')).toContain('max-w-[720px] lg:max-w-[1040px]')
  })
})

describe('⑦ 그려 본다', () => {
  it('숫자 · 확인 대기 · 판매 중 — "우리 이용권" 몫이라고 말한다', () => {
    const { container } = render(<AgencyStorePlate store={row()} staffId={7} />)
    expect(screen.getByText('412,000')).toBeTruthy()
    expect(screen.getByText('오늘 · 우리 이용권')).toBeTruthy()
    expect(container.textContent).toContain('주문 9건 · 확인 대기 2건')
    expect(screen.getByText('판매 중 6개')).toBeTruthy()
  })
  it('숫자를 못 셌으면 0 으로 지어내지 않는다', () => {
    render(<AgencyStorePlate store={row({ today: null })} staffId={7} />)
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText(/판매 중/)).toBeNull()
  })
  it('정지 매장은 도구를 못 연다', () => {
    render(<AgencyStorePlate store={row({ storeStatus: 'suspended' })} staffId={7} />)
    for (const b of screen.getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true)
  })
  it('목록 오른쪽 값 — 할 일이 먼저, 그다음 상태, 그다음 오늘 매출', () => {
    expect(storeRowHint(row())).toEqual({ text: '확인 대기 2', urgent: true })
    expect(storeRowHint(row({ storeStatus: 'pending', today: { todayRevenue: 0, todayOrders: 0, pending: 0, activeProducts: 0 } })).text).toBe('유어딜 승인 대기')
    expect(storeRowHint(row({ today: { todayRevenue: 88000, todayOrders: 3, pending: 0, activeProducts: 4 } })).text).toBe('오늘 88,000원')
  })
})
