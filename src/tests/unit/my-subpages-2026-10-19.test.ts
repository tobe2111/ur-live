/**
 * 🧹 2026-10-19 — 대표 *"응 다 이상적으로 진행해줘 모두. 모두 고쳐줘"* (마이에서 들어가는 화면 정리 2차).
 *
 * 머리줄 통일은 `account-delete-honest-2026-10-19.test.ts` ⑥ 이 마이 목록에서 파생해 지킨다.
 * 이 파일은 나머지 넷 — 화면마다 하나씩 남아 있던 "이 화면에만 있는 모양":
 *   ① 딜 내역 — 검정 그라디언트 판 · 늘 비는 '추천' 칩 · 상자 아이콘 빈 화면
 *   ② 주문 내역 — 필터가 위아래 두 줄(상태 칩 + 종류 탭) · 빈 카드 테두리
 *   ③ 설정 — 이메일 알림과 화면 테마 사이만 구분선 없음 · 테마 선택이 옅은 테두리
 *   ④ 알림 — 빈 화면의 할 일 버튼이 회색 테두리(주 행동인데 보조 버튼 모양)
 *
 * ⚠️ 이 파일이 못 보는 것: 실제 픽셀(jsdom 에 레이아웃이 없다 — `visual-preview` 로 그려서 본다) ·
 *   native `<select>` 가 기기마다 그리는 펼친 목록의 모양.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const DEAL = readCode('src/pages/MyDealHistoryPage.tsx')
const ORDERS = readCode('src/pages/MyOrdersPage.tsx')
const TAB = readCode('src/components/mypage/OrdersTab.tsx')
const THEME = readCode('src/components/settings/ThemeToggleSection.tsx')
const NOTI = readCode('src/pages/NotificationsPage.tsx')
const PAGE = readCode('src/pages/UserProfilePage.tsx')

describe('① 딜 내역', () => {
  it('잔액은 흰 카드 — 검정 그라디언트 판이 아니다', () => {
    expect(DEAL, '이 화면에만 있던 검정 판').not.toMatch(/linear-gradient/)
    // 2026-11-02 대표 확정 A안 — 평면: 잔액 판도 그림자·흰 바탕 없이 그린다.
    expect(DEAL).toMatch(/<div className="rounded-2xl p-5">/)
    expect(DEAL).not.toMatch(/shadow-lift/)
  })

  it("'추천' 칩이 없다 — 유저 추천 보너스는 지급된 적이 없고 주지 않는다(2026-10-16)", () => {
    const filters = DEAL.slice(DEAL.indexOf('const FILTER_OPTIONS'), DEAL.indexOf('const TYPE_ICON'))
    expect(filters.length, 'FILTER_OPTIONS 를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(100)
    expect(filters).not.toContain("'referral_bonus'")
    expect(filters).not.toContain("'추천'")
  })

  it('빈 화면은 유달이 — 상자 아이콘이 아니다', () => {
    expect(DEAL).toMatch(/<Udal mood="empty"/)
    expect(DEAL).not.toMatch(/\bInbox\b/)
  })
})

describe('② 주문 내역 — 필터는 한 줄', () => {
  it('페이지가 상태 칩 줄을 따로 그리지 않는다', () => {
    expect(ORDERS, '상태 칩 줄이 종류 탭 위에 또 선다').not.toMatch(/STATUS_FILTERS\.map\(/)
    expect(ORDERS).toMatch(/statusOptions=\{STATUS_FILTERS\}/)
  })

  it('상태 고르기가 종류 탭과 같은 줄 안에 있다', () => {
    const row = TAB.slice(TAB.indexOf('{KIND_TABS.map('), TAB.indexOf('filtered.length === 0 ?'))
    expect(row.length).toBeGreaterThan(200)
    expect(row, '상태 고르기가 탭 줄 밖으로 나갔다').toMatch(/<select\b/)
    expect(row).toMatch(/statusValue !== 'all' \? 'bg-brand text-white'/)
  })

  it('빈 카드에 테두리가 없다 — 카드는 들림 하나', () => {
    const empty = TAB.slice(TAB.indexOf('function EmptyState'))
    expect(empty, '2026-11-02 A안 — 빈 카드도 평면').toMatch(/rounded-2xl p-12 text-center/)
    expect(empty).not.toMatch(/shadow-lift/)
    expect(empty).not.toMatch(/bg-surface rounded-2xl border\b/)
  })
})

describe('③ 설정', () => {
  it('화면 테마 블록이 위아래 구분선을 갖는다(바로 위 알림 줄이 자기 마지막 선을 지운다)', () => {
    expect(THEME).toMatch(/border-y border-rule/)
  })

  it('고른 테마는 브랜드 블루 면 — 옅은 테두리가 아니다', () => {
    expect(THEME).toMatch(/const activeClass = 'bg-brand text-white'/)
    expect(THEME, '선택이 다시 옅은 블루 테두리로').not.toMatch(/border-brand\/40/)
  })

  it('로그아웃 줄이 떠 있지 않다 — 같은 hairline 목록', () => {
    const settings = PAGE.slice(PAGE.indexOf('<SettingsGroup>'), PAGE.indexOf('</SettingsGroup>'))
    expect(settings).toContain('userProfile.logout')
    expect(settings, '로그아웃 위에 빈 칸(mt-4)이 돌아오면 구분선 대신 공백이 경계가 된다').not.toMatch(/<div className="mt-4">\s*<ListRow/)
  })
})

describe('④ 알림', () => {
  it('빈 화면의 할 일 버튼은 주 버튼(브랜드 블루)', () => {
    const empty = NOTI.slice(NOTI.indexOf("t('notifications.empty')"))
    expect(empty).toMatch(/ur-btn ur-btn-md ur-btn-primary/)
    expect(empty.slice(0, 600)).not.toMatch(/ur-btn-secondary/)
  })

  it("'모두 읽음' 은 안 읽은 게 있을 때만", () => {
    expect(NOTI).toMatch(/right=\{notifications\.some\(n => !n\.is_read\) \?/)
  })
})
