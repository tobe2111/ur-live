/**
 * 🗑️ **셀러 대시보드를 지웠다** (2026-10-12 대표 *"대시보드는 완전히 지워줘"*)
 *
 * 화면 파일(주문·이용권·정산 …)은 남아 있고, 마이(사장님)·에이전시 콘솔(직원)이 **시트로** 연다.
 * 지운 것은 그 화면들을 감싸던 **단독 틀**과 틀에만 있던 화면이다:
 *   틀(머리줄·전체 메뉴·⌘K·상담 버튼·승인 배너·귀환 띠·좌석 띠·카카오 연동 배너) · 홈 `/seller` · 더보기 `/seller/more`
 *   · 셀러 이메일 로그인·비밀번호 찾기/재설정 화면 · `?dash=1`(대시보드로 되돌리는 표시) · 하단 ➕ 죽은 시트.
 *
 * 지키는 것:
 *   ① 되살아나지 않는다 — 지운 파일·옛 판정 이름이 소스에 다시 생기면 빨간불
 *   ② 옛 주소는 살아 있는 별칭이다 — `/seller` 홈·더보기·로그인이 마이(또는 콘솔·카카오 로그인)로 보낸다
 *   ③ 시트 안에서 옛 홈 주소로 가면 **시트가 닫힌다**(저장 후 `navigate('/seller')` 하는 화면들의 끝)
 *
 * ⚠️ 이 시험이 **못 보는 것**: 실제 브라우저에서 알림톡 링크 → 마이 → 시트(라이브 E4 — 로그인 세션 필요) ·
 *   대시보드 문구가 남은 **서버 응답 문자열**(알림·메일 본문)은 전수로 보지 않는다(링크는 별칭이 받는다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ToolPageSheet from '@/pages/user-profile/seller-section/ToolPageSheet'
import { SellerRoutes } from '@/routes/seller.routes'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('① 되살아나지 않는다', () => {
  it.each([
    'src/pages/SellerPage.tsx', 'src/pages/SellerMorePage.tsx', 'src/pages/SellerLoginPage.tsx',
    'src/pages/SellerForgotPasswordPage.tsx', 'src/pages/SellerResetPasswordPage.tsx',
    'src/pages/seller-page/TodayTicket.tsx', 'src/pages/seller-page/MyStoresPanel.tsx',
    'src/components/seller/SellerGroupTabs.tsx', 'src/components/seller/StoreSwitcher.tsx',
    'src/components/seller/BackToMyBar.tsx', 'src/components/seller/AgencySeatBar.tsx',
    'src/components/seller/SellerApprovalBanner.tsx', 'src/components/SellerKakaoLinkBanner.tsx',
  ])('%s 가 없다', (f) => {
    expect(existsSync(f), `${f} 가 되살아났다 — 대시보드는 지웠다(2026-10-12)`).toBe(false)
  })

  it('🔴 틀이 다시 그려지지 않는다 — SellerLayout 은 본문 래퍼와 보내기뿐', () => {
    const src = code('src/components/SellerLayout.tsx')
    for (const gone of ['<header', '<main', 'CommandPalette', 'SELLER_MENU_PATH', 'seller-chat-fab', 'wholesaleOnly', '/api/seller/surface']) {
      expect(src, `${gone} 가 틀에 돌아왔다`).not.toContain(gone)
    }
  })

  it('🔴 `dash=1`(대시보드로 되돌리기)이 소스 어디에도 없다 — 되돌릴 대시보드가 없다', () => {
    // 주석은 뺀다 — 지운 이유를 적은 주석이 그 이름을 인용한다(제거를 기록하는 글과 제거를 검사하는 단언은 같은 문자열을 공유할 수 없다).
    const files = execSync("grep -rln \"dashboardFallback\\|DASH_PARAM\\|dash=1\" src --include=*.ts --include=*.tsx || true", { encoding: 'utf-8' })
      .split('\n').filter((l) => l && !l.includes('src/tests/'))
    const live = files.filter((f) => /dashboardFallback|DASH_PARAM|dash=1/.test(code(f)))
    expect(live).toEqual([])
  })

  it('🔴 하단 ➕ 죽은 시트가 돌아오지 않는다 — 열 방법이 없는데 셀러 대시보드·셀러 로그인 버튼을 품고 있었다', () => {
    const nav = code('src/components/main/BottomNav.tsx')
    expect(nav).not.toContain('sheetOpen')
    expect(nav).not.toContain('SellerUpgradePanel')
    expect(nav).not.toContain('__create__')
  })
})

/** 지금 주소를 그려 보이는 탐침 — 별칭이 어디로 보냈는지 본다. */
function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname + l.search}</div>
}
function mountAt(initial: string | { pathname: string; state: unknown }) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        {SellerRoutes()}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('② 옛 주소는 별칭이다', () => {
  it.each(['/seller', '/seller/dashboard', '/seller/more'])('%s → 사장님 마이 첫 화면', async (p) => {
    localStorage.setItem('user_id', '3')
    const r = mountAt(p)
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe('/user/profile'))
  })

  it('/seller → 에이전시 직원은 콘솔', async () => {
    localStorage.setItem('seller_token', `x.${btoa(JSON.stringify({ seller_id: 4, agency_staff_id: 7 }))}.y`)
    const r = mountAt('/seller')
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe('/agency'))
  })

  it('/seller/login → 카카오 로그인, 돌아올 곳은 원래 열려던 화면을 연 마이', async () => {
    const r = mountAt({ pathname: '/seller/login', state: { from: '/seller/orders' } })
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe(
      `/login?returnUrl=${encodeURIComponent('/user/profile?tool=%2Fseller%2Forders')}`,
    ))
  })

  it('로그아웃 상태의 깊은 링크는 필터까지 들고 돌아온다 (2026-10-12 라이브에서 ?status=PAID 가 빠졌다)', async () => {
    const r = mountAt('/seller/orders?status=PAID')
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe(
      `/login?returnUrl=${encodeURIComponent(`/user/profile?tool=${encodeURIComponent('/seller/orders?status=PAID')}`)}`,
    ))
  })

  it('/seller/forgot-password · reset-password 도 같은 별칭', async () => {
    for (const p of ['/seller/forgot-password', '/seller/reset-password']) {
      const r = mountAt(p)
      await waitFor(() => expect(r.getByTestId('where').textContent).toBe(`/login?returnUrl=${encodeURIComponent('/user/profile')}`))
      r.unmount()
    }
  })

  it('/seller/login → 에이전시 직원은 콘솔 로그인', async () => {
    localStorage.setItem('seller_token', `x.${btoa(JSON.stringify({ seller_id: 4, agency_staff_id: 7 }))}.y`)
    const r = mountAt('/seller/login')
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe('/agency/login?returnUrl=%2Fagency'))
  })
})

describe('③ 시트 안에서 옛 홈으로 가면 시트가 닫힌다', () => {
  it.each(['/seller', '/seller/dashboard', '/seller/more'])('%s', async (p) => {
    localStorage.setItem('seller_token', 'preview')
    const onClose = vi.fn()
    const onLeave = vi.fn()
    render(
      <MemoryRouter>
        <ToolPageSheet path={p} title="테스트" onClose={onClose} onLeave={onLeave} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onLeave).not.toHaveBeenCalled()
  })
})
