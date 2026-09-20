/**
 * 🪙 **결제 화면에서 딜을 조절한다** — 대표 확정 "C안" (2026-09-19)
 *
 * > *"나는 여기 페이지에서 딜 결제 내용 변경을 할 수 있으면 좋겠어 … 원래는 여기서 포인트 사용을
 * >  하듯이 원래 하잖아 다른 사이트들도."*
 *
 * ## 이 시험이 지키는 것
 * 이 변경은 **잠금 파일**(`TossWidgetPayPage.tsx`, Toss V2 감사)을 건드린다. 대표 승인 범위는
 * *"최소"* 였고, 그 최소가 실제로 최소인지는 사람 눈으로는 다음 세션에 흐려진다 ⇒ 기계가 고정한다:
 *
 *   ① 딜 손잡이의 **상한**은 서버가 준 값과 최소 카드액 중 빡빡한 쪽이다(전부-딜은 다른 흐름).
 *   ② **아무것도 안 만지면 종전과 같다** — 초기 청구액 === URL `amount`.
 *   ③ 잠긴 계약(`requestPayment`·`widgets()`·마운트 id·키 분기·상태 전이)은 **byte-불변**.
 *   ④ `setAmount` 는 초기화 1 + 딜 변경 1 = **정확히 2곳**. 초기화 쪽 줄은 글자 그대로 남는다.
 *   ⑤ `MIN_CARD_AMOUNT` 는 **한 곳**에서만 선언된다(서버가 재수출) — 두 벌이면 화면이 허용한
 *      금액을 서버가 거절하는 날이 온다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - 토스 SDK 의 실제 `setAmount` 동작(여기선 SDK 를 안 띄운다) → **staging 실결제 1회**가 판정.
 *   - 위젯이 렌더된 뒤의 시각적 배치.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import DealUseCard, { dealUseCap, clampDealUse } from '@/pages/pay/DealUseCard'
import { MIN_CARD_AMOUNT, readPaySummary, appendPaySummary } from '@/shared/pay-summary'

const PAGE = 'src/pages/TossWidgetPayPage.tsx'
const src = () => stripComments(readFileSync(PAGE, 'utf8'))

describe('① 딜 조절 상한', () => {
  it('카드로 최소 100원은 남긴다 (전부-딜은 다른 흐름)', () => {
    expect(dealUseCap(1000, 99999)).toBe(1000 - MIN_CARD_AMOUNT)
  })
  it('서버 상한이 더 빡빡하면 그쪽을 따른다', () => {
    expect(dealUseCap(10000, 3000)).toBe(3000)
  })
  it('총액이 최소 카드액 이하면 조절할 게 없다', () => {
    expect(dealUseCap(100, 5000)).toBe(0)
    expect(dealUseCap(50, 5000)).toBe(0)
  })
})

describe('② 입력 정규화', () => {
  it('숫자 아닌 글자는 버린다', () => {
    expect(clampDealUse('1a2b3', 99999)).toBe(123)
    expect(clampDealUse('', 500)).toBe(0)
    expect(clampDealUse('-500', 500)).toBe(500) // '-' 가 버려져 500 → 상한
  })
  it('상한을 넘지 않는다', () => {
    expect(clampDealUse(99999, 900)).toBe(900)
  })
})

describe('③ 카드 렌더 — 실제로 눌러 본다', () => {
  const setup = (over: Partial<Parameters<typeof DealUseCard>[0]> = {}) => {
    const calls: number[] = []
    const props = { goodsAmount: 1000, dealMax: 900, value: 900, onChange: (n: number) => calls.push(n), ...over }
    render(<DealUseCard {...props} />)
    return calls
  }

  it('쓸 딜이 없으면 카드 자체가 안 뜬다', () => {
    const { container } = render(<DealUseCard goodsAmount={1000} dealMax={0} value={0} onChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('상한을 화면에 말한다', () => {
    setup()
    expect(screen.getByText(/최대/)).toBeTruthy()
    expect(screen.getByText('900')).toBeTruthy()
  })

  it('전액이면 버튼이 해제로 바뀌고, 누르면 0 이 된다', () => {
    const calls = setup({ value: 900 })
    fireEvent.click(screen.getByRole('button', { name: '사용 안 함' }))
    expect(calls).toEqual([0])
  })

  it('전액 아니면 전액 사용 버튼이 상한을 준다', () => {
    const calls = setup({ value: 0 })
    fireEvent.click(screen.getByRole('button', { name: '전액 사용' }))
    expect(calls).toEqual([900])
  })

  it('타이핑한 값이 상한으로 잘린다', () => {
    const calls = setup({ value: 0 })
    fireEvent.change(screen.getByLabelText('사용할 딜'), { target: { value: '99999' } })
    expect(calls).toEqual([900])
  })

  it('위젯이 준비되기 전엔 못 바꾼다', () => {
    render(<DealUseCard goodsAmount={1000} dealMax={900} value={900} onChange={() => {}} disabled />)
    expect((screen.getByLabelText('사용할 딜') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('④ 잠긴 화면의 계약', () => {
  it('아무것도 안 만지면 초기 청구액은 URL amount 와 같다', () => {
    // goodsAmount = amount + dealUsed · chargeAmount = goodsAmount − dealUsed  ⇒  chargeAmount === amount
    const s = src()
    expect(s).toMatch(/const goodsAmount = amount \+ \(summary\.dealUsed \?\? 0\)/)
    expect(s).toMatch(/useState\(summary\.dealUsed \?\? 0\)/)
  })

  it('setAmount 는 정확히 2곳 — 초기화 + 딜 변경', () => {
    expect(src().match(/setAmount\(\{/g) || []).toHaveLength(2)
  })

  it('초기화의 setAmount 줄은 글자 그대로 남아 있다', () => {
    expect(src()).toContain(
      "await withTimeout(widgets.setAmount({ currency: 'KRW', value: Math.round(amount) }), 'SET_AMOUNT')",
    )
  })

  it('재호출은 ready 일 때만 돈다 (초기화 경로 무간섭)', () => {
    const s = src()
    const at = s.indexOf('lastSetAmountRef.current) return')
    expect(at).toBeGreaterThan(0)
    expect(s.slice(Math.max(0, at - 200), at)).toMatch(/state !== 'ready'/)
  })

  it('결제 요청·위젯 생성·마운트 자리는 byte-불변', () => {
    const s = src()
    expect(s.match(/requestPayment\(\{/g) || []).toHaveLength(1)
    expect(s.match(/sdk\.widgets\(\{/g) || []).toHaveLength(1)
    expect(s).toContain('id="toss-widget-pay-method"')
    expect(s).toContain('id="toss-widget-pay-agreement"')
    expect(s).toContain('safePaymentReturnPath')
  })

  it('딜 카드가 실제로 배선돼 있다 (import 만 남거나 죽은 렌더면 통과하면 안 된다)', () => {
    const s = src()
    expect(s).toMatch(/<DealUseCard\b/)
    // 🩸 처음엔 위 한 줄뿐이었고, 주입 러너가 `{false && <DealUseCard` 로 바꿔도 초록이 뜨는 걸 잡았다.
    //   "있다" 가 아니라 "살아서 그려진다" 를 봐야 한다 ⇒ 앞에 꺼짐 스위치가 없어야 하고,
    //   실제 props 가 붙어 있어야 한다(껍데기만 남는 경우 차단).
    const at = s.indexOf('<DealUseCard')
    expect(s.slice(Math.max(0, at - 80), at)).not.toMatch(/false\s*&&|\?\s*null\s*:/)
    const block = s.slice(at, at + 400)
    expect(block).toMatch(/goodsAmount=\{goodsAmount\}/)
    expect(block).toMatch(/value=\{dealUsed\}/)
    expect(block).toMatch(/onChange=\{setDealUsed\}/)
  })
})

describe('⑤ 최소 카드액은 한 곳에서만 선언된다', () => {
  it('서버는 shared 를 재수출한다', () => {
    const server = stripComments(readFileSync('src/features/group-buy/api/partial-deal.ts', 'utf8'))
    expect(server).toMatch(/export \{ MIN_CARD_AMOUNT \} from '\.\.\/\.\.\/\.\.\/shared\/pay-summary'/)
    expect(server).not.toMatch(/export const MIN_CARD_AMOUNT\s*=/)
  })
})

describe('⑥ dealMax 는 서버 값이 쿼리로 실려 온다', () => {
  it('왕복한다', () => {
    const p = appendPaySummary(new URLSearchParams(), { dealUsed: 900, dealMax: 900 })
    expect(readPaySummary((k) => p.get(k)).dealMax).toBe(900)
  })
  it('이용권 상세가 deal-plan 의 max_deal_usable 을 싣는다', () => {
    const detail = stripComments(readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf8'))
    expect(detail).toMatch(/dealMax:\s*Number\(dealPlan\?\.max_deal_usable\)/)
  })
})
