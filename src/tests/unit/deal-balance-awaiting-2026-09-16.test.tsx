/**
 * 🧮 잔액이 늦게 와서 목록 전체가 한 번 밀리던 것 〔2026-09-16〕
 *
 * 대표: *"남은 후속들 모두 진행 끝까지"* — `/vouchers` per-user chrome.
 *
 * ## 무엇이었나
 * 잔액은 마운트 뒤 `/api/points/balance` 로 온다. 그래서 첫 커밋은 **누구든 `null`** 이고
 * `DealBalanceCard` 는 그걸 44px 한 줄 바로 그렸다. 응답이 오면 170px 카드로 바뀌며
 * **그 아래 이용권 목록 전체가 한 번 내려갔다.** 딜을 가진 사람일수록 매번 겪는다.
 *
 * ## 처방 — 로그인 여부는 동기로 안다
 * `getUserIdSync()` 는 렌더 중에 답한다. 로그인이면 숫자만 비운 **같은 카드**를 먼저 그리고,
 * 비로그인이면 종전 한 줄 바. 어느 쪽도 나중에 모양이 안 바뀐다.
 *
 * ## 이 시험이 **못** 하는 것
 * jsdom 은 레이아웃이 없어 **픽셀 높이를 못 잰다.** 그래서 "같은 구조인가"로 대신 본다 —
 * 같은 래퍼 클래스 · 같은 두 층 · 같은 두 버튼. 실제 밀림 여부는 브라우저 프레임 캡처가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DealBalanceCard from '@/pages/vouchers/DealBalanceCard'

const draw = (props: Parameters<typeof DealBalanceCard>[0]) =>
  render(<MemoryRouter><DealBalanceCard {...props} /></MemoryRouter>).container

describe('① 로그인한 사람은 숫자가 오기 전에도 같은 카드를 본다', () => {
  it('🔴 기다리는 카드와 도착한 카드의 **구조가 같다** (다르면 그만큼 밀린다)', () => {
    const waiting = draw({ balance: null, loggedIn: true })
    const loaded = draw({ balance: 11200, loggedIn: true })
    const shape = (el: HTMLElement) => ({
      wrap: el.firstElementChild?.className,
      layers: el.querySelectorAll('div').length,
      buttons: [...el.querySelectorAll('button')].map((b) => b.textContent),
    })
    expect(shape(waiting)).toEqual(shape(loaded))
  })

  it('🔴 기다리는 동안 0 을 적지 않는다 (모르는 것과 0 은 다르다)', () => {
    const waiting = draw({ balance: null, loggedIn: true })
    expect(waiting.textContent).toContain('내 딜 잔액')
    expect(waiting.textContent).not.toContain('0')
    expect(waiting.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('숫자가 도착하면 그대로 채워진다', () => {
    const loaded = draw({ balance: 11200, loggedIn: true })
    expect(loaded.textContent).toContain('11,200')
    expect(loaded.querySelector('[aria-busy="true"]')).toBeFalsy()
  })
})

describe('② 비로그인은 종전대로 — "당신은 0" 상자로 시작하지 않는다', () => {
  it('🔴 로그인 아니면 아직 모를 때도 한 줄 바다 (2026-09-01 에 고친 실수를 되살리지 않는다)', () => {
    const el = draw({ balance: null })
    expect(el.textContent).toContain('딜을 모으면 더 싸게 살 수 있어요')
    expect(el.textContent).not.toContain('내 딜 잔액')
  })

  it('잔액 0 도 한 줄 바다', () => {
    const el = draw({ balance: 0, loggedIn: true })
    expect(el.textContent).toContain('딜을 모으면 더 싸게 살 수 있어요')
  })
})

describe('③ 배선 — 페이지가 로그인 여부를 넘기고, 실패하면 빠져나온다', () => {
  it('🔴 두 호출부 모두 `loggedIn` 을 넘긴다 (안 넘기면 처방이 통째로 죽는다)', async () => {
    const src = (await import('node:fs')).readFileSync('src/pages/VouchersPage.tsx', 'utf8')
    const calls = src.match(/<DealBalanceCard\b[^>]*>/g) ?? []
    expect(calls.length).toBe(2)
    for (const c of calls) expect(c).toContain('loggedIn=')
  })

  it('🔴 조회가 실패하면 기다림에서 빠져나온다 (안 그러면 빈 카드가 영원히 남는다)', async () => {
    const src = (await import('node:fs')).readFileSync('src/pages/VouchersPage.tsx', 'utf8')
    // 2026-06-26 규칙("읽은 값은 0 으로 안 덮는다")은 그대로 두고, **한 번도 못 읽은 경우에만** 0 으로
    // 떨어뜨린다 → 종전 실패 동작(한 줄 바)으로 돌아가고 빈 카드가 남지 않는다.
    expect(src).toContain('setDealBalance(b => b ?? 0)')
  })
})
