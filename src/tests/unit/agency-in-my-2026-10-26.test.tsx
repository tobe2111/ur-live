/**
 * 🏢 **에이전시 화면이 마이 안으로** — 2026-10-26 대표 확정 안 A
 *   대표: *"응 마이로 합치자 일단은"* → 시안 셋 중 *"안 A · 구역"*.
 *
 * 지키는 것:
 *   ① `/agency` 는 마이로 보내는 문이다 — 깊은 링크(`?tool=`)는 마이에서 `?atool=` 로 이어진다
 *      (마이의 `?tool=` 은 사장님 판이 쓴다 — 같은 이름이면 두 판이 같은 화면을 동시에 열려고 다툰다)
 *   ② 손님 마이에 '에이전시' 구역이 선다 — '내 가게' 바로 아래, 폰·PC 둘 다
 *   ③ 이메일 전용(손님 로그인 없음)이면 마이 자리에 에이전시 마이가 뜬다 — 공용 인증 판정은 그대로
 *   ④ 토큰 자리 이름이 한 벌이다(거울이 갈리면 구역이 **조용히** 안 뜬다 — 2026-10-26 2단계에서 `lib/agency-presence` 하나로 모음)
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 브라우저에서 이메일 로그인 → 마이 도착(라이브 E4) · 구역이 보기 좋은지(그려 봐야 한다).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AgencyHomePage from '@/pages/agency-console/AgencyHomePage'
import { AGENCY_TOKEN_KEY, AGENCY_TOOL_PARAM, agencyMyPath } from '@/pages/agency-console/agency-api'
import { AgencyAwareGuest } from '@/routes/agency-console.routes'
import MyAgencyZone, { hasAgencyLogin } from '@/pages/user-profile/MyAgencyZone'
import { readToolParam } from '@/lib/seller-deep-link'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}
function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agency" element={<AgencyHomePage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('① /agency 는 마이로 보내는 문', () => {
  it('로그인돼 있으면 마이로', async () => {
    localStorage.setItem(AGENCY_TOKEN_KEY, 'tok')
    const r = at('/agency')
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe('/user/profile'))
  })
  it('깊은 링크는 ?atool= 로 이어진다', async () => {
    localStorage.setItem(AGENCY_TOKEN_KEY, 'tok')
    const r = at('/agency?tool=%2Fseller%2Fgroup-buy')
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe('/user/profile?atool=%2Fseller%2Fgroup-buy'))
  })
  it('로그인 안 돼 있으면 에이전시 로그인으로(돌아올 곳을 싣는다)', async () => {
    const r = at('/agency?tool=%2Fseller%2Fgroup-buy')
    await waitFor(() => expect(r.getByTestId('where').textContent).toBe(
      `/agency/login?returnUrl=${encodeURIComponent('/agency?tool=%2Fseller%2Fgroup-buy')}`,
    ))
  })
  it('atool 은 tool 과 다른 이름이고, 판이 그 이름으로 읽는다', () => {
    expect(AGENCY_TOOL_PARAM).toBe('atool')
    expect(agencyMyPath('/seller/orders')).toBe('/user/profile?atool=%2Fseller%2Forders')
    expect(readToolParam('?atool=%2Fseller%2Fgroup-buy', 'atool')).toBe('/seller/group-buy')
    expect(readToolParam('?atool=%2Fseller%2Fgroup-buy')).toBeNull()
    const panel = code('src/pages/agency-console/AgencyStoresPanel.tsx')
    expect(panel).toContain('readToolParam(window.location.search, toolParam)')
    expect(panel).toContain("q.delete(toolParam ?? 'tool')")
    expect(code('src/pages/agency-console/AgencySection.tsx')).toContain('toolParam={AGENCY_TOOL_PARAM}')
  })
})

describe('② 손님 마이 안 구역', () => {
  it("'내 가게' 바로 아래 — 폰·PC 둘 다", () => {
    const page = code('src/pages/UserProfilePage.tsx')
    // 🔁 2026-11-02 재조준(통합 시안 v2) — 에이전시 이름이 매장 판 위 제목(`AgencyMergedTitle`)이 되고,
    //   에이전시 구역은 판 바로 아래에서 '내 가게' 매장을 알고(`ownSellerIds`) 같은 매장을 다시 안 그린다.
    expect(page).toMatch(/\{isPc \? <AgencyTitleDoor storeCount=\{sellerSeats\.stores\.length\} \/> : null\}\s*\{isPc \? <SellerSection state=\{sellerSeats\} \/> : null\}\s*(\{\s*\}\s*)?\{isPc \? <MyAgencyZone ownSellerIds=\{ownSellerIds\} \/> : null\}/)
    expect(page).toMatch(/<AgencyTitleDoor storeCount=\{sellerSeats\.stores\.length\} \/>\s*<SellerSection state=\{sellerSeats\} \/>\s*<MyAgencyZone ownSellerIds=\{ownSellerIds\} \/>/)
  })
  it('마이 안에서는 한 칸(stacked)으로 — 마이의 PC 칸은 두 칸을 못 담는다', () => {
    expect(code('src/pages/user-profile/MyAgencyZone.tsx')).toContain('<AgencySection stacked headless={merged} ownSellerIds={merged ? ownSellerIds : undefined} onSessionEnd={onSessionEnd} />')
  })
  it('에이전시 로그인이 없으면 아무것도 안 그린다(코드도 안 받는다)', () => {
    const { container } = render(<MyAgencyZone />)
    expect(container.innerHTML).toBe('')
    expect(code('src/pages/user-profile/MyAgencyZone.tsx')).toContain("lazy(() => import('@/pages/agency-console/AgencySection'))")
  })
})

describe('③ 이메일 전용이면 마이 자리에 에이전시 마이', () => {
  it('에이전시 로그인이 없으면 종전 로그인 전 화면 그대로', () => {
    const r = render(<MemoryRouter><AgencyAwareGuest guest={<p>guest-my</p>} /></MemoryRouter>)
    expect(r.getByText('guest-my')).toBeTruthy()
  })
  it('공용 인증 판정(잠금 파일)은 안 건드리고 guest 자리에만 끼운다', () => {
    expect(code('src/App.tsx')).toContain('<ProtectedRoute requireUser guest={<AgencyAwareGuest guest={<GuestMyPage />} />}>')
    expect(code('src/routes/agency-console.routes.tsx')).toContain('hasAgencyLogin() ? <ErrorBoundary><AgencyMyPage /></ErrorBoundary> : <>{guest}</>')
  })
})

describe('④ 토큰 자리 이름은 한 벌', () => {
  it('거울은 한 곳(lib/agency-presence)이고 콘솔 이름과 같다 — 마이·마이 자리 둘 다 그걸 쓴다', () => {
    const mirror = /export const AGENCY_TOKEN_KEY_MIRROR = '([^']+)'/
    expect(code('src/lib/agency-presence.ts').match(mirror)?.[1]).toBe(AGENCY_TOKEN_KEY)
    expect(code('src/pages/user-profile/MyAgencyZone.tsx')).toContain("import { announceAgencyPresence, hasAgencyLogin } from '@/lib/agency-presence'")
    expect(code('src/routes/agency-console.routes.tsx')).toContain("import { hasAgencyLogin } from '@/lib/agency-presence'")
    expect(code('src/pages/user-profile/MyAgencyZone.tsx')).not.toMatch(/AGENCY_TOKEN_KEY_MIRROR = /)
  })
  it('localStorage · sessionStorage 둘 다 본다("이 컴퓨터에서 로그인 유지" 를 끈 직원)', () => {
    expect(hasAgencyLogin()).toBe(false)
    sessionStorage.setItem(AGENCY_TOKEN_KEY, 'tok')
    expect(hasAgencyLogin()).toBe(true)
  })
})
