/**
 * 🛡️ 2026-05-18: 셀러 등급별 voucher 발행 한도 검증.
 *
 *   migration 0263 으로 seller_tiers 에 voucher_monthly_limit + referral_allowed 추가.
 *   호출처: stay 등록 / 식사권 등록 / 미용권 등록 등 voucher 카테고리 product 생성 시.
 *
 *   defensive: seller_tiers 테이블 없거나 sellers.current_tier 누락 시 unlimited 처리.
 */
type Env = { DB: D1Database }

interface LimitCheckResult {
  ok: boolean
  current_count: number
  monthly_limit: number  // -1 = 무제한
  tier_name: string | null
  reason?: string
}

const VOUCHER_CATEGORIES = [
  'meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher',
  'health_voucher', 'pet_voucher', 'activity_voucher',
] as const

/**
 * 셀러가 이번 달 voucher 추가 발행 가능한지 검사.
 * 셀러 등급 + 현재 활성 voucher 갯수 + 이번 달 신규 갯수.
 */
export async function checkVoucherLimit(env: Env, sellerId: number): Promise<LimitCheckResult> {
  // 1. 셀러 등급 + 한도 조회.
  const tier = await env.DB.prepare(
    `SELECT st.name, st.voucher_monthly_limit
       FROM sellers s
       LEFT JOIN seller_tiers st ON st.name = COALESCE(
         (SELECT tier_name FROM seller_tier_history WHERE seller_id = s.id ORDER BY created_at DESC LIMIT 1),
         '브론즈'
       )
      WHERE s.id = ?`
  ).bind(sellerId).first<{ name: string | null; voucher_monthly_limit: number | null }>().catch(() => null)

  const tierName = tier?.name || '브론즈'
  const limit = tier?.voucher_monthly_limit ?? 5

  // 무제한 (다이아) 면 통과.
  if (limit === -1) {
    return { ok: true, current_count: 0, monthly_limit: -1, tier_name: tierName }
  }

  // 2. 이번 달 신규 voucher 발행 갯수.
  const placeholders = VOUCHER_CATEGORIES.map(() => '?').join(',')
  const params: unknown[] = [sellerId, ...VOUCHER_CATEGORIES]

  const row = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM products
      WHERE seller_id = ?
        AND category IN (${placeholders})
        AND created_at >= datetime('now', 'start of month')`
  ).bind(...params).first<{ cnt: number }>().catch(() => null)

  const currentCount = row?.cnt || 0
  const ok = currentCount < limit

  return {
    ok,
    current_count: currentCount,
    monthly_limit: limit,
    tier_name: tierName,
    reason: ok ? undefined : `이번 달 ${tierName} 등급 한도 ${limit}개 초과 (현재 ${currentCount}개). 등급 상향 후 가능.`,
  }
}

/**
 * 셀러가 referral 모드 (인플 할인) 활성화 권한 있는지.
 * 실버 이상 가능.
 */
export async function canEnableReferral(env: Env, sellerId: number): Promise<boolean> {
  const tier = await env.DB.prepare(
    `SELECT COALESCE(st.referral_allowed, 0) as allowed
       FROM sellers s
       LEFT JOIN seller_tiers st ON st.name = COALESCE(
         (SELECT tier_name FROM seller_tier_history WHERE seller_id = s.id ORDER BY created_at DESC LIMIT 1),
         '브론즈'
       )
      WHERE s.id = ?`
  ).bind(sellerId).first<{ allowed: number }>().catch(() => null)

  return tier?.allowed === 1
}
