/**
 * 🪙 **같은 숫자를 두 화면이 반대로 보여 주지 않는다** + 🔇 **같은 화면에 같은 문이 둘이 아니다**
 * (2026-09-28 — 결재 `docs/decisions/2026-09-28-my-duplicate-entry-and-slab.md`)
 *
 * ## ⓑ 딜 잔액 — 마이가 교환권 탭과 **같은 부품**을 쓴다
 * 2026-09-02 에 대표가 교환권 탭의 잔액 블록을 *"검정 슬래브 → 흰 카드 + 큰 잉크 숫자"* 로
 * 확정했는데 **마이만 안 따라왔다.** 그래서 마이에서 그 카드가 화면의 유일한 검정 덩어리였고,
 * 하필 손님 쪽에 있었다. 스타일을 베껴 오면 다음 변경에서 또 한쪽만 따라가므로 **부품을 공유**한다.
 *
 * ## ⓐ "내 가게 등록" 이 한 화면에 둘이었다
 * 이름 옆 알약(`SellerSwitchInline`)과 `RoleCtaGrid` 타일이 **같은 글자·같은 목적지**였고
 * 약 850px 떨어져 있었다. 남긴 것은 타일이다 — 타일은 무엇을 등록하는지 말해 준다.
 * ⚠️ 상태 배지(심사 중·반려·정지)는 남는다. 그건 중복이 아니라 이 사람에게만 해당하는 상태다.
 *
 * ⚠️ **이 시험이 못 하는 것**: 검정이 실제로 사라졌는지는 렌더 색의 문제다.
 *   브라우저 판정: `node scripts/visual-preview.mjs --route=/user/profile --auth=user --stores=1`
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const MY_CARD = readCode('src/pages/user-profile/TeamPointsCard.tsx')
const SHARED = readCode('src/pages/vouchers/DealBalanceCard.tsx')
const PILL = readCode('src/pages/user-profile/SellerSwitchInline.tsx')
const GRID = readCode('src/pages/user-profile/RoleCtaGrid.tsx')

describe('ⓑ 딜 잔액 — 두 화면이 한 부품을 쓴다', () => {
  it('🔴 마이가 교환권 탭의 카드를 그대로 쓴다 (스타일을 베끼지 않는다)', () => {
    expect(MY_CARD).toContain('<DealBalanceCard')
    expect(MY_CARD).toContain("from '@/pages/vouchers/DealBalanceCard'")
  })

  it('🔴 마이에 검정 슬래브가 남아 있지 않다', () => {
    expect(MY_CARD).not.toContain('bg-ink')
    expect(MY_CARD).not.toMatch(/bg-\[#1D1F29\]/)
  })

  it('🛡️ 실패를 0딜로 위장하지 않는다 (2026-07-02 규칙)', () => {
    expect(MY_CARD).toContain('setError(true)')
    expect(MY_CARD).toMatch(/error=\{error\}/)
    expect(MY_CARD).toMatch(/onRetry=\{fetchBalance\}/)
    // 부품 쪽 — 실패는 큰 숫자를 안 그리고 한 줄 바로 접는다.
    expect(SHARED).toMatch(/if \(error\) \{/)
    expect(SHARED).toContain('잔액을 불러오지 못했어요')
  })

  it('💸 무상 리워드 안내가 사라지지 않았다 (약관 — 환급 제외)', () => {
    expect(MY_CARD).toContain('무상 리워드')
    expect(MY_CARD).toContain('환급 가능')
    expect(SHARED).toContain('note')
  })

  it('🪙 잔액이 오기 전에도 높이를 잡는다 (목록이 안 밀린다)', () => {
    expect(MY_CARD).toMatch(/loggedIn=\{!!getUserIdSync\(\)\}/)
  })

  it('충전 버튼은 되살아나지 않았다 (2026-07-18 종료)', () => {
    expect(MY_CARD).not.toContain('/points/charge')
    expect(MY_CARD).not.toContain('충전')
  })
})

describe('ⓐ 등록 문은 한 화면에 하나', () => {
  it('🔴 이름 옆 알약이 "내 가게 등록" 을 다시 말하지 않는다', () => {
    expect(PILL).not.toContain('내 가게 등록')
    expect(PILL).not.toContain("navigate('/store/new')")
  })

  it('🔴 남은 문은 타일이다 — 목적지가 살아 있다', () => {
    expect(GRID).toContain('내 가게 등록')
    expect(GRID).toContain("'/store/new'")
  })

  it('상태 배지는 남는다 — 그건 중복이 아니다', () => {
    for (const label of ['심사 중', '반려', '정지']) {
      expect(PILL, label).toContain(label)
    }
    expect(PILL).toContain("navigate('/seller/waiting')")
  })

  it('좌석이 있으면 알약 자체가 안 뜬다 (2026-09-25 규칙 불변)', () => {
    expect(PILL).toMatch(/if \(hasSeat\) return null/)
  })
})
