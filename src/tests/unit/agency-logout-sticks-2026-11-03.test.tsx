/**
 * 🚪 에이전시 로그아웃이 먹는다 〔2026-11-03 대표 신고 *"에이전시 로그아웃을 했는데도 그대로 이렇게 뜨네?"*〕
 *
 * 원인: 마이(`MyAgencyZone`)는 에이전시 로그인이 없으면 이 카카오 계정의 에이전시를 찾아 **자동 로그인**한다.
 *   로그아웃으로 토큰을 지운 직후 그 확인이 돌아 바로 다시 로그인했다(새 탭에서도 매번).
 * 지키는 것:
 *   ① 직접 로그아웃한 손님에겐 자동 연결 요청을 안 보낸다 ② 그 표시는 그 손님에게만 먹는다
 *   ③ 사람이 직접 에이전시에 로그인하면(`saveAgencySession`) 표시가 풀린다
 *   ④ 에이전시 로그인 화면의 '카카오로 로그인' 을 누르면 표시가 풀린다(카카오 전용 에이전시의 유일한 문)
 *   ⑤ 로그아웃 버튼이 표시를 남긴다
 * 못 보는 것: 라이브 왕복(실제 카카오 세션) — 배포 뒤 폰으로 로그아웃 → 마이 다시 열기로 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

const connect = vi.fn(async () => false)
vi.mock('@/pages/agency-console/agency-kakao-client', () => ({ connectKakaoAgency: () => connect() }))
vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/lib/after-load', () => ({ runAfterLoad: (fn: () => void) => { fn(); return () => {} } }))

import MyAgencyZone from '@/pages/user-profile/MyAgencyZone'
import AgencyLoginPage from '@/pages/agency-console/AgencyLoginPage'
import { AGENCY_OPTOUT_KEY, agencyAutoConnectBlocked, markAgencyLoggedOut } from '@/lib/agency-presence'
import { saveAgencySession } from '@/pages/agency-console/agency-api'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); connect.mockClear() })

describe('에이전시 로그아웃 뒤 자동 재연결 금지', () => {
  it('① 직접 로그아웃한 손님에겐 자동 연결을 안 묻는다', async () => {
    localStorage.setItem('user_id', '3')
    markAgencyLoggedOut()
    render(<MyAgencyZone />)
    await new Promise((r) => setTimeout(r, 20))
    expect(connect).not.toHaveBeenCalled()
  })

  it('대조군 — 표시가 없으면 묻는다(시험이 헛돌지 않는다)', async () => {
    localStorage.setItem('user_id', '3')
    render(<MyAgencyZone />)
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1))
  })

  it('② 표시는 로그아웃한 그 손님에게만 먹는다', () => {
    localStorage.setItem('user_id', '3')
    markAgencyLoggedOut()
    expect(agencyAutoConnectBlocked('3')).toBe(true)
    expect(agencyAutoConnectBlocked('30')).toBe(false)
  })

  it('③ 직접 로그인하면 표시가 풀린다', () => {
    localStorage.setItem('user_id', '3')
    markAgencyLoggedOut()
    saveAgencySession({ token: 't', staff: {}, agency: {} } as never, true)
    expect(localStorage.getItem(AGENCY_OPTOUT_KEY)).toBeNull()
  })

  it("④ 에이전시 로그인 화면의 '카카오로 로그인' 이 표시를 푼다", () => {
    localStorage.setItem('user_id', '3')
    markAgencyLoggedOut()
    sessionStorage.setItem('ur_agency_kakao_probe', '3')
    const { getByText } = render(<MemoryRouter><AgencyLoginPage /></MemoryRouter>)
    fireEvent.click(getByText('카카오로 로그인'))
    expect(localStorage.getItem(AGENCY_OPTOUT_KEY)).toBeNull()
    expect(sessionStorage.getItem('ur_agency_kakao_probe')).toBeNull()
  })

  it('⑤ 로그아웃 버튼이 표시를 남긴다', () => {
    const src = readFileSync('src/pages/agency-console/AgencySection.tsx', 'utf8')
    expect(src).toMatch(/clearAgencySession\(\)\s*\n\s*markAgencyLoggedOut\(\)/)
  })
})
