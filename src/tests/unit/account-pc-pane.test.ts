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
    expect(PAGE).toMatch(/\{isPc \? \([\s\S]{0,200}?<AccountPcPane counts=\{counts\}/)
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
  it('곧 쓸 이용권은 지갑·결제 완료와 같은 TicketCard 부품, 사용 가능 매장 이용권만 만료 임박순 3장', () => {
    expect(PANE).toContain("from '@/components/ticket/TicketCard'")
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
  it('바로가기 타일의 목적지는 전부 모바일 목록에도 있다 (PC 전용 고아 없음)', () => {
    const SHOP = codeOnly(read('src/pages/user-profile/ShoppingGroup.tsx'))
    const tiles = PANE.slice(PANE.indexOf('const tiles = ['), PANE.indexOf(']', PANE.indexOf('const tiles = [')))
    const paths = [...tiles.matchAll(/path: '([^']+)'/g)].map(m => m[1])
    expect(paths.length, 'PC 타일을 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThanOrEqual(3)
    for (const p of paths) {
      expect(SHOP, `PC 타일 ${p} 이 모바일 목록에 없다 — 두 화면이 갈렸다`).toContain(`path: '${p}'`)
    }
  })
  /**
   * 🔁 2026-09-28 재조준 (대표 *"PC 버전이나 모바일이나 너무 별로 · 허술해"*).
   *   종전 이 자리는 **왼쪽 메뉴의 생김새**(선택 블루 면 · 교환권 항목)를 잠갔다. 그 메뉴는
   *   걷어냈다 — `/user/profile` 에만 렌더돼 **누르면 사라지는 내비**였고, 일곱 항목 중 넷이
   *   오른쪽 열과 중복이라 09-02 에 고쳤던 *"같은 항목을 두 번"* 이 되살아나 있었다.
   *   ⇒ 앵커를 지우지 않고, **그 메뉴가 지키려던 것**(교환권이 PC 에서 닿는다)과
   *     **이번에 드러난 것**(같은 목적지가 두 번 나오지 않는다)으로 다시 겨눈다.
   */
  it('🔴 PC 우측 칸의 목적지는 서로 겹치지 않는다 — 좌측 내비가 넷을 중복했다', () => {
    const STATS = codeOnly(read('src/pages/user-profile/MyStats.tsx'))
    const paths = [...PANE.matchAll(/path: '([^']+)'/g)].map(m => m[1])
    // 🔁 2026-09-29: 숫자 넷이 상단 줄로 옮겨가 이 칸의 목적지가 셋(타일)으로 줄었다.
    expect(paths.length, '목적지를 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThanOrEqual(3)
    expect(new Set(paths).size, `PC 칸에 같은 목적지가 두 번: ${paths.join(', ')}`).toBe(paths.length)
    // 08-31 지갑 분리(이용권 ↔ 교환권)가 PC 에서 닿는지 — 옛 검사가 지키던 바로 그 항목.
    //   이제 그 둘은 상단 숫자 줄이 들고 간다.
    expect(STATS).toContain('/my-gifticons')
    expect(STATS).toContain('/my-vouchers')
    // 상단 줄과 우측 타일이 같은 곳을 또 가리키면 09-02 의 "같은 항목을 두 번" 이 되살아난다.
    for (const p of paths) {
      expect(STATS, `우측 타일 ${p} 을 상단 숫자 줄이 또 가리킨다`).not.toContain(`"${p}"`)
    }
  })

  it('🔴 좌측 내비는 돌아오지 않는다 — 가는 곳마다 함께 있지 않으면 내비가 아니다', () => {
    expect(existsSync('src/pages/user-profile/AccountSideNav.tsx'), 'AccountSideNav 가 살아났다').toBe(false)
    expect(PAGE).not.toContain('AccountSideNav')
    // ⚠️ 이 검사가 못 막는 것: **다른 이름의** 같은 내비. 되살릴 거라면 조건은 하나다 —
    //   그 내비의 목적지 페이지들(`/my-orders` 등)에서도 함께 렌더될 것. 그게 없어서 걷어냈다.
  })
})
