/**
 * 🛒 **상품 상세 구매 블록 — 시안 A-2 픽업 벌** 〔2026-08-02〕
 *
 * 이 화면은 유어딜 **본진 쇼핑 전체**가 쓴다. 몰 파일럿 시안을 얹으면서 가장 큰 위험은
 * "몰을 고치려다 본진이 바뀌는 것"이었다 — 그래서 이 파일의 절반이 **본진 무영향**을 지킨다.
 *
 * ## 이 테스트가 실제로 막는 것
 * - R1 없는 픽업일을 **지어내지 않는다** (요약 줄이 이 화면의 마지막 약속이다)
 * - R2 픽업 바가 시안대로 그려지고 핸들러가 붙어 있다
 * - R3 🔴 **`default` 는 안 바뀐다** — 라벨이 `바로 구매`(공백 있음) 그대로
 * - R4 옵션 품절은 못 고른다 / 옵션이 없으면 "고르라는 지시"처럼 보이지 않는다
 * - R5 🔴 **`rose-*` 금지** — `tailwind.config.js` 가 `rose: MONO` 로 리맵해 화면엔 **네이비**가
 *   나온다. 2026-08-02 에 마감 배지가 실제로 그렇게 나갔고 정적 검사는 전부 초록이었다.
 *
 * ⚠️ **못 막는 것**: 실제 색·간격(계산된 스타일). 그건 `scripts/smoke-mall-render.mjs` 가 잰다.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import { FloatingActionBar } from '@/components/product/floating-action-bar'
import PurchasePicker from '@/pages/product-detail/PurchasePicker'
import { pickupSummaryLine } from '@/pages/product-detail/ReceiveMethodNotice'

describe('🔴 R1 — 요약 줄은 없는 날짜를 지어내지 않는다', () => {
  it('픽업일이 있으면 "N개 · M월 D일 픽업"', () => {
    // D1 타임스탬프는 `Z` 없는 UTC 문자열이다. 로컬로 오해석하면 하루가 밀린다(반복 사고 클래스).
    expect(pickupSummaryLine(2, '2026-08-10')).toBe('2개 · 8월 10일 픽업')
    expect(pickupSummaryLine(1, '2026-08-10 00:00:00')).toBe('1개 · 8월 10일 픽업')
  })

  it('픽업일이 없으면 **수량만** — 날짜 자리를 비운다', () => {
    for (const empty of [null, undefined, '']) {
      expect(pickupSummaryLine(3, empty)).toBe('3개')
    }
  })

  it('파싱 불가 문자열도 날짜를 만들지 않는다', () => {
    expect(pickupSummaryLine(1, 'not-a-date')).toBe('1개')
  })
})

describe('🔴 R2 — 픽업 하단 바', () => {
  const base = { onAddToCart: () => {}, onBuyNow: () => {} }

  it('요약 줄 + 합계 + 두 버튼', () => {
    const { getByText } = render(
      <FloatingActionBar {...base} variant="pickup" summaryLeft="2개 · 8월 10일 픽업" summaryTotal={14000} />,
    )
    expect(getByText('2개 · 8월 10일 픽업')).toBeTruthy()
    expect(getByText('14,000원')).toBeTruthy()
    expect(getByText('장바구니')).toBeTruthy()
    expect(getByText('바로구매')).toBeTruthy()
  })

  it('클릭 → 핸들러', () => {
    const onBuyNow = vi.fn(); const onAddToCart = vi.fn()
    const { getByText } = render(
      <FloatingActionBar {...base} variant="pickup" onBuyNow={onBuyNow} onAddToCart={onAddToCart} summaryLeft="1개" summaryTotal={7000} />,
    )
    fireEvent.click(getByText('바로구매'))
    fireEvent.click(getByText('장바구니'))
    expect(onBuyNow).toHaveBeenCalledTimes(1)
    expect(onAddToCart).toHaveBeenCalledTimes(1)
  })

  it('품절이면 두 버튼 다 비활성', () => {
    const onBuyNow = vi.fn()
    const { getAllByText } = render(
      <FloatingActionBar {...base} variant="pickup" onBuyNow={onBuyNow} disabled summaryLeft="1개" summaryTotal={7000} />,
    )
    const btns = getAllByText('품절').map((el) => el.closest('button')!)
    expect(btns.length).toBe(2)
    for (const b of btns) expect(b.disabled).toBe(true)
    fireEvent.click(btns[1])
    expect(onBuyNow).not.toHaveBeenCalled()
  })

  it('찜 핸들러를 안 넘기면 하트가 아예 없다', () => {
    const { queryByLabelText } = render(<FloatingActionBar {...base} variant="pickup" summaryLeft="1개" summaryTotal={7000} />)
    expect(queryByLabelText('찜')).toBeNull()
  })
})

describe('🔴 R3 — 본진(default) 은 안 바뀐다', () => {
  const base = { onAddToCart: () => {}, onBuyNow: () => {} }

  it('바 라벨이 `바로 구매`(공백 있음) 그대로', () => {
    const { getByText, queryByText } = render(<FloatingActionBar {...base} variant="default" />)
    expect(getByText('바로 구매')).toBeTruthy()
    expect(queryByText('바로구매')).toBeNull()
  })

  it('variant 를 안 넘긴 기존 호출부도 default 로 동작', () => {
    const { getByText } = render(<FloatingActionBar {...base} />)
    expect(getByText('바로 구매')).toBeTruthy()
  })

  it('구매 블록도 기존 마크업 — 옵션 미선택 안내가 그대로', () => {
    const { container } = render(
      <PurchasePicker options={[]} onSelectOption={() => {}} quantity={1} onQuantity={() => {}}
        maxQuantity={9} displayPrice={10000} variant="default" />,
    )
    // 시안 벌에서만 나오는 문구가 본진에 새면 안 된다.
    expect(container.textContent).not.toContain('선택할 옵션이 없는 상품이에요')
  })
})

describe('🔴 R4 — 옵션 / 수량 (픽업 벌)', () => {
  const opts = [
    { id: 1, option_value: '사과잼 2병', price_adjustment: 0, stock: 5 },
    { id: 2, option_value: '유자청 2병', price_adjustment: 1500, stock: 0 },
  ]

  it('품절 옵션은 누를 수 없다', () => {
    const onSelectOption = vi.fn()
    const { getByText } = render(
      <PurchasePicker options={opts} onSelectOption={onSelectOption} quantity={1} onQuantity={() => {}}
        maxQuantity={5} displayPrice={7000} variant="pickup" />,
    )
    const soldOut = getByText('유자청 2병').closest('button')!
    expect(soldOut.disabled).toBe(true)
    fireEvent.click(soldOut)
    expect(onSelectOption).not.toHaveBeenCalled()

    fireEvent.click(getByText('사과잼 2병').closest('button')!)
    expect(onSelectOption).toHaveBeenCalledWith(1)
  })

  it('옵션이 없으면 **고르라는 지시**가 아니라 사실을 말한다', () => {
    const { getByText, queryByText } = render(
      <PurchasePicker options={[]} onSelectOption={() => {}} quantity={1} onQuantity={() => {}}
        maxQuantity={9} displayPrice={7000} variant="pickup" />,
    )
    expect(getByText('선택할 옵션이 없는 상품이에요')).toBeTruthy()
    expect(queryByText('옵션을 선택해주세요')).toBeNull()
  })

  it('수량은 1 아래로 안 내려가고 재고 위로 안 올라간다', () => {
    const onQuantity = vi.fn()
    const { getByLabelText, rerender } = render(
      <PurchasePicker options={[]} onSelectOption={() => {}} quantity={1} onQuantity={onQuantity}
        maxQuantity={2} displayPrice={7000} variant="pickup" />,
    )
    expect(getByLabelText('수량 감소').closest('button')!.disabled).toBe(true)
    fireEvent.click(getByLabelText('수량 증가'))
    expect(onQuantity).toHaveBeenLastCalledWith(2)

    rerender(
      <PurchasePicker options={[]} onSelectOption={() => {}} quantity={2} onQuantity={onQuantity}
        maxQuantity={2} displayPrice={7000} variant="pickup" />,
    )
    fireEvent.click(getByLabelText('수량 증가'))
    expect(onQuantity).toHaveBeenLastCalledWith(2) // 재고 상한에서 멈춘다
  })
})

describe('🔴 R5 — `rose-*` 를 쓰지 않는다 (tailwind 리맵 함정)', () => {
  // `tailwind.config.js` 가 `rose: MONO` 로 브랜드 색조를 잉크에 리맵한다 — `bg-rose-600` 이라
  // 써 두면 화면엔 **네이비**가 나온다. 2026-08-02 에 마감 배지가 실제로 그렇게 나갔다.
  // 살아남는 기능색은 `red` 하나뿐(그 파일 주석: "유일 예외 = red").
  for (const f of [
    'src/pages/product-detail/PurchasePicker.tsx',
    'src/components/product/floating-action-bar.tsx',
  ]) {
    it(`${f} 에 rose-* 없음`, () => {
      // ⚠️ 주석은 지우고 본다 — 설명 문장에 남은 이름 때문에 초록이 뜨는 클래스(source-text 헤더 참조).
      expect(readCode(f)).not.toMatch(/\b(?:bg|text|border|from|to|via)-rose-/)
    })
  }
})
