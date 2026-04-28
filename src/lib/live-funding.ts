/**
 * 🛡️ 2026-04-28: 라이브 펀딩 — 순수 로직 (진행률 + 상태 전환 + 환불 자격 검증)
 *
 * - calcProgress: 펀딩 진행률 (0~100% clamp + achieved 판정)
 * - canTransitionFunding: 상태 머신 (draft→preparing→live→succeeded/failed → producing→shipping→delivered)
 * - shouldAutoRefund: 마감 후 미달성 시 자동 환불 대상 검증
 */

export type FundingStatus =
  | 'draft'
  | 'preparing'
  | 'live'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'producing'
  | 'shipping'
  | 'delivered';

export interface FundingProgress {
  percent: number;          // 0~100 (clamp)
  achieved: boolean;        // current >= target
  remaining: number;        // target - current (>= 0)
  expired: boolean;         // ends_at 과거
  status_recommended: 'live' | 'succeeded' | 'failed' | null;
}

export function calcFundingProgress(
  current: number,
  target: number,
  endsAtMs: number,
  nowMs: number = Date.now(),
): FundingProgress {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const achieved = target > 0 && current >= target;
  const remaining = Math.max(0, target - current);
  const expired = nowMs > endsAtMs;

  let status_recommended: 'live' | 'succeeded' | 'failed' | null = null;
  if (!expired) {
    status_recommended = 'live';
  } else if (achieved) {
    status_recommended = 'succeeded';
  } else {
    status_recommended = 'failed';
  }

  return { percent, achieved, remaining, expired, status_recommended };
}

const TRANSITIONS: Record<FundingStatus, FundingStatus[]> = {
  draft: ['preparing', 'cancelled'],
  preparing: ['live', 'cancelled'],
  live: ['succeeded', 'failed', 'cancelled'],
  succeeded: ['producing', 'cancelled'],
  failed: [],         // terminal (auto-refund 후 별도 처리)
  cancelled: [],      // terminal
  producing: ['shipping'],
  shipping: ['delivered'],
  delivered: [],      // terminal
};

export function canTransitionFunding(from: FundingStatus, to: FundingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 자동 환불 대상 검증.
 * - status='failed' 가 cron 으로 마킹되면 funding_backers 의 paid 상태 후원자들이 환불 대상.
 * - 이미 refunded/shipped/delivered 인 후원자는 제외.
 */
export function shouldAutoRefundBacker(
  fundingStatus: FundingStatus,
  backerStatus: 'pending' | 'paid' | 'refunded' | 'shipped' | 'delivered',
): boolean {
  if (fundingStatus !== 'failed' && fundingStatus !== 'cancelled') return false;
  return backerStatus === 'paid';
}

/**
 * 리워드 stock 검증 — 한정 수량 펀딩의 경우.
 */
export function canClaimReward(
  rewardStock: number | null,
  rewardClaimed: number,
): boolean {
  if (rewardStock == null) return true; // 무제한
  return rewardClaimed < rewardStock;
}
