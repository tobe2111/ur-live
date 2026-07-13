/**
 * 🧾 상권 쿠폰 — 순수 헬퍼(서버 권위 계산 SSOT, 유닛테스트 대상).
 *   워커 라우트(district-coupon*.routes.ts)와 테스트가 공유. 부수효과 0.
 */
export interface RewardTier { min_amount: number; face_value: number }

/** reward_tiers JSON 파싱 — 유효 구간만, 높은 기준액 우선 정렬. */
export function parseRewardTiers(raw: string | null | undefined): RewardTier[] {
  try {
    const arr = JSON.parse(raw || '[]')
    if (!Array.isArray(arr)) return []
    return arr
      .map((t) => ({ min_amount: Number(t?.min_amount), face_value: Number(t?.face_value) }))
      .filter((t) => Number.isFinite(t.min_amount) && t.min_amount > 0 && Number.isFinite(t.face_value) && t.face_value > 0)
      .sort((a, b) => b.min_amount - a.min_amount)
  } catch { return [] }
}

/** 금액 → 지급 액면(서버 권위 — 클라 값 미신뢰). 기준 미달이면 null. */
export function matchTier(tiers: RewardTier[], amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  for (const t of tiers) if (amount >= t.min_amount) return t.face_value
  return null
}

/** 카드 승인번호 정규화 — 하이픈/공백/특수문자 제거 + 대문자(표기 변형 dedup → UNIQUE 정확도). */
export function normalizeApprovalNo(raw: string): string {
  return String(raw || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
}
