/**
 * 🚪 셀러 대시보드 제거 3단계 — **에이전시 직원 몫** (2026-10-12)
 *   알림·메일의 `/seller/*` 깊은 링크로 온 에이전시 직원을 대시보드 대신 **에이전시 콘솔**로 보내고,
 *   콘솔이 그 매장의 판에서 같은 화면을 시트로 연다(2단계 안 A 의 판).
 *
 * 지키는 것:
 *   ① 어디로 보내나 — 하위 주소는 `/agency?tool=`, 홈류는 `/agency`, 계산대는 `/store/scan`, OAuth 복귀만 그 자리
 *   ② 누구를 — 에이전시 좌석이면(콘솔 로그인이 없어도 — 콘솔이 로그인 뒤 `?tool=` 을 잇는다)
 *   ③ 콘솔은 좌석을 새로 받지 않는다 — 이 직원의 그 매장 좌석일 때만 열고, 아니면 **말한다**(2026-10-12 대시보드 삭제 — 되돌릴 곳이 없다)
 *   ④ 배선 — 틀은 시트 밖에서만 보낸다 · 콘솔 도구는 전부 시트
 *
 * 이 시험이 **못 보는 것**: 실제 알림 링크 → 콘솔 → 시트의 브라우저 이동(라이브 E4 — 에이전시 계정 필요).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, waitFor } from '@testing-library/react'
import { AGENCY_CONSOLE_TOKEN_KEY, isAgencyWorker, sellerEntryRedirect } from '@/lib/seller-deep-link'
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
import { toast } from '@/hooks/useToast'

const jwt = (claims: Record<string, unknown>) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`
const toolOf = (url: string | null) => (url ? new URL(url, 'https://x').searchParams.get('tool') : null)

describe('① 어디로 보내나 (에이전시 직원)', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear()
    localStorage.setItem('seller_token', jwt({ seller_id: 401, agency_staff_id: 7 }))
  })
  it('하위 주소는 콘솔 + ?tool= (쿼리 유지)', () => {
    const url = sellerEntryRedirect('/seller/orders', '?status=PAID')
    expect(url?.startsWith('/agency?tool=')).toBe(true)
    expect(toolOf(url)).toBe('/seller/orders?status=PAID')
  })
  it('홈류는 콘솔 첫 화면', () => {
    for (const p of ['/seller', '/seller/dashboard', '/seller/more']) expect(sellerEntryRedirect(p, '')).toBe('/agency')
  })
  // 🧭 2026-10-12 대시보드 삭제 — `dash=1`(대시보드로 되돌리는 표시)은 없다. 남는 예외는 OAuth 복귀 하나.
  it('🔴 OAuth 복귀만 그 자리(틀 없이 렌더), 계산대는 /store/scan, 등록은 콘솔 ?tool=', () => {
    expect(sellerEntryRedirect('/seller/youtube/callback', '?code=x')).toBeNull()
    expect(sellerEntryRedirect('/seller/scan', '')).toBe('/store/scan')
    expect(toolOf(sellerEntryRedirect('/seller/meal-voucher/new', ''))).toBe('/seller/meal-voucher/new')
  })
  it('🔴 옛 되돌림 표시(dash=1)가 붙어 와도 대시보드에 남지 않는다 — 대시보드는 없다', () => {
    expect(sellerEntryRedirect('/seller/orders', '?dash=1')?.startsWith('/agency?tool=')).toBe(true)
  })
})

describe('② 누구를 콘솔로', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('에이전시 좌석이면 콘솔 로그인이 없어도 콘솔로(콘솔이 로그인 뒤 ?tool= 을 잇는다)', () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 401, agency_staff_id: 7 }))
    expect(isAgencyWorker()).toBe(true)
  })
  it('좌석이 없어도 콘솔 로그인만 있고 소비자 계정이 없으면 직원이다("이 탭만" sessionStorage 포함)', () => {
    sessionStorage.setItem(AGENCY_CONSOLE_TOKEN_KEY, 'tok')
    expect(isAgencyWorker()).toBe(true)
    localStorage.setItem('user_id', '3')
    expect(isAgencyWorker()).toBe(false)
  })
  it('사장님 좌석은 마이로', () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 401 }))
    localStorage.setItem(AGENCY_CONSOLE_TOKEN_KEY, 'tok')
    localStorage.setItem('user_id', '3')
    expect(isAgencyWorker()).toBe(false)
    expect(sellerEntryRedirect('/seller/orders', '')?.startsWith('/user/profile?tool=')).toBe(true)
  })
  it('토큰 자리 이름이 콘솔과 같다(두 벌이면 영영 안 보낸다)', () => {
    expect(AGENCY_CONSOLE_TOKEN_KEY).toBe(AGENCY_TOKEN_KEY)
  })
  it('콘솔이 로그인으로 보낼 때 ?tool= 을 returnUrl 에 싣는다 — 잃으면 직원이 링크를 다시 눌러야 한다', () => {
    const src = stripComments(readFileSync('src/pages/agency-console/AgencyHomePage.tsx', 'utf-8'))
    expect(src).toContain("const tool = params.get('tool')")
    expect(src).toContain('const back = tool ? `/agency?tool=${encodeURIComponent(tool)}` : \'/agency\'')
    expect(src).toContain('return <Navigate to={`/agency/login?returnUrl=${encodeURIComponent(back)}`} replace />')
  })
})

describe('③ 콘솔이 여는 규칙 — 좌석을 새로 받지 않는다', () => {
  let replace: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(toast.error).mockClear()
    replace = vi.fn()
    Object.assign(window.location, { pathname: '/agency', search: '?tool=%2Fseller%2Fgroup-buy', replace })
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  })
  async function mount() {
    const { AgencyStoresPanel } = await import('@/pages/agency-console/AgencyStoresPanel')
    render(<AgencyStoresPanel onExpired={() => {}} staffId={7} />)
  }
  it('이 직원의 그 매장 좌석이면 그 매장을 고르고 시트를 연다', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 7 }))
    await mount()
    await waitFor(() => expect(screen.getByTestId('tool-sheet').textContent).toBe('/seller/group-buy'))
    expect(replace).not.toHaveBeenCalled()
    expect(localStorage.getItem('agency_console_store')).toBe('402')
  })
  it('🤝 매장 전체 화면(주문)을 가리키는 깊은 링크는 판만 연다 — 에이전시는 자기 이용권만(2026-10-24)', async () => {
    Object.assign(window.location, { search: '?tool=%2Fseller%2Forders' })
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 7 }))
    await mount()
    await waitFor(() => expect(localStorage.getItem('agency_console_store')).toBe('402'))
    expect(screen.queryByTestId('tool-sheet')).toBeNull()
  })
  it('🔴 다른 직원의 좌석이면 열지 않고 말한다 — 대시보드로 되돌리지 않는다(대시보드는 없다)', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 8 }))
    await mount()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByTestId('tool-sheet')).toBeNull()
  })
  it('맡은 매장이 아닌 좌석이어도 같다', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 999, agency_staff_id: 7 }))
    await mount()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('④ 배선', () => {
  it('틀은 시트 밖에서만 판정해 보낸다 — 판정은 sellerEntryRedirect 한 곳', () => {
    const src = stripComments(readFileSync('src/components/SellerLayout.tsx', 'utf-8'))
    expect(src).toContain('if (!bare && !embedded) {')
    expect(src).toContain('const to = sellerEntryRedirect(location.pathname, location.search)')
    expect(src).toContain('if (to) return <Navigate to={to} replace />')
    const lib = stripComments(readFileSync('src/lib/seller-deep-link.ts', 'utf-8'))
    expect(lib).toContain('return toolRedirect(isAgencyWorker() ? AGENCY_CONSOLE_PATH : MY_PATH, pathname, search)')
  })
  it('콘솔 도구는 전부 시트(대시보드 전체화면 goFull 은 없다)', () => {
    const src = stripComments(readFileSync('src/pages/agency-console/AgencyStorePlate.tsx', 'utf-8'))
    expect(src).not.toContain('goFull')
    expect(src).not.toContain('dashboardFallback')
    // 🤝 2026-10-24 — 전체 도구 시트는 없다(매장 전체 도구라 에이전시에게 막힌다). 열리는 건 이용권 시트뿐.
    expect(src).not.toContain('AllToolsSheet')
    expect(src).toContain('<ToolPageSheet')
  })
  it('깊은 링크는 한 번만 쓴다 — 다른 매장 갔다 돌아와도 다시 안 열린다', () => {
    const src = stripComments(readFileSync('src/pages/agency-console/AgencyStoresPanel.tsx', 'utf-8'))
    expect(src).toContain('if (!deepPath || deepDone.current) return')
    expect(src).toContain('deepDone.current = true')
  })
})
