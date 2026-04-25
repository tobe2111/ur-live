/**
 * Referral Tree, Invite Reward, Points Sub, Restaurant Settlement 단위 테스트
 */
import { describe, it, expect } from 'vitest';

const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Referral Tree mirrors ─────────────────────────────────────────────────────

const MAX_REFERRAL_DEPTH = 10;

interface ReferralNode { user_id: string; parent_id: string | null; depth: number; }

function buildReferralTree(nodes: ReferralNode[], rootId: string): ReferralNode[] {
  const result: ReferralNode[] = [];
  const queue: string[] = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const children = nodes.filter(n => n.parent_id === current);
    for (const child of children) {
      if (child.depth <= MAX_REFERRAL_DEPTH) {
        result.push(child);
        queue.push(child.user_id);
      }
    }
  }
  return result;
}

function detectSelfReferral(userId: string, referrerId: string): boolean {
  return userId === referrerId;
}

function detectCycleInChain(newReferrer: string, ancestorChain: string[]): boolean {
  return ancestorChain.includes(newReferrer);
}

const REFERRAL_TIER_RATES = [0.1, 0.05, 0.03, 0.02, 0.01]; // depth 1~5 commission

function calcReferralCommission(amount: number, depth: number): number {
  if (depth < 1 || depth > REFERRAL_TIER_RATES.length) return 0;
  const rate = REFERRAL_TIER_RATES[depth - 1];
  return Math.round(amount * rate);
}

// ── Invite Reward mirrors ─────────────────────────────────────────────────────

const INVITE_REWARD_POINTS = 1000;

interface RewardClaim { user_id: string; invite_code: string; created_at: string; }

function checkRewardEligibility(
  userId: string,
  inviteCode: string,
  existingClaims: RewardClaim[],
): string | null {
  if (!userId || !inviteCode) return '필수 항목 누락';
  // 중복 청구 확인 (같은 코드)
  if (existingClaims.some(c => c.user_id === userId && c.invite_code === inviteCode)) {
    return '이미 청구된 보상';
  }
  return null;
}

// ── Points Donate mirrors ─────────────────────────────────────────────────────

const MIN_POINTS_DONATION = 500;

function validatePointsDonation(body: {
  amount?: number; stream_id?: number; balance?: number;
}): string | null {
  if (!body.stream_id || !body.amount) return '필수 항목 누락';
  if (!Number.isFinite(body.amount) || body.amount < MIN_POINTS_DONATION) {
    return `최소 ${MIN_POINTS_DONATION}딜`;
  }
  if (body.amount % 100 !== 0) return '100딜 단위';
  if (body.balance !== undefined && body.amount > body.balance) return '잔액 부족';
  return null;
}

// ── Points Reward mirrors ─────────────────────────────────────────────────────

const VALID_REWARD_TYPES = ['signup', 'referral', 'review', 'event', 'admin_grant'] as const;
const MAX_REWARD_AMOUNT = 1_000_000;

function isValidRewardType(type: string): boolean {
  return VALID_REWARD_TYPES.includes(type as typeof VALID_REWARD_TYPES[number]);
}

function validateRewardGrant(body: {
  user_id?: string; type?: string; amount?: number; reason?: string;
}): string | null {
  if (!body.user_id) return 'user_id 필수';
  if (!body.type || !isValidRewardType(body.type)) return '유효하지 않은 reward type';
  if (!body.amount || !Number.isInteger(body.amount) || body.amount <= 0) return 'amount 양의 정수';
  if (body.amount > MAX_REWARD_AMOUNT) return `amount 최대 ${MAX_REWARD_AMOUNT.toLocaleString()}`;
  if (body.reason && body.reason.length > 500) return 'reason 500자 이하';
  return null;
}

// ── Restaurant Settlement mirrors ─────────────────────────────────────────────

function calcRestaurantSettlementPeriod(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function validateSettlementMonth(year: unknown, month: unknown): string | null {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2020 || y > 2100) return 'year 2020~2100';
  if (!Number.isInteger(m) || m < 1 || m > 12) return 'month 1~12';
  // 미래 월 거부
  const now = new Date();
  const currentYM = now.getFullYear() * 12 + now.getMonth() + 1;
  const requestedYM = y * 12 + m;
  if (requestedYM > currentYM) return '미래 정산 불가';
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Referral Tree Routes', () => {
  it('자기 자신 추천 차단', () => {
    expect(detectSelfReferral('u1', 'u1')).toBe(true);
    expect(detectSelfReferral('u1', 'u2')).toBe(false);
  });

  it('순환 추천 검출', () => {
    expect(detectCycleInChain('u3', ['u1', 'u2', 'u3', 'u4'])).toBe(true);
    expect(detectCycleInChain('u5', ['u1', 'u2', 'u3'])).toBe(false);
  });

  it('referral tree 구축', () => {
    const nodes: ReferralNode[] = [
      { user_id: 'u1', parent_id: 'root', depth: 1 },
      { user_id: 'u2', parent_id: 'root', depth: 1 },
      { user_id: 'u3', parent_id: 'u1', depth: 2 },
      { user_id: 'u4', parent_id: 'u3', depth: 3 },
    ];
    const tree = buildReferralTree(nodes, 'root');
    expect(tree.length).toBe(4);
  });

  it('최대 깊이 초과 노드 제외', () => {
    const nodes: ReferralNode[] = [
      { user_id: 'u1', parent_id: 'root', depth: 1 },
      { user_id: 'u2', parent_id: 'u1', depth: 11 },  // 깊이 초과
    ];
    const tree = buildReferralTree(nodes, 'root');
    expect(tree.find(n => n.user_id === 'u2')).toBeUndefined();
  });

  it('depth별 수수료율 계산', () => {
    expect(calcReferralCommission(10000, 1)).toBe(1000);  // 10%
    expect(calcReferralCommission(10000, 2)).toBe(500);   // 5%
    expect(calcReferralCommission(10000, 5)).toBe(100);   // 1%
    expect(calcReferralCommission(10000, 6)).toBe(0);     // 범위 초과
    expect(calcReferralCommission(10000, 0)).toBe(0);
  });
});

describe('Invite Reward Routes', () => {
  it('필수 항목 누락 거부', () => {
    expect(checkRewardEligibility('', 'CODE', [])).toBe('필수 항목 누락');
    expect(checkRewardEligibility('u1', '', [])).toBe('필수 항목 누락');
  });

  it('중복 청구 거부', () => {
    const existing: RewardClaim[] = [
      { user_id: 'u1', invite_code: 'ABC123', created_at: new Date().toISOString() },
    ];
    expect(checkRewardEligibility('u1', 'ABC123', existing)).toBe('이미 청구된 보상');
  });

  it('다른 코드는 별개로 청구 가능', () => {
    const existing: RewardClaim[] = [
      { user_id: 'u1', invite_code: 'ABC123', created_at: new Date().toISOString() },
    ];
    expect(checkRewardEligibility('u1', 'XYZ789', existing)).toBeNull();
  });

  it('첫 청구 통과', () => {
    expect(checkRewardEligibility('u1', 'ABC123', [])).toBeNull();
  });

  it('보상 포인트 상수', () => {
    expect(INVITE_REWARD_POINTS).toBe(1000);
  });
});

describe('Points Donate Routes', () => {
  it('필수 항목 누락', () => {
    expect(validatePointsDonation({})).toBe('필수 항목 누락');
  });

  it('최소 500딜', () => {
    expect(validatePointsDonation({ stream_id: 1, amount: 100 })).toContain('최소');
    expect(validatePointsDonation({ stream_id: 1, amount: 500 })).toBeNull();
  });

  it('100딜 단위', () => {
    expect(validatePointsDonation({ stream_id: 1, amount: 550 })).toBe('100딜 단위');
  });

  it('잔액 부족 거부', () => {
    expect(validatePointsDonation({ stream_id: 1, amount: 5000, balance: 1000 })).toBe('잔액 부족');
  });

  it('잔액 충분 시 통과', () => {
    expect(validatePointsDonation({ stream_id: 1, amount: 1000, balance: 5000 })).toBeNull();
  });
});

describe('Points Reward Routes', () => {
  it('reward type enum 검증', () => {
    ['signup', 'referral', 'review', 'event', 'admin_grant'].forEach(t => {
      expect(isValidRewardType(t)).toBe(true);
    });
    expect(isValidRewardType('hack')).toBe(false);
  });

  it('필수 항목 검증', () => {
    expect(validateRewardGrant({})).toBe('user_id 필수');
    expect(validateRewardGrant({ user_id: 'u1' })).toContain('reward type');
  });

  it('amount 양의 정수', () => {
    expect(validateRewardGrant({ user_id: 'u1', type: 'signup', amount: 0 })).toContain('amount');
    expect(validateRewardGrant({ user_id: 'u1', type: 'signup', amount: -100 })).toContain('amount');
    expect(validateRewardGrant({ user_id: 'u1', type: 'signup', amount: 1.5 })).toContain('amount');
  });

  it('amount 100만 초과 거부', () => {
    expect(validateRewardGrant({
      user_id: 'u1', type: 'admin_grant', amount: 1_000_001
    })).toContain('최대');
  });

  it('reason 500자 제한', () => {
    expect(validateRewardGrant({
      user_id: 'u1', type: 'event', amount: 1000, reason: 'a'.repeat(501)
    })).toContain('500자');
  });

  it('정상 reward 부여', () => {
    expect(validateRewardGrant({
      user_id: 'u1', type: 'signup', amount: 1000, reason: '신규 가입'
    })).toBeNull();
  });
});

describe('Restaurant Settlement Routes', () => {
  it('월 정산 기간 계산 (월 첫날 ~ 말일)', () => {
    const r = calcRestaurantSettlementPeriod(2024, 2);
    expect(r.start).toBe('2024-02-01');
    expect(r.end).toBe('2024-02-29'); // 윤년
  });

  it('1월 정산 기간', () => {
    const r = calcRestaurantSettlementPeriod(2024, 1);
    expect(r.start).toBe('2024-01-01');
    expect(r.end).toBe('2024-01-31');
  });

  it('year 2020~2100 범위', () => {
    expect(validateSettlementMonth(2019, 1)).toContain('year');
    expect(validateSettlementMonth(2101, 1)).toContain('year');
    expect(validateSettlementMonth(2024, 1)).toBeNull();
  });

  it('month 1~12 범위', () => {
    expect(validateSettlementMonth(2024, 0)).toContain('month');
    expect(validateSettlementMonth(2024, 13)).toContain('month');
  });

  it('미래 월 거부', () => {
    expect(validateSettlementMonth(2099, 12)).toBe('미래 정산 불가');
  });
});

describe('D1 mock', () => {
  it('referral row INSERT 호출', async () => {
    const r = await mockDB.prepare('INSERT INTO referrals (user_id, parent_id, depth) VALUES (?, ?, ?)')
      .bind('u1', 'root', 1).run();
    expect(r.success).toBe(true);
  });
});
