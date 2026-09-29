/**
 * 🪙 **같은 숫자를 두 화면이 반대로 보여 주지 않는다** + 🔇 **같은 화면에 같은 문이 둘이 아니다**
 * (2026-09-28 — 결재 `docs/decisions/2026-09-28-my-duplicate-entry-and-slab.md`)
 *
 * ## 🔁 2026-09-29 재조준 — 대표 확정 **안 C**(코레일톡 전체메뉴 형태)
 * 딜 잔액이 **별도 카드**(`TeamPointsCard`, 판매 구역 아래)에서 페이지 맨 위 **숫자 한 줄**
 * (`MyStats` — 내 딜 | 이용권 | 쿠폰)로 옮겨갔다. 그래서 *"교환권 탭과 같은 부품을 쓴다"* 는
 * 불변식은 **성립하지 않는다** — 형태가 달라졌다(3열 한 줄 vs 지갑 머리 카드).
 *
 * ⚠️ **그건 가드를 약하게 만드는 일이라 무엇이 남고 무엇이 사라졌는지 적어 둔다.**
 *   사라진 것: "두 화면이 같은 부품" (형태가 갈라졌으므로 더는 잴 수 없다).
 *   남은 것 — 머니 표면 룰은 **하나도 안 줄었다**:
 *     · 실패를 0딜로 위장하지 않는다(`—`)  · 무상 리워드 고지(약관 — 환급 제외)
 *     · 값 도착 전 높이 확보(목록이 안 밀린다)  · 충전 버튼 부활 금지(2026-07-18 종료)
 *   그리고 새로 하나 늘었다: **딜 칸이 그 줄에서 빠지지 않는다**(빠져도 나머지 둘이 멀쩡히 선다).
 *
 * ## ⓑ 딜 잔액 — 옛 기록: 마이가 교환권 탭과 **같은 부품**을 쓴다
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

const MY = readCode('src/pages/user-profile/MyStats.tsx')
const SHARED = readCode('src/pages/vouchers/DealBalanceCard.tsx')
const PILL = readCode('src/pages/user-profile/SellerSwitchInline.tsx')
const GRID = readCode('src/pages/user-profile/RoleCtaGrid.tsx')

describe('ⓑ 딜 잔액 — 맨 위 숫자 한 줄 (안 C)', () => {
  it('🔵 딜 칸이 그 줄에 있다 (빠져도 나머지 둘이 멀쩡히 서서 아무도 신고하지 않는다)', () => {
    expect(MY).toContain('label="내 딜"')
    expect(MY).toContain('value={balance}')
  })

  it('🔴 숫자 줄에 검정 슬래브가 남아 있지 않다', () => {
    expect(MY).not.toContain('bg-ink')
    expect(MY).not.toMatch(/bg-\[#1D1F29\]/)
  })

  it('🛡️ 실패를 0딜로 위장하지 않는다 (2026-07-02 규칙)', () => {
    // 조회 실패는 `null` — 0 으로 떨어뜨리면 화면이 "잔액 없음" 이라고 거짓말을 한다.
    expect(MY).toMatch(/\.catch\(\(\) => setBalance\(null\)\)/)
    expect(MY, '실패 표시(—)가 없다').toContain('—')
    expect(MY).not.toMatch(/catch[^\n]*setBalance\(0\)/)
    // 교환권 탭 쪽 부품도 같은 규칙을 지킨다(같은 숫자를 보여 주는 다른 화면).
    expect(SHARED).toMatch(/if \(error\) \{/)
    expect(SHARED).toContain('잔액을 불러오지 못했어요')
  })

  it('💸 무상 리워드 안내가 사라지지 않았다 (약관 — 환급 제외)', () => {
    expect(MY).toContain('무상 리워드')
    expect(MY).toContain('환급 가능')
    expect(SHARED).toContain('note')
  })

  it('🪙 값이 오기 전에도 높이를 잡는다 (목록이 안 밀린다)', () => {
    // `undefined` = 아직 모름. 자리만 잡고 숫자를 지어내지 않는다(2026-09-16 잔액 카드 교훈).
    expect(MY).toMatch(/value === undefined \?/)
    expect(MY).toMatch(/inline-block w-10 h-\[18px\]/)
  })

  it('충전 버튼은 되살아나지 않았다 (2026-07-18 종료)', () => {
    // 경로 자체는 플래그 뒤에 남아 있다 — 되살릴 때 그 한 줄만 되돌리면 되게.
    expect(MY).toMatch(/TOPUP_DISABLED \? '\/my-deal-history'/)
    expect(MY, '충전 문구가 되살아났다').not.toContain('충전')
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
