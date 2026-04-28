/**
 * 🛡️ 2026-04-28: MD 위탁 판매 정산 분배 — 순수 로직 테스트.
 *
 * 가드:
 *  1. host_amount + owner_amount + platform_amount === total_amount (총합 보존)
 *  2. 각 금액 >= 0
 *  3. floor 후 잔돈은 owner (소유주 보호)
 *  4. host_rate 범위 0~50% clamp
 *  5. platform_rate 범위 0~100% clamp
 */
import { describe, it, expect } from 'vitest';
import {
  calcConsignmentSplit,
  canApprove,
  canTerminate,
  type ConsignmentStatus,
} from '@/lib/consignment-split';

describe('calcConsignmentSplit — 기본 분배', () => {
  it('100,000원, host 10%, platform 10% → host 9000, platform 10000, owner 81000', () => {
    const r = calcConsignmentSplit({ total_amount: 100000, host_rate: 10, platform_rate: 10 });
    expect(r.platform_amount).toBe(10000);
    expect(r.host_amount).toBe(9000);  // (100000 - 10000) * 10% = 9000
    expect(r.owner_amount).toBe(81000); // 잔여
    expect(r.host_amount + r.owner_amount + r.platform_amount).toBe(100000);
  });

  it('50,000원, host 20%, platform 10% → 총합 일치', () => {
    const r = calcConsignmentSplit({ total_amount: 50000, host_rate: 20, platform_rate: 10 });
    expect(r.platform_amount).toBe(5000);
    expect(r.host_amount).toBe(9000);  // 45000 * 20% = 9000
    expect(r.owner_amount).toBe(36000);
    expect(r.host_amount + r.owner_amount + r.platform_amount).toBe(50000);
  });

  it('0원 → 모든 금액 0', () => {
    const r = calcConsignmentSplit({ total_amount: 0, host_rate: 10, platform_rate: 10 });
    expect(r.host_amount).toBe(0);
    expect(r.owner_amount).toBe(0);
    expect(r.platform_amount).toBe(0);
  });

  it('host_rate 0 → host 0, owner 가 net 전부 받음', () => {
    const r = calcConsignmentSplit({ total_amount: 100000, host_rate: 0, platform_rate: 10 });
    expect(r.host_amount).toBe(0);
    expect(r.owner_amount).toBe(90000);
  });

  it('host_rate 100 (clamp) → 50% 로 제한 + 총합 보존', () => {
    const r = calcConsignmentSplit({ total_amount: 100000, host_rate: 100, platform_rate: 10 });
    expect(r.rate_snapshot).toBe(50); // clamped
    expect(r.host_amount).toBe(45000); // 90000 * 50% = 45000
    expect(r.owner_amount).toBe(45000);
    expect(r.platform_amount).toBe(10000);
    expect(r.host_amount + r.owner_amount + r.platform_amount).toBe(100000);
  });

  it('host_rate 음수 → 0 으로 clamp', () => {
    const r = calcConsignmentSplit({ total_amount: 100000, host_rate: -5, platform_rate: 10 });
    expect(r.rate_snapshot).toBe(0);
    expect(r.host_amount).toBe(0);
  });
});

describe('잔돈 처리 (floor 후 owner 보호)', () => {
  it('1001원 / host 10% / platform 10% → 잔돈은 owner', () => {
    const r = calcConsignmentSplit({ total_amount: 1001, host_rate: 10, platform_rate: 10 });
    // platform = floor(1001*0.1) = 100
    // net = 901
    // host = floor(901*0.1) = 90
    // owner = 901 - 90 = 811
    expect(r.platform_amount).toBe(100);
    expect(r.host_amount).toBe(90);
    expect(r.owner_amount).toBe(811);
    expect(r.host_amount + r.owner_amount + r.platform_amount).toBe(1001);
  });

  it('1원 (극단) → 모든 금액 합산 = 1', () => {
    const r = calcConsignmentSplit({ total_amount: 1, host_rate: 10, platform_rate: 10 });
    expect(r.host_amount + r.owner_amount + r.platform_amount).toBe(1);
    expect(r.owner_amount).toBeGreaterThanOrEqual(0);
  });

  it('소수 input → floor 처리 (123.7 → 123)', () => {
    const r = calcConsignmentSplit({ total_amount: 123.7, host_rate: 10, platform_rate: 10 });
    expect(r.total_amount).toBe(123);
  });
});

describe('canApprove — 신청·승인 흐름', () => {
  const cases: Array<[string, ConsignmentStatus, 'host' | 'owner', 'host' | 'owner', boolean]> = [
    ['host 신청 → owner 승인', 'pending', 'host', 'owner', true],
    ['host 신청 → host 자기승인 X', 'pending', 'host', 'host', false],
    ['owner 위임 → host 수락', 'pending', 'owner', 'host', true],
    ['owner 위임 → owner 자기수락 X', 'pending', 'owner', 'owner', false],
    ['이미 active → 재승인 X', 'active', 'host', 'owner', false],
    ['ended → 재승인 X', 'ended', 'host', 'owner', false],
  ];

  for (const [name, status, invitedBy, actor, expected] of cases) {
    it(name, () => {
      expect(canApprove(status, invitedBy, actor)).toBe(expected);
    });
  }
});

describe('canTerminate — 종료 권한', () => {
  it('active → 종료 가능 (host)', () => {
    expect(canTerminate('active', 'host')).toBe(true);
  });
  it('active → 종료 가능 (owner)', () => {
    expect(canTerminate('active', 'owner')).toBe(true);
  });
  it('paused → 종료 가능', () => {
    expect(canTerminate('paused', 'host')).toBe(true);
  });
  it('pending → 종료 불가 (대신 reject)', () => {
    expect(canTerminate('pending', 'host')).toBe(false);
  });
  it('ended → 이미 종료', () => {
    expect(canTerminate('ended', 'host')).toBe(false);
  });
});
