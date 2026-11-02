/**
 * 🪙 **같은 숫자를 두 화면이 반대로 보여 주지 않는다** + 🔇 **같은 화면에 같은 문이 둘이 아니다**
 * (2026-09-28 — 결재 `docs/decisions/archive/2026-09-28-my-duplicate-entry-and-slab.md`)
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
    expect(MY).toContain('환급 대상이 아니')
    /**
     * 🩸 2026-09-29 — 주입 러너가 **이 검사가 헛돈다**고 잡았다.
     * 문구만 보면 렌더 조건을 꺼도(`{false && (`) 글자는 파일에 남아 **초록**이다.
     * 지키려는 것은 "글자가 소스에 있다"가 아니라 **무상 딜이 있으면 화면에 뜬다** 이고,
     * 그 말을 하는 자리는 문구가 아니라 **조건**이다.
     * 🧭 이 앵커는 안 C 에서 `TeamPointsCard` → `MyStats` 로 옮기며 내가 약하게 만든 것이다 —
     *    앵커를 옮길 때 "무엇을 지키려 했는가" 를 같이 옮겨야 한다.
     */
    /**
     * 🔁 **2026-10-11 재조준(안 5)** — 그 조건에 이름이 생겼다(`refundable`). PC 머리 띠가 같은
     *   사실을 값 아래 한 줄로 말해야 해서 **두 자리가 같은 조건**을 쓰기 때문이다.
     *   불변식은 그대로 — *무상 딜이 있으면 화면에 뜬다*. 그래서 **정의와 사용 둘 다** 본다:
     *   정의만 보면 쓰는 데가 없어도 통과하고, 사용만 보면 조건이 상수로 바뀌어도 통과한다.
     */
    /**
     * 🔁 **2026-10-12 재조준** — `refundable` 이 **숫자**(서버가 준 실제 환급 가능액)가 됐다
     *   (충전 잔액 환급 신청이 생겼다). 줄을 그리는 조건은 `showNote` 로 이름이 바뀌었고, 무상 딜이 있거나
     *   돌려받을 딜이 있으면 뜬다. 불변식은 그대로 — *무상 딜이 있으면 화면에 뜬다*(정의와 사용 둘 다 본다).
     */
    expect(MY, '안내 줄 조건의 정의가 사라졌다 — 무상 딜이 있어도 안 뜰 수 있다')
      // 🔁 2026-11-02 재조준 — 대표 *"충전 딜 환급 … 아예 없애"* 로 마이의 환급 줄이 사라져 조건이 무상 딜 하나다.
      .toMatch(/const showNote = balance != null && freeBalance > 0/)
    /* 🔁 2026-10-25 재조준(위쪽 안 3) — 폰은 목록 판의 마지막 줄이 됐다. 돌려받을 딜이 있으면 그 줄이 환급 줄이고,
       없으면 무상 딜 안내 글이다(`showNote && freeBalance > 0`). 불변식 그대로 — 조건이 살아 있어야 한다. */
    expect(MY, '무상 리워드 안내가 죽은 가지로 남았다 (조건이 꺼졌다)')
      .toMatch(/\{showNote && \(|showNote && freeBalance > 0 \?/)
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
    /* 🔁 2026-10-25 재조준 — 대표 *"환급은 뭐야? 정산이야?"* 에 답하려고 환급 줄 이름이 **'충전 딜 환급'** 이 됐다
       (무엇을 돌려받는지 말하는 낱말이다). 지키려던 것은 낱말 '충전' 이 아니라 **충전하러 가는 문**이다. */
    expect(MY, '충전 버튼 문구가 되살아났다').not.toMatch(/충전하기|딜 충전|충전 버튼/)
    expect(MY.match(/\/points\/charge/g)?.length ?? 0, '충전 경로가 플래그 밖에서 쓰인다').toBe(1)
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
