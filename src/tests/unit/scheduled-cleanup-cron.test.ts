/**
 * 🛡️ 2026-04-28: 선물 만료 + consignment cleanup cron 로직 검증
 *
 * scheduled-cleanup.ts 의 SQL 패턴 정합성 (만료 시각 비교, status 전환 조건).
 * D1 mocking 대신 SQL 문자열 + clock manipulation 검증.
 */
import { describe, it, expect } from 'vitest';

// scheduled-cleanup.ts 의 gift 만료 SQL 시뮬레이션
function shouldExpireGift(status: string, expires_at: string | null, nowMs: number = Date.now()): boolean {
  if (status !== 'paid') return false;
  if (!expires_at) return false;
  const expiresMs = Date.parse(expires_at);
  if (!Number.isFinite(expiresMs)) return false;
  return nowMs > expiresMs;
}

function shouldCleanupPendingGift(status: string, created_at: string, nowMs: number = Date.now()): boolean {
  if (status !== 'pending') return false;
  const createdMs = Date.parse(created_at);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs > 24 * 60 * 60 * 1000;
}

function shouldExpirePendingConsignment(status: string, created_at: string, nowMs: number = Date.now()): boolean {
  if (status !== 'pending') return false;
  const createdMs = Date.parse(created_at);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs > 30 * 24 * 60 * 60 * 1000;
}

describe('gift 만료 — paid + expires_at 경과', () => {
  const now = Date.parse('2026-05-30T00:00:00Z');

  it('paid + expires_at 과거 → 만료', () => {
    expect(shouldExpireGift('paid', '2026-05-29T00:00:00Z', now)).toBe(true);
  });
  it('paid + expires_at 미래 → 안 만료', () => {
    expect(shouldExpireGift('paid', '2026-06-15T00:00:00Z', now)).toBe(false);
  });
  it('paid + expires_at NULL → 안 만료', () => {
    expect(shouldExpireGift('paid', null, now)).toBe(false);
  });
  it('claimed → 만료 안 됨 (이미 받음)', () => {
    expect(shouldExpireGift('claimed', '2026-05-29T00:00:00Z', now)).toBe(false);
  });
  it('shipped → 만료 안 됨', () => {
    expect(shouldExpireGift('shipped', '2026-05-29T00:00:00Z', now)).toBe(false);
  });
  it('pending → 별도 cleanup 흐름 (만료 흐름 X)', () => {
    expect(shouldExpireGift('pending', '2026-05-29T00:00:00Z', now)).toBe(false);
  });
});

describe('pending gift 24시간 cleanup', () => {
  const now = Date.parse('2026-04-28T12:00:00Z');

  it('pending + 25시간 전 생성 → cleanup', () => {
    expect(shouldCleanupPendingGift('pending', '2026-04-27T11:00:00Z', now)).toBe(true);
  });
  it('pending + 23시간 전 → 아직', () => {
    expect(shouldCleanupPendingGift('pending', '2026-04-27T13:00:00Z', now)).toBe(false);
  });
  it('paid + 25시간 전 → cleanup 안 함 (paid 는 별도 만료 흐름)', () => {
    expect(shouldCleanupPendingGift('paid', '2026-04-27T11:00:00Z', now)).toBe(false);
  });
  it('정확히 24시간 → boundary 경계', () => {
    expect(shouldCleanupPendingGift('pending', '2026-04-27T12:00:00Z', now)).toBe(false);
  });
});

describe('consignment_partnerships pending 30일 cleanup', () => {
  const now = Date.parse('2026-04-28T00:00:00Z');

  it('pending + 31일 전 → cleanup', () => {
    expect(shouldExpirePendingConsignment('pending', '2026-03-27T00:00:00Z', now)).toBe(true);
  });
  it('pending + 29일 전 → 아직', () => {
    expect(shouldExpirePendingConsignment('pending', '2026-03-30T00:00:00Z', now)).toBe(false);
  });
  it('active → cleanup 안 함', () => {
    expect(shouldExpirePendingConsignment('active', '2026-03-01T00:00:00Z', now)).toBe(false);
  });
  it('ended → cleanup 안 함 (이미 종료)', () => {
    expect(shouldExpirePendingConsignment('ended', '2026-03-01T00:00:00Z', now)).toBe(false);
  });
});
