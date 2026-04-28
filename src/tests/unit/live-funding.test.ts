/**
 * 🛡️ 2026-04-28: 라이브 펀딩 — 순수 로직 테스트
 *
 * 가드:
 *   1. 진행률 0~100% clamp
 *   2. achieved = current >= target
 *   3. expired 시 succeeded/failed 자동 추천
 *   4. 상태 머신 DAG (draft → ... → delivered)
 *   5. 자동 환불은 failed/cancelled + paid 만
 */
import { describe, it, expect } from 'vitest';
import {
  calcFundingProgress,
  canTransitionFunding,
  shouldAutoRefundBacker,
  canClaimReward,
  type FundingStatus,
} from '@/lib/live-funding';

const FUTURE = Date.now() + 7 * 24 * 60 * 60 * 1000;
const PAST = Date.now() - 1000;

describe('calcFundingProgress', () => {
  it('현재 0 / 목표 1억 → 0%, recommended live', () => {
    const r = calcFundingProgress(0, 100_000_000, FUTURE);
    expect(r.percent).toBe(0);
    expect(r.achieved).toBe(false);
    expect(r.remaining).toBe(100_000_000);
    expect(r.expired).toBe(false);
    expect(r.status_recommended).toBe('live');
  });

  it('5천 / 1억 = 0% (반올림 floor 가까움)', () => {
    const r = calcFundingProgress(5000, 100_000_000, FUTURE);
    expect(r.percent).toBe(0); // 0.005% → round 0
  });

  it('50% 달성', () => {
    const r = calcFundingProgress(50, 100, FUTURE);
    expect(r.percent).toBe(50);
    expect(r.remaining).toBe(50);
  });

  it('100% 달성 + 미마감 → 추천 live (마감되어야 succeeded)', () => {
    const r = calcFundingProgress(100, 100, FUTURE);
    expect(r.achieved).toBe(true);
    expect(r.status_recommended).toBe('live');
  });

  it('100% 달성 + 마감 → succeeded', () => {
    const r = calcFundingProgress(100, 100, PAST);
    expect(r.achieved).toBe(true);
    expect(r.expired).toBe(true);
    expect(r.status_recommended).toBe('succeeded');
  });

  it('80% + 마감 → failed', () => {
    const r = calcFundingProgress(80, 100, PAST);
    expect(r.achieved).toBe(false);
    expect(r.expired).toBe(true);
    expect(r.status_recommended).toBe('failed');
  });

  it('초과 달성 → 100% clamp', () => {
    const r = calcFundingProgress(500, 100, FUTURE);
    expect(r.percent).toBe(100);
    expect(r.remaining).toBe(0);
  });

  it('목표 0 → 0% (zero divide 보호)', () => {
    const r = calcFundingProgress(50, 0, FUTURE);
    expect(r.percent).toBe(0);
    expect(r.achieved).toBe(false);
  });
});

describe('canTransitionFunding — 상태 머신', () => {
  const cases: Array<[FundingStatus, FundingStatus, boolean]> = [
    ['draft', 'preparing', true],
    ['draft', 'cancelled', true],
    ['draft', 'live', false],     // preparing 거치지 않고 바로 live 불가
    ['preparing', 'live', true],
    ['live', 'succeeded', true],
    ['live', 'failed', true],
    ['live', 'cancelled', true],
    ['live', 'producing', false], // succeeded 거치지 않고 바로 producing 불가
    ['succeeded', 'producing', true],
    ['succeeded', 'cancelled', true],
    ['producing', 'shipping', true],
    ['shipping', 'delivered', true],
    ['failed', 'producing', false],   // terminal
    ['cancelled', 'live', false],     // terminal
    ['delivered', 'shipping', false], // terminal
  ];
  for (const [from, to, expected] of cases) {
    it(`${from} → ${to} = ${expected}`, () => {
      expect(canTransitionFunding(from, to)).toBe(expected);
    });
  }
});

describe('shouldAutoRefundBacker', () => {
  it('failed + paid → true (환불 대상)', () => {
    expect(shouldAutoRefundBacker('failed', 'paid')).toBe(true);
  });
  it('cancelled + paid → true', () => {
    expect(shouldAutoRefundBacker('cancelled', 'paid')).toBe(true);
  });
  it('failed + refunded → false (이미 환불됨)', () => {
    expect(shouldAutoRefundBacker('failed', 'refunded')).toBe(false);
  });
  it('failed + shipped → false (이미 발송, 별도 환불 흐름)', () => {
    expect(shouldAutoRefundBacker('failed', 'shipped')).toBe(false);
  });
  it('succeeded + paid → false (정상 진행)', () => {
    expect(shouldAutoRefundBacker('succeeded', 'paid')).toBe(false);
  });
  it('live + paid → false (마감 전 자동 환불 안 함)', () => {
    expect(shouldAutoRefundBacker('live', 'paid')).toBe(false);
  });
});

describe('canClaimReward — 한정 수량 검증', () => {
  it('stock null → 무제한 통과', () => {
    expect(canClaimReward(null, 1000)).toBe(true);
  });
  it('stock 100 / claimed 99 → 가능', () => {
    expect(canClaimReward(100, 99)).toBe(true);
  });
  it('stock 100 / claimed 100 → 불가 (정확히 매진)', () => {
    expect(canClaimReward(100, 100)).toBe(false);
  });
  it('stock 1 / claimed 0 → 가능', () => {
    expect(canClaimReward(1, 0)).toBe(true);
  });
});
