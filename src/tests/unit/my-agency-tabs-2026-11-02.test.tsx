/**
 * 🗂️ 마이 `나 | 에이전시` 탭 — 2026-11-02 대표 확정 *"안 1로 하고 에이전시 화면을 기본으로 하자"*.
 *   시안: `docs/design/my-agency-split-2026-11-02.md`.
 *
 * 지키는 것:
 *  ① 탭은 **폰 + 에이전시 로그인**일 때만 선다(손님·일반 사장님·PC 무변경).
 *  ② 열면 '에이전시' 탭이 기본이다.
 *  ③ 손님 것(숫자 줄·마이 딜·역할 안내·설정·탈퇴)은 '나' 탭에, 에이전시 것(맡은 매장·에이전시 구역·영입 버튼)은
 *     '에이전시' 탭에만 선다 — 서로 섞이지 않는다.
 * ⚠️ 못 보는 것: 실제 렌더 높이·실기기 모양(그려서 봐야 한다).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent } from '@testing-library/react'
import MyRoleTabs, { MY_TAB_DEFAULT } from '@/pages/user-profile/MyRoleTabs'

const PAGE = readFileSync('src/pages/UserProfilePage.tsx', 'utf8')

describe('① 탭이 서는 조건', () => {
  it('폰이고 에이전시 로그인이 있을 때만', () => {
    expect(PAGE).toContain('const tabbed = !isPc && agencyPresence.on')
    expect(PAGE).toMatch(/\{tabbed && <MyRoleTabs value=\{myTab\} onChange=\{setMyTab\} \/>\}/)
  })
  it('탭이 없으면 양쪽이 다 보인다(종전 화면)', () => {
    expect(PAGE).toContain("const showMe = !tabbed || myTab === 'me'")
    expect(PAGE).toContain("const showAgency = !tabbed || myTab === 'agency'")
  })
})

describe('② 기본은 에이전시', () => {
  it('기본값', () => {
    expect(MY_TAB_DEFAULT).toBe('agency')
    expect(PAGE).toContain('useState<MyTab>(MY_TAB_DEFAULT)')
  })
})

describe('③ 탭마다 그 역할 것만', () => {
  it('손님 것은 showMe 로', () => {
    expect(PAGE).toMatch(/showMe \? \(\s*<MyStats /)
    expect(PAGE).toContain('{showMe && <ShoppingGroup counts={counts} />}')
    expect(PAGE).toContain('{showMe && <RoleCtaGrid />}')
    expect(PAGE).toContain('{showMe && <RewardAdCard />}')
    expect(PAGE).toContain('{pcSplit || !showMe ? null : settingsBlock}')
    expect(PAGE).toMatch(/\{showMe && <div className="ur-content-medium px-4 lg:px-8 pt-2 pb-8/)
  })
  it('에이전시 것은 showAgency 로', () => {
    expect(PAGE).toMatch(/\{showAgency && <>\s*<AgencyTitleDoor [^>]*\/>\s*<SellerSection [^>]*\/>\s*<MyAgencyZone [^>]*\/>\s*<\/>\}/)
    expect(PAGE).toContain('{showAgency && <AgencyInviteDoor />}')
  })
})

describe('탭 부품', () => {
  it('누르면 그 탭을 알린다', () => {
    const onChange = vi.fn()
    render(<MyRoleTabs value="agency" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: '에이전시' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: '나' }))
    expect(onChange).toHaveBeenCalledWith('me')
  })
})
