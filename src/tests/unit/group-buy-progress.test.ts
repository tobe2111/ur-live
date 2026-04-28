/**
 * 공동구매 진행률 + 달성 판정 — 순수 로직 테스트
 *
 * 식사권 (meal_voucher) 공구의 진행률 계산과 달성 판정 시뮬레이션.
 * src/pages/RestaurantMapPage.tsx, MainHomePage.tsx 등에서 같은 로직 사용.
 *
 * 가드:
 *   1. progress = current / target (0~100% clamp)
 *   2. achieved = current >= target && target > 0
 *   3. discount calc = (1 - price/original) * 100 (반올림)
 *   4. 마감 시간 도달 시 자동 expired
 */
import { describe, it, expect } from 'vitest';

interface GroupBuy {
  current: number;
  target: number;
  deadline_ts?: number; // ms
  price: number;
  original_price: number;
}

function calcProgress(g: GroupBuy): {
  percent: number;
  achieved: boolean;
  expired: boolean;
  discount_percent: number;
  remaining: number;
} {
  const percent = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  const achieved = g.current >= g.target && g.target > 0;
  const expired = g.deadline_ts !== undefined && Date.now() > g.deadline_ts;
  const discount_percent = g.original_price > g.price
    ? Math.round((1 - g.price / g.original_price) * 100)
    : 0;
  const remaining = Math.max(0, g.target - g.current);
  return { percent, achieved, expired, discount_percent, remaining };
}

describe('공동구매 — 진행률', () => {
  it('현재 0 / 목표 20 → 0%', () => {
    const r = calcProgress({ current: 0, target: 20, price: 5000, original_price: 5000 });
    expect(r.percent).toBe(0);
    expect(r.achieved).toBe(false);
    expect(r.remaining).toBe(20);
  });

  it('현재 10 / 목표 20 → 50%', () => {
    const r = calcProgress({ current: 10, target: 20, price: 5000, original_price: 5000 });
    expect(r.percent).toBe(50);
    expect(r.achieved).toBe(false);
    expect(r.remaining).toBe(10);
  });

  it('현재 20 / 목표 20 → 100% achieved', () => {
    const r = calcProgress({ current: 20, target: 20, price: 5000, original_price: 5000 });
    expect(r.percent).toBe(100);
    expect(r.achieved).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('초과 달성 (현재 50 / 목표 20) → 100% (clamp)', () => {
    const r = calcProgress({ current: 50, target: 20, price: 5000, original_price: 5000 });
    expect(r.percent).toBe(100);
    expect(r.achieved).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('목표 0 → percent 0, achieved false (zero divide 보호)', () => {
    const r = calcProgress({ current: 5, target: 0, price: 5000, original_price: 5000 });
    expect(r.percent).toBe(0);
    expect(r.achieved).toBe(false);
  });
});

describe('공동구매 — 할인율', () => {
  it('5000원 → 5000원 (할인 없음) → 0%', () => {
    const r = calcProgress({ current: 0, target: 10, price: 5000, original_price: 5000 });
    expect(r.discount_percent).toBe(0);
  });

  it('15000원 → 10000원 (33% 할인)', () => {
    const r = calcProgress({ current: 0, target: 10, price: 10000, original_price: 15000 });
    expect(r.discount_percent).toBe(33);
  });

  it('20000원 → 10000원 (50% 할인)', () => {
    const r = calcProgress({ current: 0, target: 10, price: 10000, original_price: 20000 });
    expect(r.discount_percent).toBe(50);
  });

  it('정가 0 → 할인 0% (zero divide 보호)', () => {
    const r = calcProgress({ current: 0, target: 10, price: 5000, original_price: 0 });
    expect(r.discount_percent).toBe(0);
  });

  it('가격 정가보다 높음 → 할인 0% (역할인 방지)', () => {
    const r = calcProgress({ current: 0, target: 10, price: 12000, original_price: 10000 });
    expect(r.discount_percent).toBe(0);
  });
});

describe('공동구매 — 마감 시간', () => {
  it('마감 시간 미설정 → expired false', () => {
    const r = calcProgress({ current: 5, target: 10, price: 5000, original_price: 5000 });
    expect(r.expired).toBe(false);
  });

  it('마감 시간 미래 → expired false', () => {
    const future = Date.now() + 60 * 60 * 1000; // 1시간 후
    const r = calcProgress({ current: 5, target: 10, price: 5000, original_price: 5000, deadline_ts: future });
    expect(r.expired).toBe(false);
  });

  it('마감 시간 과거 → expired true', () => {
    const past = Date.now() - 60 * 60 * 1000;
    const r = calcProgress({ current: 5, target: 10, price: 5000, original_price: 5000, deadline_ts: past });
    expect(r.expired).toBe(true);
  });

  it('마감 + achieved 동시 → 두 플래그 모두 true', () => {
    const past = Date.now() - 1000;
    const r = calcProgress({ current: 20, target: 20, price: 5000, original_price: 5000, deadline_ts: past });
    expect(r.expired).toBe(true);
    expect(r.achieved).toBe(true);
  });
});

// 알림톡 phone 정규화 — restaurant-suggestions/api 와 동일 로직
function normalizePhone(input: string): string | null {
  const clean = input.replace(/[^0-9]/g, '');
  if (!/^01\d{8,9}$/.test(clean)) return null;
  return clean;
}

describe('Phone 정규화 — Magic Link 알림톡 / 수요 신호', () => {
  it('010-1234-5678 → 01012345678', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
  });

  it('01012345678 (이미 깨끗) → 그대로', () => {
    expect(normalizePhone('01012345678')).toBe('01012345678');
  });

  it('010 1234 5678 (공백) → 01012345678', () => {
    expect(normalizePhone('010 1234 5678')).toBe('01012345678');
  });

  it('011-987-6543 (구 PCS 번호) → 통과 (regex 가 01[0-9]+8~9 허용)', () => {
    // 현 정규식 ^01\d{8,9}$ 는 011/016/017/018/019 모두 허용
    expect(normalizePhone('011-987-6543')).toBe('0119876543');
  });

  it('빈 문자열 → null', () => {
    expect(normalizePhone('')).toBe(null);
  });

  it('너무 짧음 (010-1234) → null', () => {
    expect(normalizePhone('010-1234')).toBe(null);
  });

  it('너무 길음 (10자리 + 추가) → null', () => {
    expect(normalizePhone('010-1234-5678-9')).toBe(null);
  });

  it('영문 포함 → null (숫자 외 제거 후 검증)', () => {
    expect(normalizePhone('010abc1234')).toBe(null);
  });
});
