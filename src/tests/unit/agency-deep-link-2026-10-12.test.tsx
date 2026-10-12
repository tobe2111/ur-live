/**
 * 🚪 셀러 대시보드 제거 3단계 — **에이전시 직원 몫** (2026-10-12)
 *   알림·메일의 `/seller/*` 깊은 링크로 온 에이전시 직원을 대시보드 대신 **에이전시 콘솔**로 보내고,
 *   콘솔이 그 매장의 판에서 같은 화면을 시트로 연다(2단계 안 A 의 판).
 *
 * 지키는 것:
 *   ① 어디로 보내나 — 하위 주소는 `/agency?tool=`, 홈류는 `/agency`, 전용 길·`dash=1` 은 그대로
 *   ② 누구를 — 에이전시 좌석 **이고** 콘솔 로그인이 이 브라우저에 살아 있을 때만(아니면 로그인 뒤 링크를 잃는다)
 *   ③ 콘솔은 좌석을 새로 받지 않는다 — 이 직원의 그 매장 좌석일 때만 열고, 아니면 대시보드로 되돌린다(왕복 0)
 *   ④ 배선 — 껍데기는 사장님 판정 **뒤**, 시트 안에서는 안 보낸다 · 콘솔이 연 전체화면은 다시 안 돌아온다
 *
 * 이 시험이 **못 보는 것**: 실제 알림 링크 → 콘솔 → 시트의 브라우저 이동(라이브 E4 — 에이전시 계정 필요).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, waitFor } from '@testing-library/react'
import {
  AGENCY_CONSOLE_TOKEN_KEY, consoleRedirectFor, dashboardFallback, shouldSendAgencyToConsole,
} from '@/lib/seller-deep-link'
import { AGENCY_TOKEN_KEY } from '@/pages/agency-console/agency-api'
import { stripComments } from '../helpers/source-text'

const STORES = {
  success: true, canManage: false,
  stores: [
    { linkId: 21, sellerId: 401, status: 'active', name: '합정 살롱드합정', storeStatus: 'approved', requestedAt: '', acceptedAt: '', today: { todayRevenue: 1, todayOrders: 1, pending: 0, activeProducts: 1 } },
    { linkId: 22, sellerId: 402, status: 'active', name: '연남 브런치하우스', storeStatus: 'approved', requestedAt: '', acceptedAt: '', today: null },
  ],
}
vi.mock('@/pages/agency-console/agency-api', async (orig) => {
  const real = await orig<typeof import('@/pages/agency-console/agency-api')>()
  return { ...real, agencyRequest: vi.fn(async () => ({ ok: true, status: 200, data: STORES })) }
})
vi.mock('@/pages/user-profile/seller-section/ToolPageSheet', () => ({
  default: ({ path }: { path: string }) => <div data-testid="tool-sheet">{path}</div>,
}))
vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const jwt = (claims: Record<string, unknown>) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`
const toolOf = (url: string | null) => (url ? new URL(url, 'https://x').searchParams.get('tool') : null)

describe('① 어디로 보내나', () => {
  it('하위 주소는 콘솔 + ?tool= (쿼리 유지)', () => {
    const url = consoleRedirectFor('/seller/orders', '?status=PAID')
    expect(url?.startsWith('/agency?tool=')).toBe(true)
    expect(toolOf(url)).toBe('/seller/orders?status=PAID')
  })
  it('홈류는 콘솔 첫 화면', () => {
    for (const p of ['/seller', '/seller/dashboard', '/seller/more']) expect(consoleRedirectFor(p, '')).toBe('/agency')
  })
  // 🚪 2026-10-12 재조준 — 계산대·등록은 대시보드에 남기지 않고 전용 길로(마이와 같은 판정). OAuth 복귀만 남는다.
  it('🔴 dash=1 · OAuth 복귀는 그대로, 계산대는 /store/scan, 등록은 콘솔 ?tool=', () => {
    expect(consoleRedirectFor('/seller/orders', '?dash=1')).toBeNull()
    expect(consoleRedirectFor('/seller/youtube/callback', '')).toBeNull()
    expect(consoleRedirectFor('/seller/scan', '')).toBe('/store/scan')
    expect(toolOf(consoleRedirectFor('/seller/meal-voucher/new', ''))).toBe('/seller/meal-voucher/new')
  })
  it.each(['/seller/orders', '/seller/products/3/edit?x=1'])('되돌린 주소는 다시 안 보낸다(왕복 0): %s', (p) => {
    const back = dashboardFallback(p)
    const [path, rest] = back.split('?')
    expect(consoleRedirectFor(path, `?${rest}`)).toBeNull()
  })
})

describe('② 누구를', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('에이전시 좌석 + 콘솔 로그인 → 보낸다', () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 401, agency_staff_id: 7 }))
    localStorage.setItem(AGENCY_CONSOLE_TOKEN_KEY, 'tok')
    expect(shouldSendAgencyToConsole(false)).toBe(true)
  })
  it('"이 탭만" 로그인(sessionStorage)도 살아 있는 로그인이다', () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 401, agency_staff_id: 7 }))
    sessionStorage.setItem(AGENCY_CONSOLE_TOKEN_KEY, 'tok')
    expect(shouldSendAgencyToConsole(false)).toBe(true)
  })
  it('콘솔 로그인이 없으면 안 보낸다 — 로그인 화면을 거치면 링크를 잃는다', () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 401, agency_staff_id: 7 }))
    expect(shouldSendAgencyToConsole(false)).toBe(false)
  })
  it('사장님 좌석 · 시트 안은 안 보낸다', () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 401 }))
    localStorage.setItem(AGENCY_CONSOLE_TOKEN_KEY, 'tok')
    expect(shouldSendAgencyToConsole(false)).toBe(false)
    localStorage.setItem('seller_token', jwt({ seller_id: 401, agency_staff_id: 7 }))
    expect(shouldSendAgencyToConsole(true)).toBe(false)
  })
  it('토큰 자리 이름이 콘솔과 같다(두 벌이면 영영 안 보낸다)', () => {
    expect(AGENCY_CONSOLE_TOKEN_KEY).toBe(AGENCY_TOKEN_KEY)
  })
})

describe('③ 콘솔이 여는 규칙 — 좌석을 새로 받지 않는다', () => {
  let replace: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    replace = vi.fn()
    Object.assign(window.location, { pathname: '/agency', search: '?tool=%2Fseller%2Forders', replace })
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  })
  async function mount() {
    const { AgencyStoresPanel } = await import('@/pages/agency-console/AgencyStoresPanel')
    render(<AgencyStoresPanel onExpired={() => {}} staffId={7} />)
  }
  it('이 직원의 그 매장 좌석이면 그 매장을 고르고 시트를 연다', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 7 }))
    await mount()
    await waitFor(() => expect(screen.getByTestId('tool-sheet').textContent).toBe('/seller/orders'))
    expect(replace).not.toHaveBeenCalled()
    expect(localStorage.getItem('agency_console_store')).toBe('402')
  })
  it('🔴 다른 직원의 좌석이면 열지 않고 대시보드로 되돌린다(dash=1)', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 8 }))
    await mount()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/seller/orders?dash=1'))
    expect(screen.queryByTestId('tool-sheet')).toBeNull()
  })
  it('맡은 매장이 아닌 좌석이면 되돌린다', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 999, agency_staff_id: 7 }))
    await mount()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/seller/orders?dash=1'))
  })
})

describe('④ 배선', () => {
  it('껍데기는 시트 안 반환 뒤 · 사장님 판정 뒤에 콘솔로 보낸다', () => {
    // 2026-10-12 — 판정이 `sellerEntryRedirect` 한 곳으로 모였다(하단 ➕ · 유어샵 버튼도 같은 함수). 순서는 그 안에서 본다.
    const src = stripComments(readFileSync('src/components/SellerLayout.tsx', 'utf-8'))
    const embed = src.indexOf('if (bare || embedded) {')
    const judge = src.indexOf('const toMyOrConsole = sellerEntryRedirect(location.pathname, location.search)')
    expect(embed).toBeGreaterThan(0)
    expect(judge).toBeGreaterThan(embed)
    expect(src).toContain('if (toMyOrConsole) return <Navigate to={toMyOrConsole} replace />')
    const lib = stripComments(readFileSync('src/lib/seller-deep-link.ts', 'utf-8'))
    const fn = lib.slice(lib.indexOf('export function sellerEntryRedirect('))
    const owner = fn.indexOf('const toMy = shouldSendOwnerToMy(false) ? myRedirectFor(pathname, search) : null')
    const agency = fn.indexOf('return shouldSendAgencyToConsole(false) ? consoleRedirectFor(pathname, search) : null')
    expect(owner).toBeGreaterThan(0)
    expect(agency).toBeGreaterThan(owner)
  })
  it('콘솔이 연 전체화면은 dash=1 을 달아 다시 콘솔로 튕기지 않는다', () => {
    const src = stripComments(readFileSync('src/pages/agency-console/AgencyStorePlate.tsx', 'utf-8'))
    expect(src).toContain('window.location.assign(dashboardFallback(path))')
  })
  it('깊은 링크는 한 번만 쓴다 — 다른 매장 갔다 돌아와도 다시 안 열린다', () => {
    const src = stripComments(readFileSync('src/pages/agency-console/AgencyStoresPanel.tsx', 'utf-8'))
    expect(src).toContain('if (!deepPath || deepDone.current) return')
    expect(src).toContain('deepDone.current = true')
  })
})
