/**
 * 🚪 셀러 대시보드 제거 3단계 — 깊은 링크(`/seller/orders` 등)로 온 카카오 사장님도 **마이에서** 연다 (2026-10-12)
 *   대표: *"셀러 대시보드를 없애는 것을 목표로 하고 마이에서 모두 다 할 수 있게"*
 *
 * 지키는 것:
 *   ① 어디로 보내나 — 하위 주소는 `?tool=` 로, 홈·더보기는 마이 첫 화면으로, 쿼리는 그대로
 *   ② 대시보드에 남는 길은 없다(2026-10-12 삭제) — 전용 길은 그리로, OAuth 복귀 하나만 그 자리에서 틀 없이
 *   ③ `?tool=` 은 셀러 주소만 받는다(시트가 셀러 밖을 가리키면 `location` 에 들어가므로 열린 리다이렉트 차단)
 *   ⑤ 좌석이 안 맞으면 토큰을 발급하지 않고 **말한다**(되돌릴 대시보드가 없다) / 맞으면 시트를 열고 주소에서 지운다
 *   ⑥ 배선 — 껍데기·마이·페이지 세 곳
 *
 * 이 시험이 **못 보는 것**: 실제 브라우저 이동과 시트가 그 화면을 그리는 모습(라이브 E4 — 알림톡 링크를 눌러 볼 것) ·
 *   에이전시 직원(2단계 — 아직 대시보드에 남는다).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderHook } from '@testing-library/react'
import { RENDER_BARE, readToolParam, sellerEntryRedirect } from '@/lib/seller-deep-link'
import { toast } from '@/hooks/useToast'
import { FULL_SCREEN_ONLY } from '@/pages/user-profile/seller-section/tool-pages'
import { titleForPath } from '@/pages/user-profile/seller-section/ToolPageSheet'
import { useToolDeepLink, useToolDeepLinkFallback } from '@/pages/user-profile/seller-section/useToolDeepLink'
import { stripComments } from '../helpers/source-text'

vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
/** 카카오 사장님 — 마이가 있고 에이전시 좌석이 아니다. */
const asOwner = () => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('user_id', '3') }
const myRedirectFor = (p: string, q: string) => sellerEntryRedirect(p, q)

const toolOf = (url: string | null) => (url ? new URL(url, 'https://x').searchParams.get('tool') : null)

describe('① 어디로 보내나', () => {
  beforeEach(asOwner)

  it('하위 주소는 마이 + ?tool=<원래 주소>', () => {
    const url = myRedirectFor('/seller/orders', '')
    expect(url?.startsWith('/user/profile?tool=')).toBe(true)
    expect(toolOf(url)).toBe('/seller/orders')
  })

  it('쿼리를 잃지 않는다(알림톡 링크의 필터가 살아 있어야 한다)', () => {
    expect(toolOf(myRedirectFor('/seller/orders', '?status=PAID&id=9'))).toBe('/seller/orders?status=PAID&id=9')
  })

  it('파라미터 화면도 그대로 싣는다', () => {
    expect(toolOf(myRedirectFor('/seller/products/12/edit', ''))).toBe('/seller/products/12/edit')
  })

  it('홈·대시보드·더보기는 마이 첫 화면 자체가 답이다(더보기 = 전체 도구 — 두 벌 금지)', () => {
    for (const p of ['/seller', '/seller/dashboard', '/seller/more']) expect(myRedirectFor(p, '')).toBe('/user/profile')
  })

  it('셀러 주소가 아니면 손대지 않는다', () => {
    expect(myRedirectFor('/user/profile', '')).toBeNull()
    expect(myRedirectFor('/s/abc', '')).toBeNull()
  })
})

describe('② 대시보드에 남는 길은 없다 (2026-10-12 삭제)', () => {
  beforeEach(asOwner)

  it('🔴 옛 되돌림 표시(dash=1)·마이 표시(from=my)가 붙어 와도 보낸다 — 남을 대시보드가 없다', () => {
    expect(myRedirectFor('/seller/orders', '?dash=1')?.startsWith('/user/profile?tool=')).toBe(true)
    expect(myRedirectFor('/seller/group-buy', '?from=my')?.startsWith('/user/profile?tool=')).toBe(true)
    sessionStorage.setItem('ur_seller_from_my', '1')
    expect(myRedirectFor('/seller/group-buy', '')?.startsWith('/user/profile?tool=')).toBe(true)
  })

  it('🔴 로그인 안 한 사람·마이가 없는 옛 계정도 마이로 — 마이가 카카오 로그인으로 받는다', () => {
    localStorage.clear()
    expect(myRedirectFor('/seller/orders', '')).toBe('/user/profile?tool=%2Fseller%2Forders')
  })

  it('시트로 못 여는 화면은 전용 길로 간다 (계산대 → /store/scan, 등록 → ?tool=)', () => {
    for (const p of Object.keys(FULL_SCREEN_ONLY)) {
      expect(RENDER_BARE.has(p), `${p} 가 그 자리에 남는다`).toBe(false)
      expect(myRedirectFor(p, '')).not.toBeNull()
    }
    expect(myRedirectFor('/seller/scan', '')).toBe('/store/scan')
    expect(myRedirectFor('/seller/meal-voucher/new', '')).toBe('/user/profile?tool=%2Fseller%2Fmeal-voucher%2Fnew')
  })

  it('외부 OAuth 복귀 주소 하나만 그 자리에서 렌더한다(code·state 를 그 화면이 직접 읽는다)', () => {
    expect([...RENDER_BARE]).toEqual(['/seller/youtube/callback'])
    expect(myRedirectFor('/seller/youtube/callback', '?code=abc&state=x')).toBeNull()
  })
})

describe('③ ?tool= 은 셀러 주소만', () => {
  it('셀러 주소는 받는다', () => {
    expect(readToolParam('?tool=%2Fseller%2Forders%3Fstatus%3DPAID')).toBe('/seller/orders?status=PAID')
  })
  it.each([
    'https://evil.example/seller/x', '//evil.example/seller', '/seller\\..\\x', '/user/profile', '/sellerx', '/seller',
  ])('거른다: %s', (bad) => {
    expect(readToolParam(`?tool=${encodeURIComponent(bad)}`)).toBeNull()
  })
  it('제어문자도 거른다', () => {
    expect(readToolParam(`?tool=${encodeURIComponent('/seller/orders\n')}`)).toBeNull()
  })
})

describe('⑤ 마이가 시트를 여는 규칙', () => {
  // 판매 구역은 라우터 밖에서도 렌더된다(시험·미리보기) — 훅은 `window.location` 만 읽는다.
  //   ⚠️ 시험 셋업(`tests/setup.ts`)이 `window.location` 을 평범한 객체로 바꿔 둔다 — 그래서 값을 직접 넣는다.
  let replace: ReturnType<typeof vi.fn>
  let replaceState: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    replace = vi.fn()
    vi.mocked(toast.error).mockClear()
    Object.assign(window.location, { pathname: '/user/profile', search: '?tool=%2Fseller%2Forders', replace })
    replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  })

  it('좌석이 맞으면 시트를 연다', () => {
    const open = vi.fn()
    renderHook(() => useToolDeepLink({ ready: true, seated: true, open }))
    expect(open).toHaveBeenCalledWith('/seller/orders', null) // 2번째 = 전용 길(OWN_PATH) — 주문은 없음
    expect(replace).not.toHaveBeenCalled()
    // 한 번만 쓴다 — 새로고침·뒤로가기가 시트를 또 열지 않게 주소에서 지운다.
    expect(replaceState.mock.calls[0]?.[2]).toBe('/user/profile')
  })

  it('🔴 좌석이 안 맞으면 토큰을 발급하지 않고 열지도 않는다 — 주소를 지우고 말한다(대시보드는 없다)', () => {
    const open = vi.fn()
    renderHook(() => useToolDeepLink({ ready: true, seated: false, open }))
    expect(open).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(replaceState.mock.calls[0]?.[2]).toBe('/user/profile')
  })

  it('가게가 정해지기 전엔 아무것도 안 한다', () => {
    const open = vi.fn()
    renderHook(() => useToolDeepLink({ ready: false, seated: false, open }))
    expect(open).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('판매 구역이 못 뜨면(가게 0곳·실패) 페이지가 주소를 지우고 왜 못 여는지 말한다', () => {
    renderHook(() => useToolDeepLinkFallback({ loading: false, failed: false, storeCount: 0 }))
    expect(replace).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(replaceState.mock.calls[0]?.[2]).toBe('/user/profile')
  })

  it('가게가 있으면 페이지는 끼어들지 않는다(판매 구역이 맡는다)', () => {
    renderHook(() => useToolDeepLinkFallback({ loading: false, failed: false, storeCount: 2 }))
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('시트 머리 이름 — 색인에서 찾는다', () => {
  const items = [
    { path: '/seller/orders', label: '주문' },
    { path: '/seller/products', label: '상품' },
  ]
  it('정확히 같은 주소', () => expect(titleForPath(items, '/seller/orders?status=PAID')).toBe('주문'))
  it('파라미터 화면은 가장 긴 접두', () => expect(titleForPath(items, '/seller/products/12/edit')).toBe('상품'))
  it('모르면 판매 도구', () => expect(titleForPath(items, '/seller/unknown')).toBe('판매 도구'))
})

describe('⑥ 배선', () => {
  it('틀은 시트 밖에서만 판정해서 보낸다(시트 안에서 튕기면 마이가 사라진다)', () => {
    const src = stripComments(readFileSync('src/components/SellerLayout.tsx', 'utf-8'))
    const gate = src.indexOf('if (!bare && !embedded) {')
    const redirect = src.indexOf('const to = sellerEntryRedirect(location.pathname, location.search)')
    expect(gate).toBeGreaterThan(0)
    expect(redirect).toBeGreaterThan(gate)
    expect(src).toContain('if (to) return <Navigate to={to} replace />')
  })

  it('마이 판매 구역이 깊은 링크를 받는다', () => {
    const src = stripComments(readFileSync('src/pages/user-profile/SellerSection.tsx', 'utf-8'))
    expect(src).toMatch(/useToolDeepLink\(\{ ready: !loading && store != null, seated, open:/)
  })

  it('페이지가 못 뜨는 경우를 받는다', () => {
    const src = stripComments(readFileSync('src/pages/UserProfilePage.tsx', 'utf-8'))
    expect(src).toMatch(/useToolDeepLinkFallback\(\{ loading: sellerSeats\.loading, failed: sellerSeats\.failed, storeCount: sellerSeats\.stores\.length \}\)/)
  })

  it('🔴 셀러 주소는 전부 시트가 렌더하는 라우트 표 안에 있다 — 밖에 있으면 시트가 바깥으로 튕기고 껍데기가 또 보낸다(왕복)', () => {
    const app = readFileSync('src/App.tsx', 'utf-8')
    expect(app).not.toMatch(/path="\/seller/)
  })

  it('옛 홈 라우트와 틀이 같은 판정을 쓴다(두 벌 금지)', () => {
    const routes = stripComments(readFileSync('src/routes/seller.routes.tsx', 'utf-8'))
    expect(routes).toContain('return <Navigate to={sellerEntryRedirect(location.pathname, location.search) ?? MY_PATH} replace />')
  })
})
