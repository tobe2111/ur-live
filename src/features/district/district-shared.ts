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

/**
 * 🧾 경로 B(온라인 결제 자동발급) 캠페인 기간 게이트 — 순수 판정(now 주입, 유닛테스트).
 *   상시 아님: starts_at/ends_at(datetime 문자열, KST 저장 가정 — 저장 포맷과 now 를 동일 비교).
 *   경계 포함(starts_at <= now <= ends_at). 값 없음/파싱불가는 "제한 없음"으로 관대 처리(캠페인 status='open' 이 상위 게이트).
 */
export function withinCampaignWindow(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  nowIso: string,
): boolean {
  // datetime-local('YYYY-MM-DDTHH:MM')와 SQLite datetime('YYYY-MM-DD HH:MM:SS') 혼용 대비 — 'T'→' ' 정규화 후 문자열 비교.
  const norm = (x: string | null | undefined) => String(x || '').trim().replace('T', ' ')
  const now = norm(nowIso)
  if (!now) return false
  const s = norm(startsAt)
  const e = norm(endsAt)
  // 경계 포함. 분 정밀도 저장(초 없음)과 초 포함 now 비교 시, end 는 같은 분이면 통과하도록 분까지만 비교.
  if (s && now.slice(0, s.length) < s) return false
  if (e && now.slice(0, e.length) > e) return false
  return true
}

/** 재원(funding_source) 정규화 — 'urteam' 외 전부 'foundation'(기본 = 재단 예산). */
export function normalizeFundingSource(raw: string | null | undefined): 'foundation' | 'urteam' {
  return String(raw || '').trim().toLowerCase() === 'urteam' ? 'urteam' : 'foundation'
}
