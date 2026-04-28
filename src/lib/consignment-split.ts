/**
 * 🛡️ 2026-04-28: MD 위탁 판매 정산 분배 로직.
 *
 * 셀러 A(host) 가 셀러 B(owner) 의 상품을 자기 라이브에서 판매했을 때,
 * 매출 X 원을 host/owner/플랫폼 3방향으로 분배.
 *
 * 분배 식:
 *   platform_amount = X * platform_rate / 100         (정수 floor)
 *   net = X - platform_amount                          (플랫폼 수수료 제외 금액)
 *   host_amount = net * host_rate / 100                (정수 floor)
 *   owner_amount = net - host_amount                   (잔여 = owner)
 *
 * 보장:
 *   host_amount + owner_amount + platform_amount === X (총합 일치)
 *   각 금액 >= 0
 *   floor 후 잔돈은 owner 에게 (소유주 보호)
 */

export interface SplitInput {
  total_amount: number;     // 매출 총액 (원, integer)
  host_rate: number;        // host 수수료율 (0~50, %)
  platform_rate: number;    // 플랫폼 수수료율 (default 10)
}

export interface SplitResult {
  total_amount: number;
  host_amount: number;
  owner_amount: number;
  platform_amount: number;
  rate_snapshot: number;
}

const PLATFORM_DEFAULT_RATE = 10;
const MAX_HOST_RATE = 50;

export function calcConsignmentSplit(input: SplitInput): SplitResult {
  const total = Math.max(0, Math.floor(input.total_amount));
  const platformRate = clampRate(input.platform_rate ?? PLATFORM_DEFAULT_RATE, 0, 100);
  const hostRate = clampRate(input.host_rate, 0, MAX_HOST_RATE);

  const platformAmount = Math.floor((total * platformRate) / 100);
  const net = total - platformAmount;
  const hostAmount = Math.floor((net * hostRate) / 100);
  const ownerAmount = net - hostAmount; // 잔돈은 owner 에게

  return {
    total_amount: total,
    host_amount: hostAmount,
    owner_amount: ownerAmount,
    platform_amount: platformAmount,
    rate_snapshot: hostRate,
  };
}

function clampRate(rate: number, min: number, max: number): number {
  if (!Number.isFinite(rate)) return min;
  return Math.max(min, Math.min(max, rate));
}

/**
 * 신청 → 승인 흐름 검증.
 * MVP: owner 만 승인 가능. host 가 owner 한테 신청 OR owner 가 host 에게 위임.
 */
export type ConsignmentStatus = 'pending' | 'active' | 'paused' | 'ended';
export type InvitedBy = 'host' | 'owner';

export function canApprove(currentStatus: ConsignmentStatus, invitedBy: InvitedBy, actor: 'host' | 'owner'): boolean {
  if (currentStatus !== 'pending') return false;
  // host 가 신청한 경우 → owner 가 승인
  if (invitedBy === 'host' && actor === 'owner') return true;
  // owner 가 host 에게 위임한 경우 → host 가 수락
  if (invitedBy === 'owner' && actor === 'host') return true;
  return false;
}

export function canTerminate(currentStatus: ConsignmentStatus, _actor: 'host' | 'owner'): boolean {
  // active / paused 상태에서 host/owner 둘 다 종료 가능
  return currentStatus === 'active' || currentStatus === 'paused';
}
