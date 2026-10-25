/**
 * 🚪 대시보드에 안 가도 되는가 — 마지막 두 길 (2026-10-12)
 *   대표: *"끝까지 해줘. 이제 셀러 대시보드, 에이전시 대시보드로 굳이 안가서 해도 돼? 마이 페이지에서 다 해결이 되나?"*
 *
 * 재 보니 **두 길이 아직 대시보드 틀로 떨어지고 있었다**:
 *   ① 전체 도구에서 '바우처 스캔' · '이용권 등록' 을 고르면 — 마이도 에이전시 콘솔도 — 대시보드 주소
 *      (`/seller/scan` · `/seller/meal-voucher/new`)로 보냈다. `tool-pages.ts` 는 *"마이엔 이미 전용 길이 있다"*
 *      고 적어 놓고, 그 길(`VoucherNewSheet`)은 **아무도 렌더하지 않았다**(2026-09-26 에 만들고 고아).
 *   ② 에이전시 직원의 계산대가 대시보드 `/seller/scan` 이었다 — `/store/scan` 라우트가 소비자 로그인
 *      (`requireUser`)을 요구해서다. 같은 요구가 **스캔 전용 기기 링크(`/store/scan?dk=`)도 막고 있었다**
 *      (그 링크는 로그인 없이 쓰라고 만든 것이다).
 *
 * 이 시험이 고정하는 것: 전체 도구에서 *시트로 못 여는* 주소는 **전부 전용 길이 있다** — 그래서 사장님도
 * 에이전시 직원도 대시보드 틀을 볼 일이 없다.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 기기에서 카메라가 뜨는지 · 서버가 좌석 토큰으로 매장을 맞게 고르는지
 *   (그건 라이브 판정이다) · 깊은 링크(`/seller/scan` 을 직접 연 경우)는 여전히 대시보드에 남는다
 *   (`seller-deep-link.ts` `STAY_ON_DASHBOARD` — 의도된 폴백).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { stripComments } from '../helpers/source-text'
import {
  FULL_SCREEN_ONLY, OWN_PATH, STORE_SCAN_PATH, ownPathFor, canOpenInSheet,
} from '@/pages/user-profile/seller-section/tool-pages'

vi.mock('@/components/seller-layout/useSellerNavModel', async () => {
  const { ChevronRight } = await import('lucide-react')
  return {
    useSellerNavModel: () => ({
      commandItems: [
        { path: '/seller/scan', label: '바우처 스캔', icon: ChevronRight, group: '이용권' },
        { path: '/seller/meal-voucher/new', label: '이용권 등록', icon: ChevronRight, group: '이용권' },
        { path: '/seller/orders', label: '주문', icon: ChevronRight, group: '주문' },
      ],
    }),
  }
})

import AllToolsSheet from '@/pages/user-profile/seller-section/AllToolsSheet'

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))
const APP = code('src/App.tsx')
const SCAN = code('src/pages/StoreScanPage.tsx')
const SELLER = code('src/pages/user-profile/SellerSection.tsx')
const PLATE = code('src/pages/agency-console/AgencyStorePlate.tsx')

describe('① 판정은 한 곳 — 시트로 못 여는 주소엔 전부 전용 길이 있다', () => {
  it('FULL_SCREEN_ONLY 의 모든 주소가 OWN_PATH 에 있다 (대시보드로 떨어지는 길 0)', () => {
    expect(Object.keys(FULL_SCREEN_ONLY).length).toBeGreaterThan(0)
    for (const p of Object.keys(FULL_SCREEN_ONLY)) {
      expect(ownPathFor(p), `${p} 에 전용 길이 없다 — 고르면 대시보드 틀로 떨어진다`).not.toBeNull()
    }
  })
  it('계산대 → scan, 등록 → voucherNew, 나머지 → null', () => {
    expect(ownPathFor('/seller/scan')).toBe('scan')
    expect(ownPathFor('/seller/meal-voucher/new')).toBe('voucherNew')
    expect(ownPathFor('/seller/orders')).toBeNull()
    expect(ownPathFor('constructor')).toBeNull() // 프로토타입 키에 속지 않는다
  })
  it('계산대는 대시보드 밖 화면이다', () => {
    expect(STORE_SCAN_PATH).toBe('/store/scan')
    expect(Object.keys(OWN_PATH).every((p) => !canOpenInSheet(p))).toBe(true)
  })
})

describe('② 전체 도구가 전용 길을 넘긴다 (실제로 눌러 본다)', () => {
  afterEach(() => cleanup())
  function pick(label: string) {
    const onPick = vi.fn()
    render(<AllToolsSheet storeName="테스트 가게" onPick={onPick} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
    return onPick.mock.calls[0]
  }
  it('바우처 스캔 → own=scan', () => {
    expect(pick('바우처 스캔')).toEqual(['/seller/scan', '바우처 스캔', false, 'scan'])
  })
  it('이용권 등록 → own=voucherNew', () => {
    expect(pick('이용권 등록')).toEqual(['/seller/meal-voucher/new', '이용권 등록', false, 'voucherNew'])
  })
  it('주문 → 시트(own=null)', () => {
    expect(pick('주문')).toEqual(['/seller/orders', '주문', true, null])
  })
})

describe('③ 마이 — 큰 버튼과 같은 길', () => {
  it('scan → /store/scan, voucherNew → 등록 시트', () => {
    expect(SELLER).toContain("if (own === 'scan') { setTool(null); enterSeat('/store/scan'); return }")
    expect(SELLER).toContain("if (own === 'voucherNew') { setPageFrom('tools'); setTool('voucherNew'); return }")
    expect(SELLER).toMatch(/tool === 'voucherNew' && <VoucherNewSheet /)
  })
  it('전용 길 판정 뒤의 나머지는 전부 시트다 — 대시보드 폴백(enterSeat(path))은 없다(2026-10-12 삭제)', () => {
    const own = SELLER.indexOf("if (own === 'scan')")
    const sheet = SELLER.indexOf("if (inSheet) { setPage({ path, title: label }); setPageFrom('tools'); setTool('page'); return }")
    expect(own).toBeGreaterThan(-1)
    expect(sheet).toBeGreaterThan(own)
    expect(SELLER).not.toContain('enterSeat(path)')
  })
  it('VoucherNewSheet 는 lazy (등록 안 하는 사람이 위저드 값을 치르지 않게)', () => {
    expect(SELLER).toContain("const VoucherNewSheet = lazy(() => import('./seller-section/VoucherNewSheet'))")
  })
})

describe('④ 에이전시 콘솔 — 마이와 같은 등록 시트 · 🤝 계산대는 사장님만(2026-10-24)', () => {
  it('계산대 주소는 마이와 같은 값으로 남겨 둔다(다시 열 때 갈리지 않게) — 하지만 판에서 열지 않는다', () => {
    expect(PLATE).toContain('export const AGENCY_SCAN_PATH = STORE_SCAN_PATH')
    expect(PLATE).not.toContain('window.location.assign(AGENCY_SCAN_PATH)')
  })
  it('voucherNew → 등록 시트(깊은 링크도)', () => {
    expect(PLATE).toContain("initialOwn === 'voucherNew' ? 'voucherNew'")
    expect(PLATE).toContain('<VoucherNewSheet')
  })
})

describe('⑤ /store/scan — 소비자 로그인을 요구하지 않고, 화면이 스스로 막는다', () => {
  it('라우트에 requireUser 가 없다 (에이전시 직원 · 스캔 기기 링크)', () => {
    const line = APP.split('\n').find((l) => l.includes('path="/store/scan"'))
    expect(line, '/store/scan 라우트를 못 찾았다').toBeTruthy()
    expect(line).not.toMatch(/requireUser/)
  })
  it('🔴 라우트 가드를 걷었으니 화면 가드가 유일한 문이다 — 좌석 토큰 또는 기기 키 없으면 마이로', () => {
    expect(SCAN).toContain('const allowed = hasSeller || hasDeviceKey')
    expect(SCAN).toContain("localStorage.getItem('seller_token')")
    expect(SCAN).toContain("localStorage.getItem('scan_device_key')")
    expect(SCAN).toMatch(/if \(!allowed\) navigate\(MY_PATH/)
    expect(SCAN).toContain('if (!allowed) return null')
  })
})

// ── 깊은 링크 (2026-10-12 2차 — 대표 *"이제 모두 가장 이상적인 형태야?"* 를 재 보니 남아 있던 문) ──────────
//   알림톡 '사용처리'(`/store/go?to=scan`) · 주문 상세 '사용처리 화면으로' · 하단 ➕ '이용권 등록' · 유어샵 '이용권 등록' 이
//   전부 대시보드 주소로 가서 얇은 틀에 떨어졌다. 🧭 2026-10-12 이후엔 틀 자체가 없다 — 판정은 `sellerEntryRedirect` 하나.
import { RENDER_BARE } from '@/lib/seller-deep-link'
import { STORE_GO_TARGETS } from '@/shared/store-deep-link'

describe('⑥ 깊은 링크도 전용 길로', () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('그 자리에서 렌더하는 주소는 OAuth 복귀 하나뿐', () => {
    expect([...RENDER_BARE]).toEqual(['/seller/youtube/callback'])
  })
  it('계산대 → /store/scan (쿼리 유지), 사장님·에이전시 모두', () => {
    localStorage.setItem('user_id', '3')
    expect(sellerEntryRedirect('/seller/scan', '?x=1')).toBe('/store/scan?x=1')
    localStorage.clear(); localStorage.setItem('seller_token', seat({ agency_staff_id: 7 }))
    expect(sellerEntryRedirect('/seller/scan', '')).toBe('/store/scan')
  })
  it('등록 → ?tool= (받는 쪽이 등록 시트로 연다)', () => {
    localStorage.setItem('user_id', '3')
    expect(sellerEntryRedirect('/seller/meal-voucher/new', '')).toBe('/user/profile?tool=%2Fseller%2Fmeal-voucher%2Fnew')
    expect(ownPathFor('/seller/meal-voucher/new?copyFrom=3')).toBe('voucherNew')
  })
  it('마이·콘솔이 ?tool= 의 등록을 VoucherNewSheet 로 받는다', () => {
    expect(SELLER).toContain("open: (p, own) => { if (own === 'voucherNew') { setPageFrom(null); setTool('voucherNew'); return } void openPage(p, '') }")
    expect(PLATE).toContain("initialOwn === 'voucherNew' ? 'voucherNew'")
    expect(code('src/pages/user-profile/seller-section/useToolDeepLink.ts')).toContain('open(path, ownPathFor(path))')
  })
  it('사장님 문자 · 주문 상세 · 사용 처리 완료 화면의 계산대 링크가 /store/scan', () => {
    expect(STORE_GO_TARGETS.scan).toBe('/store/scan')
    expect(code('src/pages/seller-orders/OrderDetailModal.tsx')).toContain('href="/store/scan"')
    expect(code('src/pages/VoucherVerifyPage.tsx')).toContain('to="/store/scan"')
  })
})

// ── 버튼도 곧장 (2026-10-12 3차 — 대표 *"거치는 단계 없애줘"*) ─────────────────────────────────────
//   하단 ➕ '이용권 등록' · 유어샵 '마이 내 가게' 가 `/seller/*` 로 갔다가 대시보드 껍데기가 다시 보내던 한 단계를 없앤다.
//   판정은 대시보드 껍데기와 **같은 함수**(`sellerEntryRedirect`) — 두 벌이면 버튼과 깊은 링크가 갈린다.
import { sellerEntryPath, sellerEntryRedirect } from '@/lib/seller-deep-link'

const seat = (claims: Record<string, unknown>) => `x.${btoa(JSON.stringify(claims))}.y`

describe('⑦ 버튼이 최종 도착지로 곧장 간다', () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('카카오 사장님 — 등록은 마이 시트로, 대시보드 홈은 마이로', () => {
    localStorage.setItem('user_id', '3'); localStorage.setItem('seller_token', seat({ seller_id: 1 }))
    expect(sellerEntryPath('/seller/meal-voucher/new')).toBe('/user/profile?tool=%2Fseller%2Fmeal-voucher%2Fnew')
    expect(sellerEntryPath('/seller')).toBe('/user/profile')
    expect(sellerEntryPath('/seller/scan?x=1')).toBe('/store/scan?x=1')
  })
  it('에이전시 직원(콘솔 로그인 있음) — 콘솔로', () => {
    localStorage.setItem('seller_token', seat({ agency_staff_id: 7 })); localStorage.setItem('agency_console_token', 't')
    expect(sellerEntryPath('/seller')).toBe('/agency')
    expect(sellerEntryPath('/seller/meal-voucher/new')).toBe('/agency?tool=%2Fseller%2Fmeal-voucher%2Fnew')
  })
  it('🔴 옛 셀러(마이 없음) · dash=1 — 대시보드가 없으므로 원래 주소에 남지 않는다(마이가 로그인으로 받는다)', () => {
    localStorage.setItem('seller_token', seat({ seller_id: 1 }))
    expect(sellerEntryPath('/seller/meal-voucher/new')).toBe('/user/profile?tool=%2Fseller%2Fmeal-voucher%2Fnew')
    localStorage.setItem('user_id', '3')
    expect(sellerEntryPath('/seller/orders?dash=1')).toBe('/user/profile?tool=%2Fseller%2Forders%3Fdash%3D1')
  })
  it('틀이 같은 함수로 판정한다 (두 벌 금지)', () => {
    const LAYOUT = code('src/components/SellerLayout.tsx')
    expect(LAYOUT).toContain('const to = sellerEntryRedirect(location.pathname, location.search)')
    expect(typeof sellerEntryRedirect).toBe('function')
  })
  it('🗑️ 하단 ➕ 시트는 지웠다(열 방법이 없는 죽은 화면이었다) · 유어샵 버튼은 sellerEntryPath 를 거친다', () => {
    const NAV = code('src/components/main/BottomNav.tsx')
    expect(NAV).not.toContain('sheetOpen')
    expect(NAV).not.toContain('__create__')
    expect(NAV).not.toMatch(/\/seller(\/login|\/meal-voucher\/new)?['"`]/)
    const CTA = code('src/pages/curator-page/SellOwnProductsCTA.tsx')
    expect(CTA).toContain('navigate(sellerEntryPath(path))')
  })
})
