/**
 * 🪙 **딜 잔액 카드 — 대표 확정(2026-09-14, 안 A3 + 42px)을 고정한다**
 *
 * 레퍼런스(당근포인트)를 놓고 A/B/C 세 방향 → A 안에서 여섯 배치 → **A3** 로 확정됐다.
 * 확정된 것 넷을 시험으로 못 박는다. 넷 다 **에러를 내지 않고 조용히 되돌아갈 수 있는** 것들이다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 실제로 예뻐 보이는지는 못 잰다(그건 대표가 본다). 여기서 지키는 것은
 * "고른 구조가 남아 있는가" 하나다. 색 대비는 `check-dark-contrast`, 테마 누락은
 * `check-theme-consistency` 가 따로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'

const card = stripComments(readFileSync('src/pages/vouchers/DealBalanceCard.tsx', 'utf8'))
const page = stripComments(readFileSync('src/pages/VouchersPage.tsx', 'utf8'))

describe('🪙 확정 구조 (안 A3)', () => {
  it('숫자는 42px — 대표가 세 크기(36/42/48) 중 고른 값', () => {
    expect(card).toMatch(/text-\[42px\]/)
    expect(card).not.toMatch(/text-\[36px\]/)   // 종전 값으로 되돌아가면 빨간불
  })

  // 두 층을 가르는 실제 코드 경계. ⚠️ **주석 문구를 앵커로 쓰지 말 것** — 2026-09-14 에
  // 여기 `card.indexOf('아래층')`(주석에만 있던 낱말)을 썼다가, 같은 날 main 이 주석
  // 제거기를 여러 줄 JSX 주석까지 지우도록 고치자 -1 이 되어 슬라이스가 카드 전체로 번졌다.
  const DIVIDER = 'h-px bg-rule'
  const dividerAt = card.indexOf(DIVIDER)

  it('경계 앵커가 실재한다 — 없으면 아래 두 시험이 헛돈다', () => {
    expect(dividerAt).toBeGreaterThan(-1)
  })

  it('🔴 위층에 버튼이 없다 — 그게 A3 의 전부다', () => {
    // 위층(라벨~금액)을 잘라 그 안에 button 이 없는지 본다.
    const top = card.slice(card.indexOf('내 딜 잔액'), dividerAt)
    expect(top).not.toMatch(/<button/)
  })

  it('🔴 아래층은 두 칸 — 딜 모으기 · 이용내역', () => {
    const bottom = card.slice(dividerAt)
    expect(bottom).toMatch(/딜 모으기/)
    expect(bottom).toMatch(/이용내역/)
    expect((bottom.match(/<button/g) ?? []).length).toBe(2)
    expect(bottom).toMatch(/w-px bg-rule/)     // 두 칸을 가르는 세로 선
  })

  it('🔴 채운 브랜드 버튼이 없다 — 블루는 글자 한 곳에만', () => {
    // 종전엔 `bg-brand` 로 채운 [내역] 알약이 화면에서 가장 센 버튼이었다.
    expect(card).not.toMatch(/bg-brand\b/)
    expect(card).toMatch(/text-brand-text/)
  })

  it('🔴 "1딜 = 1원" 을 되살리지 않는다 (대표: "값어치를 말할 필요는 없어")', () => {
    expect(card).not.toMatch(/1딜\s*=\s*1원/)
    expect(page).not.toMatch(/1딜\s*=\s*1원/)
  })

  it('🔴 잔액 0 은 큰 카드를 쓰지 않는다 — 첫 진입이 "당신은 0" 이 되지 않게', () => {
    expect(card).toMatch(/if \(!balance && !awaiting\)/)
    const zero = card.slice(card.indexOf('if (!balance && !awaiting)'), card.indexOf('내 딜 잔액'))
    expect(zero).not.toMatch(/text-\[42px\]/)
  })

  it('🔴 기다리는 카드는 **로그인한 사람에게만** — 비로그인은 종전대로 한 줄 바다', () => {
    // 이 조건이 `balance == null` 만 되면 비로그인 방문자에게도 빈 카드가 떠서,
    // 2026-09-01 에 고친 "당신은 0" 문제가 모양만 바꿔 되살아난다.
    expect(card).toContain('const awaiting = balance == null && loggedIn')
  })

  it('🔴 숫자를 모를 땐 0 을 적지 않는다 (빈 자리로 높이만 잡는다)', () => {
    expect(card).toMatch(/awaiting \? <span[^>]*aria-hidden="true" \/> : formatNumber\(balance\)/)
  })
})

describe('🔌 배선 — 두 표면이 같은 부품을 쓴다', () => {
  it('🔴 모바일과 PC 가 같은 카드를 쓴다', () => {
    // 두 벌이면 한쪽만 고쳐지는 사고가 난다(며칠 전 딜 선택 UI 에서 실제로 PC 를 잊었다).
    expect((page.match(/<DealBalanceCard\b/g) ?? []).length).toBe(2)
    expect(page).toMatch(/<DealBalanceCard balance=\{dealBalance\} variant="compact"/)
  })

  it('🔴 잔액 카드 마크업이 페이지로 되돌아오지 않는다', () => {
    // 인라인으로 다시 그리면 두 벌 문제가 재발한다.
    expect(page).not.toMatch(/내 딜 잔액/)
  })

  it('목적지는 실재 라우트다', () => {
    const routes = ['src/App.tsx', 'src/routes/seller.routes.tsx']
      .map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const m of card.matchAll(/const (?:EARN_PATH|HISTORY_PATH)[^\n]*?'(\/[^']+)'/g)) {
      expect(routes).toContain(`path="${m[1]}"`)
    }
  })
})
