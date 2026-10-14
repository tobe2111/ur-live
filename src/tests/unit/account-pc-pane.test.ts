import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🖥️ 2026-09-02 (대표 — "PC 모드 답지 않은 페이지야") PC 마이 "왼쪽 메뉴 + 오른쪽은 내용" 계약.
 *   종전 PC 는 모바일 메뉴 목록을 600px 에 세운 것이라 좌우가 같은 항목을 두 번 보여 줬다.
 *   ⚠️ 못 막는 것: 실제 배치(그리드 폭·정렬)는 `visual-preview --route=/user/profile --pc` 로 본다.
 */
const read = (f: string) => readFileSync(f, 'utf-8')
const PAGE = codeOnly(read('src/pages/UserProfilePage.tsx'))
const PANE = codeOnly(read('src/pages/user-profile/AccountPcPane.tsx'))

describe('PC 마이 — 우측 칸은 메뉴가 아니라 내용', () => {
  it('lg+ 는 AccountPcPane, 모바일은 종전 흐름(딜 카드 → 이용 내역 목록) — 동기 미디어쿼리 분기', () => {
    expect(PAGE).toMatch(/const isPc = useMediaQuery\('\(min-width: 1024px\)'\)/)
    // 🪑 2026-09-25: PC 분기에 "내 가게" 섹션이 형제로 붙어 조각(fragment)이 생겼다 —
    //   지키려던 것은 **PC 가 AccountPcPane 을 그린다**이지 그 줄의 모양이 아니다. 앵커만 재조준.
    // 🔁 2026-10-11 재조준(안 5): `AccountPcPane` 의 prop 이 전부 사라졌다 — 프로필 넷은 머리
    //   띠로, `counts` 는 `ShoppingGroup` 으로 갔다. 지키려던 것(**PC 가 이 칸을 그린다**)은 그대로다.
    expect(PAGE).toMatch(/\{isPc \? \([\s\S]{0,200}?<AccountPcPane \/>/)
    // 🔁 2026-09-29(안 C): 딜 잔액 카드가 상단 **숫자 한 줄**(`MyStats`)로 옮겨갔다 — 폰·PC 공통.
    expect(PAGE).toMatch(/<MyStats /)
    expect(PAGE).toMatch(/<ShoppingGroup counts=\{counts\} \/>/)
  })
  it('보라 그라디언트 헤더 띠가 없다(표면 규칙 ⑥) — PC 에선 모바일 헤더를 숨긴다', () => {
    expect(PAGE).not.toContain('#171026')
    expect(PAGE).not.toMatch(/bg-gradient-to-b from-white via-warm/)
    expect(PAGE).toMatch(/className=\{isPc \? 'hidden' : ''\}/)
  })
  /**
   * 🔁 2026-09-29 재조준(안 C) — 숫자 넷이 **큰 카드 넷**에서 페이지 맨 위 **한 줄**로 옮겨갔다.
   * 실측상 그중 셋이 0 이었고 카드 넷이 우측 칸의 절반을 먹었다. 목적지는 하나도 안 잃었다.
   */
  it('숫자 넷(딜·이용권·교환권·쿠폰)이 주인공 — 한 줄에서 각자 목적지로 간다', () => {
    const STATS = codeOnly(read('src/pages/user-profile/MyStats.tsx'))
    for (const p of ['/my-deal-history', '/my-vouchers', '/my-gifticons', '/my-coupons']) {
      expect(STATS, p).toContain(p)
    }
    // 넷이 한 줄이다 — 다시 격자 카드가 되면 그때 그 화면으로 돌아간 것이다.
    expect(STATS).toMatch(/divide-x divide-rule/)
    expect(PANE, 'PC 가 숫자를 또 그린다 — 같은 값이 한 화면에 두 벌').not.toMatch(/grid-cols-4/)
  })
  // 🔁 2026-10-14 PC 마이 B: 티켓 카드 → **지갑과 같은 줄**(`WalletRow`). 같은 날 지갑이 안 B 로 줄이
  //   됐다 — 같은 이용권이 두 화면에서 다른 모양이면 안 된다. 불변식 '같은 부품' 은 그대로.
  it('곧 쓸 이용권은 지갑과 같은 WalletRow 부품, 사용 가능 매장 이용권만 만료 임박순 3장', () => {
    expect(PANE).toContain("from '@/pages/my-vouchers/WalletRow'")
    expect(PANE, '티켓 카드가 돌아왔다 — 지갑과 모양이 갈린다').not.toContain('TicketCard')
    expect(PANE).toMatch(/v\.status === 'unused' && isStoreVoucher\(v\)/)
    expect(PANE).toMatch(/\.slice\(0, 3\)/)
  })
  /**
   * ✏️ 2026-09-02 갱신 — 목록을 **손으로 적어 두면 모바일이 바뀔 때 여기가 낡는다.**
   *   실제로 그랬다: 대표 지시로 '디지털 보관함' 을 모바일·PC 양쪽에서 걷어냈는데, 이 검사는
   *   `/my/digital` 을 하드코딩하고 있어 **계약(두 화면이 같은 목적지)은 지켜졌는데 빨간불**이 났다.
   *   ⇒ 지키려던 성질을 **파생해서** 검사한다: PC 타일의 목적지는 전부 모바일 목록에도 있어야 한다
   *     (PC 에만 있는 고아 목적지 = 두 화면이 갈린 것). 항목이 늘거나 줄어도 이 검사는 안 낡는다.
   *   ⚠️ 못 잡는 것: 반대 방향(모바일에만 있는 행)은 의도적으로 허용한다 — PC 타일은 요약이라
   *     모바일 목록의 부분집합인 게 정상이다.
   */
  /**
   * 🔁 **2026-10-11 재조준(안 5) — 손으로 적은 두 번째 목록 자체를 없앴다.**
   *
   * 종전 이 검사는 *"PC 타일의 목적지가 전부 모바일 목록에도 있는가"*(= 고아 금지)를 봤다.
   * 그런데 그 처방은 **두 목록이 존재하는 것을 전제**한 것이고, 실제로는 그 전제가 문제였다:
   *   ① 타일은 `shadow-lift` **판**이라 안 C 의 *"판은 파는 쪽에만"* 을 깼다.
   *   ② 셋뿐이라 **반대 방향의 고아**가 생겼다 — 쿠폰함·주문 내역·배송지·내 리뷰는 PC 에서
   *      갈 길이 아예 없었다(옛 검사는 그 방향을 *의도적으로 허용*한다고 적어 뒀다).
   * ⇒ PC 도 **폰과 같은 `ShoppingGroup`** 을 쓴다. 그러면 고아도 갈림도 **구조적으로 불가능**하다 —
   *   목록이 하나뿐이니까. 불변식을 "부분집합인가" 에서 **"같은 부품인가"** 로 올린다(더 강하다).
   */
  it('🔵 PC 손님 목록은 폰과 **같은 부품**이다 (손으로 적은 두 번째 목록이 없다)', () => {
    expect(PANE, 'PC 칸에 손으로 적은 타일 목록이 돌아왔다 — 그 순간 폰 목록과 갈린다')
      .not.toContain('const tiles = [')
    expect(PANE, 'PC 칸에 자체 목적지 표가 생겼다').not.toMatch(/path: '/)
    // 그 목록은 분기 **밖**에 있어야 PC·폰이 함께 쓴다(분기 안으로 들어가면 한쪽만 그린다).
    const iBranch = PAGE.indexOf('{isPc ? (')
    const iShop = PAGE.indexOf('<ShoppingGroup counts={counts} />')
    const iEnd = PAGE.indexOf('</>\n      )}', iBranch)
    expect(iShop, 'ShoppingGroup 을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    expect(iEnd, '분기 끝을 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(iBranch)
    expect(iShop, 'ShoppingGroup 이 isPc 분기 안으로 들어갔다 — PC 가 다시 손님 목록을 잃는다')
      .toBeGreaterThan(iEnd)
  })
  /**
   * 🔁 2026-09-28 재조준 (대표 *"PC 버전이나 모바일이나 너무 별로 · 허술해"*).
   *   종전 이 자리는 **왼쪽 메뉴의 생김새**(선택 블루 면 · 교환권 항목)를 잠갔다. 그 메뉴는
   *   걷어냈다 — `/user/profile` 에만 렌더돼 **누르면 사라지는 내비**였고, 일곱 항목 중 넷이
   *   오른쪽 열과 중복이라 09-02 에 고쳤던 *"같은 항목을 두 번"* 이 되살아나 있었다.
   *   ⇒ 앵커를 지우지 않고, **그 메뉴가 지키려던 것**(교환권이 PC 에서 닿는다)과
   *     **이번에 드러난 것**(같은 목적지가 두 번 나오지 않는다)으로 다시 겨눈다.
   */
  /**
   * 🔁 2026-10-11 재조준(안 5): 우측 타일이 사라져 *"두 목적지가 겹치는가"* 를 그 자리에서 잴 수
   *   없다. 지키려던 것(**08-31 지갑 분리가 PC 에서 닿는다**)은 그대로이고, 겹침 판정은 위
   *   '같은 부품' 검사가 구조적으로 대신한다.
   */
  it('🔴 지갑 분리(이용권 ↔ 교환권)가 PC 에서 둘 다 닿는다', () => {
    const STATS = codeOnly(read('src/pages/user-profile/MyStats.tsx'))
    expect(STATS).toContain('/my-gifticons')
    expect(STATS).toContain('/my-vouchers')
    // 숫자 줄은 폰·PC 가 **같은 부품**이다 — PC 가 따로 그리면 두 값이 갈린다.
    const BAND = codeOnly(read('src/pages/user-profile/AccountPcBand.tsx'))
    expect(BAND, 'PC 띠가 숫자를 손으로 그린다 — 같은 값이 두 벌이 된다').toContain('<MyStats inline')
    expect(BAND, 'PC 띠가 잔액을 또 조회한다').not.toContain('/api/points/balance')
  })

  it('🔴 좌측 내비는 돌아오지 않는다 — 가는 곳마다 함께 있지 않으면 내비가 아니다', () => {
    expect(existsSync('src/pages/user-profile/AccountSideNav.tsx'), 'AccountSideNav 가 살아났다').toBe(false)
    expect(PAGE).not.toContain('AccountSideNav')
    // ⚠️ 이 검사가 못 막는 것: **다른 이름의** 같은 내비. 되살릴 거라면 조건은 하나다 —
    //   그 내비의 목적지 페이지들(`/my-orders` 등)에서도 함께 렌더될 것. 그게 없어서 걷어냈다.
  })
})
