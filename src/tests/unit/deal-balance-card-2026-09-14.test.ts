/**
 * 🪙 **딜 잔액 카드 — 대표 확정을 고정한다** (2026-09-14 A3 → **2026-09-30 안 B "납작 카드"**)
 *
 * 🔁 **2026-09-30 재조준.** 대표 *"내 딜 잔액 부분이 너무 크달까?"* → 시안 넷 중 **B**(한 줄에
 *   금액 + 행동 둘, 실측 70px). 대체된 것은 **크기와 배치**뿐이고, A3 가 지키던 이유 넷
 *   (채운 버튼 0 · 고아 링크 0 · "1딜=1원" 없음 · 0 이면 큰 카드 안 씀)은 **그대로 살아 있다.**
 *
 * ⚠️ 시험을 **지우지 않고 재조준**한 이유: 저 넷은 전부 *에러 없이 조용히 되돌아갈 수 있는* 것들이고,
 *   실제로 한 번씩 되돌아간 적이 있다. 배치가 바뀌었다고 이유까지 버리면 다음 세션이 다시 밟는다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 실제로 예뻐 보이는지는 못 잰다(그건 대표가 본다). 픽셀 높이도 못 잰다(jsdom 은 레이아웃이 없다 —
 * 70px 은 브라우저 실측값이고 여기서는 *치수를 정하는 클래스*만 대조한다).
 * 색 대비는 `check-dark-contrast`, 테마 누락은 `check-theme-consistency` 가 따로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'

const card = stripComments(readFileSync('src/pages/vouchers/DealBalanceCard.tsx', 'utf8'))
const page = stripComments(readFileSync('src/pages/VouchersPage.tsx', 'utf8'))

describe('🪙 확정 구조 (안 A3)', () => {
  it('숫자는 28px — 안 B 의 치수 — 대표 확정 B + main #1568 타입 스케일(28/24/17/15/13/12)', () => {
    expect(card).toMatch(/text-\[28px\]/)
    expect(card).toMatch(/text-\[17px\]/)
    /* 🔴 종전 두 층 카드로 되돌아가면 빨간불 — 그게 152px 짜리였다.
       🔧 머지 재조준: main #1579 의 디스플레이 스케일 이행으로 그 값이 **42 → 40**. 42 는 이제
          코드 어디에도 없어(스케일 밖), 그대로 두면 이 단언이 아무것도 안 지킨다. */
    expect(card).not.toMatch(/text-\[40px\]/)
  })

  // 행동 둘을 가르는 실제 코드 경계(B 는 **세로** 선 하나뿐 — 가로 rule 은 없다).
  // ⚠️ **주석 문구를 앵커로 쓰지 말 것** — 2026-09-14 에 `card.indexOf('아래층')`(주석에만 있던
  //    낱말)을 썼다가, 같은 날 main 이 주석 제거기를 고치자 -1 이 되어 슬라이스가 카드 전체로 번졌다.
  const DIVIDER = 'w-px h-3 bg-rule'
  const dividerAt = card.indexOf(DIVIDER)

  it('경계 앵커가 실재한다 — 없으면 아래 시험이 헛돈다', () => {
    expect(dividerAt).toBeGreaterThan(-1)
  })

  it('🔴 행동은 정확히 둘 — 딜 모으기 · 이용내역', () => {
    // ⚠️ 끝 앵커는 `'\n  return ('` — 2칸짜리 `'  return ('` 는 위 조기반환의 `    return (`
    //    **안에도 매치**돼서 slice 가 뒤집혀 빈 문자열이 된다(실제로 한 번 그랬다).
    const acts = card.slice(card.indexOf('const actions = ('), card.indexOf('\n  return ('))
    expect(acts).toMatch(/딜 모으기/)
    expect(acts).toMatch(/이용내역/)
    expect((acts.match(/<button/g) ?? []).length).toBe(2)
    expect(acts).toContain(DIVIDER)      // 둘을 가르는 세로 선
  })

  it('🔴 금액 옆에 버튼을 두지 않는다 — 금액 블록은 글자뿐', () => {
    // 왼쪽 블록(라벨~note)에 버튼이 끼면 A3 가 걷어낸 "가장 센 버튼이 내역" 문제가 되돌아온다.
    const left = card.slice(card.indexOf('내 딜 잔액'), card.indexOf('{!compact && actions}'))
    expect(left).not.toMatch(/<button/)
  })

  it('🔴 좁은 레일에서는 행동이 아래로 내려간다 — 7자리 잔액이 넘치지 않게', () => {
    // compact 폭은 248px. 28px 숫자 + 행동 둘을 한 줄에 넣으면 999,999 에서 넘친다(실측 248 > 216).
    expect(card).toContain("compact ? 'flex items-center gap-3 mt-2'")
    expect(card).toContain('{compact && actions}')
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
    // 🔴 표식은 **지금 살아 있는 큰 숫자**여야 한다(안 B 는 28px). 42/40 을 그대로 두면 그 값이
    //   코드 어디에도 없어 이 단언이 늘 통과한다 — 머지에서 실제로 그렇게 될 뻔했다.
    expect(zero).not.toMatch(/text-\[28px\]/)
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
