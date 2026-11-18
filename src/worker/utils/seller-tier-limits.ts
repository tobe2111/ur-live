/**
 * 🛡️ 2026-05-18: 셀러 등급별 voucher 발행 한도 검증.
 *
 *   migration 0263 으로 seller_tiers 에 voucher_monthly_limit + referral_allowed 추가.
 *   호출처: stay 등록 / 이용권 등록 / 미용권 등록 등 voucher 카테고리 product 생성 시.
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

/**
 * 🩸 2026-11-18 등급 이름이 두 벌이다 — 등급을 **정하는** 쪽(`cron/seller-tier-eval.ts`)은 `sellers.tier` 에
 *   영어 코드(new·bronze·silver·gold·diamond)를 쓰고, 한도 **표**(`seller_tiers.name`)는 한글(브론즈·실버…)이다.
 *   종전 쿼리는 `seller_tier_history.tier_name`·`created_at`(라이브에 없는 칸 — 실제는 new_tier·changed_at)을 읽다가
 *   조회 전체가 던졌고 `.catch(() => null)` 로 **모든 셀러가 브론즈 5개**로 처리됐다(대표 "영구적으로 고쳐줘").
 *   ⇒ 진실은 `sellers.tier` 하나. 이 표가 두 이름을 잇는다. 모르는 코드·null 은 브론즈(종전 기본값 그대로).
 *   `new`(가입 30일 미만)는 한도 표에 없는 등급이라 브론즈 한도를 쓴다.
 */
export const TIER_CODE_TO_NAME: Record<string, string> = {
  new: '브론즈', bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', diamond: '다이아',
}
const TIER_NAME_SQL = `CASE LOWER(COALESCE(s.tier, ''))
         ${Object.entries(TIER_CODE_TO_NAME).map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ')}
         ELSE '브론즈' END`

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
       LEFT JOIN seller_tiers st ON st.name = ${TIER_NAME_SQL}
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
       LEFT JOIN seller_tiers st ON st.name = ${TIER_NAME_SQL}
      WHERE s.id = ?`
  ).bind(sellerId).first<{ allowed: number }>().catch(() => null)

  return tier?.allowed === 1
}
