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
import MyRoleTabs from '@/pages/user-profile/MyRoleTabs'
import { MY_TAB_DEFAULT } from '@/pages/user-profile/my-role-tab'

const PAGE = readFileSync('src/pages/UserProfilePage.tsx', 'utf8')

describe('① 탭이 서는 조건', () => {
  it('폰이고 에이전시 로그인이 있을 때만', () => {
    expect(PAGE).toContain('const tabbed = !isPc && agencyPresence.on')
    // 🔁 2026-11-03 안 1 다듬기 — 탭은 맨 위 줄(알림 종과 함께), 자리 예약 후 lazy.
    expect(PAGE).toMatch(/\{tabbed && \(\s*<div className="ur-content-medium flex items-center gap-2 pl-4 pr-2 pt-3">\s*<Suspense fallback=\{<div className="flex-1 h-\[50px\]" aria-hidden="true" \/>\}><MyRoleTabs value=\{myTab\} onChange=\{setMyTab\} \/><\/Suspense>/)
  })
  it('머리는 탭을 따라 바뀐다 — 나=정지원·프로필 편집 / 에이전시=에이전시 이름', () => {
    expect(PAGE).toMatch(/\{showMe && <div className=\{tabbed \?/)
    expect(PAGE).toContain('{tabbed && !showMe && <AgencyHeadDoor storeCount={sellerSeats.stores.length} />}')
    // 탭이면 판 위 제목은 '맡은 매장', 구역은 이름 없이 '에이전시 운영'(이름이 머리와 두 번 서지 않는다)
    // 🔁 2026-11-03 토스 참고 안 — 탭이면 매장 판을 카드에 담고(제목 없음), 탭이 아니면 종전 제목(합친 구역).
    expect(PAGE).toContain('{!tabbed && <AgencyTitleDoor storeCount={sellerSeats.stores.length} />}')
    expect(PAGE).toContain('data-testid="agency-store-card"><SellerSection state={sellerSeats} /></div>')
    expect(PAGE).toContain('<MyAgencyZone ownSellerIds={ownSellerIds} inHead={tabbed} />')
  })
  it('탭 부품은 lazy — 손님 첫 화면에 안 실린다', () => {
    expect(PAGE).toContain("const MyRoleTabs = lazy(() => import('./user-profile/MyRoleTabs'))")
    expect(PAGE).not.toMatch(/import MyRoleTabs/)
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
    expect(PAGE).toMatch(/\{showMe && <div className="ur-content-medium px-5 lg:px-8 pt-2 pb-8/)
  })
  it('에이전시 것은 showAgency 로', () => {
    expect(PAGE).toMatch(/\{showAgency && <>[\s\S]{0,900}?<SellerSection state=\{sellerSeats\} \/>\}\s*<MyAgencyZone [^>]*\/>\s*<\/>\}/)
  })
})

describe('탭 부품', () => {
  it('누르면 그 탭을 알린다', () => {
    const onChange = vi.fn()
    render(<MyRoleTabs value="agency" onChange={onChange} />)
    expect(screen.getByRole('button', { name: '에이전시' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '나' }))
    expect(onChange).toHaveBeenCalledWith('me')
  })
})
