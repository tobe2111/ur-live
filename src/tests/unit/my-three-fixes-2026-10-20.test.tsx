/**
 * 🧹 마이 세 가지 (2026-10-20 대표 *"2,3,4 모두 다 고쳐줘"*).
 *   ② '내 가게' 옆 종 → **글자 '판매 알림'** — 맨 위 종(내 알림)과 한 화면에 종이 둘이었다.
 *   ③ 파란 '이용권 등록 · 관리' 줄이 위 사용처리 티켓과 **같은 폭**(좌우 12px 안쪽 · 모서리 10px) — 마이·에이전시 판 둘 다.
 *   ④ '주문 내역' 줄을 '내가 산 것' 목록에서 빼고, 구역 제목 오른쪽 **'결제 내역 ›'** 로 같은 화면에 간다(갈 길은 남긴다).
 * ⚠️ 못 보는 것: 실제 폰에서 '판매 알림' 글자와 긴 가게 이름이 한 줄에 들어가는지(그림으로만 판정).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionTitle } from '@/pages/user-profile/list-grammar'
import { readCode } from '../helpers/source-text'

describe('② 판매 알림은 글자다', () => {
  const src = readCode('src/pages/user-profile/seller-section/StoreNotifications.tsx')
  it('종 아이콘을 안 쓰고 시트 제목과 같은 글자를 쓴다', () => {
    expect(src).not.toMatch(/BellIcon/)
    expect(src).toMatch(/<span>판매 알림<\/span>/)
    expect(src).toMatch(/aria-label=\{unread > 0 \? `판매 알림 \$\{unread\}건` : '판매 알림'\}/)
  })
})

describe('③ 등록 줄은 사용처리 티켓과 같은 폭', () => {
  for (const f of ['src/pages/user-profile/SellerSection.tsx', 'src/pages/agency-console/AgencyStorePlate.tsx']) {
    it(f, () => {
      const src = readCode(f)
      expect(src).toMatch(/<div className="p-3 border-b border-rule">\s*<button[^>]*?onClick=\{\(\) => openPage\('\/seller\/group-buy', '이용권'\)\}\s*className="[^"]*rounded-\[10px\] bg-brand text-white/)
    })
  }
  it('마이 판의 사용처리 칸은 아래 구분선을 등록 줄에 넘긴다(구분선은 둘 아래 하나)', () => {
    const src = readCode('src/pages/user-profile/SellerSection.tsx')
    expect(src).toMatch(/<div className="px-3 pt-3">\s*<button[^>]*?onClick=\{\(\) => enterSeat\('\/store\/scan'\)\}/)
  })
})

describe('④ 주문 내역 → 구역 제목의 결제 내역', () => {
  const src = readCode('src/pages/user-profile/ShoppingGroup.tsx')
  it('목록 줄에 /my-orders 가 없다', () => {
    expect(src).not.toMatch(/path: '\/my-orders'/)
  })
  it('구역 제목 오른쪽 링크가 /my-orders 로 간다', () => {
    expect(src).toMatch(/<SectionTitle action=\{\{ label: t\('shopping\.paymentHistory'[^\n]*onClick: \(\) => navigate\('\/my-orders'\) \}\}>/)
  })
  it('SectionTitle 의 action 은 제목 옆 버튼으로 그려진다', () => {
    const onClick = vi.fn()
    render(<SectionTitle action={{ label: '결제 내역', onClick }}>내가 산 것</SectionTitle>)
    expect(screen.getByRole('heading', { name: '내가 산 것' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '결제 내역' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
  it('action 이 없으면 종전과 같은 제목 하나', () => {
    const { container } = render(<SectionTitle>설정</SectionTitle>)
    expect(container.querySelector('button')).toBeNull()
    expect(container.firstElementChild?.tagName).toBe('H2')
  })
})
