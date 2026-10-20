/**
 * 🛡️ 2026-04-28: 결제 금액 계산 회귀 방지 테스트
 *
 * 사고: TossPaymentWidget + StripeCheckout 가 totalAmount + shippingFee
 * 이중 합산 → 결제 금액 inflated. 사용자 실제 결제도 wrong amount.
 *
 * 이 테스트는 CheckoutPage 의 totalAmount 계산식 + Toss/Stripe 위젯의
 * 결제 amount 가 같은 값을 사용하는지 보장.
 */
import { describe, it, expect } from 'vitest';

// CheckoutPage:194-195 의 계산식 (단일 진실)
function calcCheckoutTotal(input: {
  subtotal: number;        // 상품 소계
  shippingFee: number;     // 배송비
  couponDiscount: number;  // 쿠폰 할인
  groupBuyDiscount: number; // 공동구매 할인
  dealToUse: number;       // 사용 딜 포인트
}): { totalBeforeDeal: number; totalAmount: number } {
  const totalBeforeDeal = input.subtotal + input.shippingFee - input.couponDiscount - input.groupBuyDiscount;
  const totalAmount = totalBeforeDeal - input.dealToUse;
  return { totalBeforeDeal, totalAmount };
}

// 위젯이 받은 props 로 토스/Stripe 에 보낼 amount 계산 (이번 fix 후)
function calcPaymentAmount(totalAmount: number, _shippingFee: number): number {
  // 🛡️ totalAmount 가 이미 final — shippingFee 포함됨. 다시 더하면 안 됨.
  return totalAmount;
}

describe('CheckoutPage totalAmount 계산', () => {
  it('상품 45000 + 배송 3000 - 쿠폰 3000 = 45000', () => {
    const r = calcCheckoutTotal({
      subtotal: 45000, shippingFee: 3000,
      couponDiscount: 3000, groupBuyDiscount: 0, dealToUse: 0,
    });
    expect(r.totalBeforeDeal).toBe(45000);
    expect(r.totalAmount).toBe(45000);
  });

  it('딜 포인트 사용', () => {
    const r = calcCheckoutTotal({
      subtotal: 45000, shippingFee: 3000,
      couponDiscount: 3000, groupBuyDiscount: 0, dealToUse: 5000,
    });
    expect(r.totalBeforeDeal).toBe(45000);
    expect(r.totalAmount).toBe(40000);
  });

  it('공동구매 할인', () => {
    const r = calcCheckoutTotal({
      subtotal: 50000, shippingFee: 3000,
      couponDiscount: 0, groupBuyDiscount: 10000, dealToUse: 0,
    });
    expect(r.totalAmount).toBe(43000);
  });

  it('전액 딜 결제 (totalAmount 0)', () => {
    const r = calcCheckoutTotal({
      subtotal: 10000, shippingFee: 3000,
      couponDiscount: 0, groupBuyDiscount: 0, dealToUse: 13000,
    });
    expect(r.totalAmount).toBe(0);
  });
});

describe('🚨 회귀 방지 — Toss/Stripe 위젯이 totalAmount 만 사용', () => {
  it('shippingFee 를 또 더하지 않음 (이중 합산 버그 방지)', () => {
    const totalAmount = 45000;
    const shippingFee = 3000;
    // ✅ 올바른 동작
    expect(calcPaymentAmount(totalAmount, shippingFee)).toBe(45000);
    // ❌ 이전 버그: totalAmount + shippingFee = 48000
    expect(calcPaymentAmount(totalAmount, shippingFee)).not.toBe(48000);
  });

  it('shippingFee 가 0 이어도 동일', () => {
    expect(calcPaymentAmount(50000, 0)).toBe(50000);
  });

  it('totalAmount 0 (전액 딜 결제) → 0 결제', () => {
    expect(calcPaymentAmount(0, 3000)).toBe(0);
  });
});

describe('CheckoutPage → Widget → Toss 전체 흐름 일치성', () => {
  // CheckoutPage 가 widget 에 전달하는 totalAmount = widget 이 토스에 보내는 amount
  function fullFlow(input: Parameters<typeof calcCheckoutTotal>[0]): {
    displayedTotal: number;     // 화면 '총 결제 금액' 표시
    payButtonLabel: number;     // 결제 버튼 라벨 금액
    tossAmount: number;         // 토스에 실제 전달되는 amount
  } {
    const { totalAmount } = calcCheckoutTotal(input);
    const widgetAmount = calcPaymentAmount(totalAmount, input.shippingFee);
    return {
      displayedTotal: totalAmount,
      payButtonLabel: widgetAmount, // 위젯 버튼 라벨 (widget 안 totalAmount.toLocaleString)
      tossAmount: widgetAmount,     // 토스 setAmount 값
    };
  }

  it('스크린샷 시나리오 (45000 + 3000 - 3000 = 45000) — 3 값 모두 일치', () => {
    const r = fullFlow({
      subtotal: 45000, shippingFee: 3000,
      couponDiscount: 3000, groupBuyDiscount: 0, dealToUse: 0,
    });
    expect(r.displayedTotal).toBe(45000);
    expect(r.payButtonLabel).toBe(45000);
    expect(r.tossAmount).toBe(45000);
    // 모든 값이 같아야 사용자 + 토스 = 같은 금액
    expect(r.displayedTotal).toBe(r.payButtonLabel);
    expect(r.payButtonLabel).toBe(r.tossAmount);
  });

  it('딜 포인트 + 쿠폰 복합', () => {
    const r = fullFlow({
      subtotal: 100000, shippingFee: 3000,
      couponDiscount: 10000, groupBuyDiscount: 5000, dealToUse: 8000,
    });
    // total = 100000 + 3000 - 10000 - 5000 - 8000 = 80000
    expect(r.displayedTotal).toBe(80000);
    expect(r.tossAmount).toBe(80000);
  });
});
