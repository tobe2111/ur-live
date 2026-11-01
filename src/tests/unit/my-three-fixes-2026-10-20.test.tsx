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
  /* 🔁 2026-10-25 재조준(대표 확정 내 가게 안 G) — 마이는 사용처리·등록이 판 밖 위의 **나란한 두 칸**이 됐다.
     지키던 것(*두 칸의 폭이 갈리지 않는다*)은 같은 `grid-cols-2` 칸 + 같은 높이(`h-16`)로 지킨다. */
  it('src/pages/user-profile/SellerSection.tsx', () => {
    const src = readCode('src/pages/user-profile/SellerSection.tsx')
    const grid = src.slice(src.indexOf('<div className="grid grid-cols-2 gap-2">'))
    expect(grid.length, '두 칸 격자를 못 찾았다').toBeLessThan(src.length)
    const scan = grid.indexOf("enterSeat('/store/scan')"), reg = grid.indexOf("openPage('/seller/group-buy', '이용권')")
    expect(scan > -1 && reg > scan, '두 칸이 한 격자 안에 나란히 있지 않다').toBe(true)
    expect((grid.slice(0, reg + 300).match(/min-w-0 flex items-center gap-2 h-16 px-3 rounded-2xl/g) ?? []).length, '두 칸의 높이·모서리가 갈렸다').toBe(2)
  })
  // 🤝 2026-10-24 — 에이전시 판엔 사용처리 티켓이 없다(자기 이용권만). 같은 폭(좌우 12px 안쪽 · 모서리 10px)은 지킨다.
  it('src/pages/agency-console/AgencyStorePlate.tsx', () => {
    const src = readCode('src/pages/agency-console/AgencyStorePlate.tsx')
    expect(src).toMatch(/<div className="p-3">\s*<button[^>]*?onClick=\{\(\) => openPage\('\/seller\/group-buy', '우리 이용권'\)\}\s*className="[^"]*rounded-\[10px\] bg-brand text-white/)
  })
  // 🔁 2026-10-25 — 판 안의 티켓·등록 줄 사이 구분선 문제는 안 G 에서 구조적으로 사라졌다(둘 다 판 밖의 칸이다).
  it('마이의 사용처리·등록은 판 밖이다(판 안 구분선 문제가 없다)', () => {
    const src = readCode('src/pages/user-profile/SellerSection.tsx')
    expect(src.indexOf("enterSeat('/store/scan')")).toBeLessThan(src.indexOf('<div className={LIST_PLATE_CLS}>'))
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
