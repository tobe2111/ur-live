/**
 * 🧾 에이전시 화면 — 토스 참고 안 (2026-11-03 대표 *"에이전시 화면은 토스 참고 안으로 해주고"*).
 * 지키는 것: ① 오늘 매출은 맡은 매장 `today` 의 합이고, 모르면 0 으로 위장하지 않는다
 *   ② 판(카드) 안의 줄은 두 줄 문법(타일 + 제목 + 회색 한 줄) ③ 마이 에이전시 탭·에이전시 전용 마이가 토스 안을 쓴다
 *   ④ 로그아웃은 조용한 글자 ⑤ '홈페이지에 넣기' 입구가 없다(대표 지시, embed-agency-code 가 함께 지킨다).
 * ⚠️ 못 보는 것: 실제 렌더 간격·색(그려서 볼 것).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { AgencyTodayCard, AgencyRowStyle } from '@/pages/agency-console/agency-toss'
import { FlatRow } from '@/pages/agency-console/AgencyStoresPanel'
import type { StoreRow } from '@/pages/agency-console/agency-stores-model'

const row = (id: number, today: StoreRow['today']): StoreRow => ({ linkId: id, sellerId: id, name: `매장${id}`, storeStatus: null, requestedAt: '', acceptedAt: '', today } as StoreRow)

describe('① 오늘 매출 합계', () => {
  it('맡은 매장 today 를 더한다', () => {
    render(<AgencyTodayCard rows={[row(1, { todayRevenue: 1000, todayOrders: 2, pending: 1, activeProducts: 3 }), row(2, { todayRevenue: 2500, todayOrders: 1, pending: 0, activeProducts: 4 })]} />)
    expect(screen.getByText('3,500원')).toBeTruthy()
    expect(screen.getByText('오늘 매출 · 2곳 합계')).toBeTruthy()
    expect(screen.getByText('7개')).toBeTruthy()
  })
  it('아직 모르면(rows=null) 숫자를 그리지 않는다 — 0원 위장 금지', () => {
    const { container } = render(<AgencyTodayCard rows={null} />)
    expect(container.textContent).not.toContain('0원')
  })
})

describe('② 판 안의 줄 = 두 줄 문법', () => {
  it('토스 맥락이면 타일 + 16·600 제목 + 13 회색 한 줄', () => {
    const { container } = render(
      <AgencyRowStyle.Provider value="toss"><FlatRow icon={<i />} label="직원" hint="2명" onClick={vi.fn()} /></AgencyRowStyle.Provider>,
    )
    expect(container.querySelector('.rounded-xl.bg-brand-tint')).toBeTruthy()
    expect(container.querySelector('.text-\\[16px\\].font-semibold')?.textContent).toBe('직원')
    expect(container.querySelector('.text-\\[13px\\]')?.textContent).toBe('2명')
  })
})

describe('③④ 배선', () => {
  it('마이 에이전시 탭과 에이전시 전용 마이가 토스 안을 쓴다', () => {
    expect(readFileSync('src/pages/user-profile/MyAgencyZone.tsx', 'utf8')).toContain('toss={inHead}')
    expect(readFileSync('src/pages/agency-console/AgencyMyPage.tsx', 'utf8')).toContain('<AgencySection headless toss hideLogout onSessionEnd={onSessionEnd} />') // 2026-11-04: 로그아웃은 마이 설정 맨 아래로(agency-first-run)
    expect(readFileSync('src/pages/UserProfilePage.tsx', 'utf8')).toContain('data-testid="agency-store-card"><SellerSection state={sellerSeats} /></div>')
  })
  it('토스 안의 로그아웃은 줄이 아니라 조용한 글자', () => {
    const s = readFileSync('src/pages/agency-console/AgencySection.tsx', 'utf8')
    expect(s).toContain('trailingRows={hideLogout ? undefined : toss ? (') // 2026-11-04: 에이전시 전용 마이는 설정 맨 아래 줄을 쓴다
    expect(s).toContain('text-[13px] text-gray-500 dark:text-gray-400 active:opacity-70">에이전시 로그아웃</button>')
  })
})
