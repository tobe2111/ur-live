/**
 * 에이전시 등급 라벨 매핑
 *
 * DB enum (`new`/`junior`/`senior`) ↔ UI 라벨 (브론즈/실버/골드).
 *
 * Phase 1-1 (2026-04-27): 사용자 결정으로 라벨을 한국식 등급명으로 변경.
 * DB CHECK 제약 변경은 위험 크므로 라벨 매핑 레이어로 처리.
 */

export type AgencyTier = 'new' | 'junior' | 'senior';

export const AGENCY_TIER_LABEL: Record<AgencyTier, string> = {
  new: '브론즈',
  junior: '실버',
  senior: '골드',
};

export const AGENCY_TIER_LABEL_EN: Record<AgencyTier, string> = {
  new: 'Bronze',
  junior: 'Silver',
  senior: 'Gold',
};

export const AGENCY_TIER_ORDER: AgencyTier[] = ['new', 'junior', 'senior'];

export const AGENCY_TIER_BADGE_CLASS: Record<AgencyTier, string> = {
  new: 'bg-amber-100 text-amber-800 border-amber-300',         // 브론즈 — 따뜻한 갈색 톤
  junior: 'bg-slate-200 text-slate-800 border-slate-400',       // 실버 — 은색 톤
  senior: 'bg-yellow-100 text-yellow-800 border-yellow-400',    // 골드 — 황금색 톤
};

export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return AGENCY_TIER_LABEL.new;
  return AGENCY_TIER_LABEL[tier as AgencyTier] ?? tier;
}

export function tierBadgeClass(tier: string | null | undefined): string {
  if (!tier) return AGENCY_TIER_BADGE_CLASS.new;
  return AGENCY_TIER_BADGE_CLASS[tier as AgencyTier] ?? AGENCY_TIER_BADGE_CLASS.new;
}
