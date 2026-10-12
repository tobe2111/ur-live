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
import { pickStore, type StoreRow } from '@/pages/agency-console/agency-stores-model'
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

describe('① 오늘 숫자 — 마이와 같은 규칙', () => {
  const agency = code('src/features/agency-console/api/agency-store-today.ts')
  const mine = code('src/features/seller/api/seller-operators.routes.ts')
  it.each([
    "status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?",
    "o.status IN ('PAID','DONE','PAY_COMPLETE') AND o.created_at >= datetime('now', '-30 days')",
    '${shippingOrderSql(\'o\')}',
    "is_active = 1 AND COALESCE(status, '') != 'DELETED'",
  ])('두 파일이 같은 문장을 쓴다: %s', (frag) => {
    expect(agency).toContain(frag)
    expect(mine).toContain(frag)
  })
})

describe('② 운영 중인 매장만 센다', () => {
  const src = code('src/features/agency-console/api/agency-stores.routes.ts')
  it('active 만 넘기고, 응답도 active 에만 숫자를 싣는다', () => {
    expect(src).toContain("agencyStoreToday(c.env.DB, (results || []).filter((r) => r.status === 'active').map((r) => r.seller_id))")
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

describe('④ 생김새 — 마이 판과 같은 클래스', () => {
  const agency = code('src/pages/agency-console/AgencyStorePlate.tsx')
  const mine = code('src/pages/user-profile/SellerSection.tsx')
  it.each([
    'relative w-full flex items-stretch min-h-[64px] rounded-[10px] bg-brand-tint',
    'absolute -left-[9px] top-1/2 -mt-[9px] w-[18px] h-[18px] rounded-full bg-surface',
    'border-l-2 border-dashed border-brand/35',
    'mt-2 text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap',
    'flex-1 min-w-0 text-[15px] font-extrabold truncate">이용권 등록 · 관리',
    'bg-brand text-white text-left active:opacity-90',
  ])('두 판이 같다: %s', (cls) => {
    expect(agency).toContain(cls)
    expect(mine).toContain(cls)
  })
  it('판은 같은 판 상수를 쓴다', () => {
    expect(agency).toContain('<div className={LIST_PLATE_CLS}>')
  })
})

describe('⑤ 도구는 시트로 · 정산은 보기만', () => {
  const plate = code('src/pages/agency-console/AgencyStorePlate.tsx')
  const panel = code('src/pages/agency-console/AgencyStoresPanel.tsx')
  it('주문 · 이용권 · 정산 · 매출 분석이 시트로 열린다', () => {
    for (const p of ["'/seller/orders'", "'/seller/group-buy'", "'/seller/settlements'", "'/seller/analytics'"]) {
      expect(plate).toContain(`openPage(${p}`)
    }
    expect(plate).toContain('<ToolPageSheet')
  })
  it('출금 시트를 두지 않는다(돈은 사장님만 — 서버가 주인만 받는다)', () => {
    expect(plate).not.toMatch(/WithdrawSheet|PinSheet|BankSheet/)
  })
  it('🔴 콘솔 어디서도 셀러 대시보드로 보내지 않는다(대시보드를 지우는 단계다)', () => {
    for (const src of [plate, panel, code('src/pages/agency-console/AgencyHomePage.tsx')]) {
      expect(src).not.toMatch(/navigate\('\/seller'\)/)
    }
  })
  // 🚪 2026-10-12 재조준 — 종전엔 *"에이전시엔 소비자 계정이 없어 /store/scan 이 아니라 /seller/scan"* 이었다.
  //   그 이유(라우트의 소비자 로그인 요구)를 걷었으므로 마이와 **같은 계산대**로 간다. 대시보드 틀을 안 탄다.
  it('사용처리는 카메라라 전체화면 — 마이와 같은 계산대(/store/scan), 대시보드 /seller/scan 아님', () => {
    expect(plate).toContain('export const AGENCY_SCAN_PATH = STORE_SCAN_PATH')
    expect(plate).toContain('onClick={() => goFull(AGENCY_SCAN_PATH)}')
    expect(plate).not.toContain("'/seller/scan'")
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
    expect(code('src/pages/agency-console/AgencyHomePage.tsx')).toContain('max-w-[720px] lg:max-w-[1040px]')
  })
})

describe('⑦ 그려 본다', () => {
  it('숫자 · 확인 대기 · 판매 중', () => {
    render(<AgencyStorePlate store={row()} staffId={7} />)
    expect(screen.getByText('412,000')).toBeTruthy()
    expect(screen.getByText('확인 대기 2건')).toBeTruthy()
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
