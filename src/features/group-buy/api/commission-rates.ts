/**
 * 🛡️ 2026-05-16: 공구 정산 마진 헬퍼 — platform_settings 에서 읽음 (어드민 조정 가능).
 *
 * 정산 구조 (T+0 결제 시 매출 100%):
 *   - platform_margin_pct (default 5%): 유어딜 운영비
 *   - influencer_commission_pct (default 0.5%): 인플루언서 referral commission (?ref= 진입 시)
 *   - user_referral_bonus_pct (default 0.5%): 사용자 referral 보너스 (구매 시 즉시 적립)
 *   - agency_commission_pct (default 2%): 에이전시 (셀러 소속 시)
 *   - 셀러 receivable = 100 - 위 합계
 *
 * 예시 (모두 default):
 *   - 인플루언서 referral + 에이전시 소속:
 *     5% (유어딜) + 0.5% (인플) + 0.5% (유저) + 2% (에이전시) = 8%
 *     셀러 receivable = 92%
 *
 *   - referral 없음, 에이전시 없음:
 *     5% (유어딜) → 셀러 receivable = 95%
 *
 *   - 인플 차단된 referral:
 *     5% (유어딜) + 0.5% (유저 보너스 → 유어딜 떠안음)
 *     = 유어딜 5.5% (실효) or 5% (유저 보너스도 우리가 별도 부담)
 *     셀러 receivable = 95%
 */

interface CommissionRates {
  platform_pct: number
  influencer_pct: number
  user_referral_bonus_pct: number
  agency_pct: number
  refund_window_days: number
  influencer_payout_min: number
  seller_referral_bonus_pct: number
  seller_referral_bonus_months: number
  max_influencer_commission_pct: number
}

const DEFAULTS: CommissionRates = {
  platform_pct: 5,
  influencer_pct: 0.5,
  user_referral_bonus_pct: 0.5,
  agency_pct: 2,
  refund_window_days: 7,
  influencer_payout_min: 100000,
  seller_referral_bonus_pct: 1,
  seller_referral_bonus_months: 6,
  max_influencer_commission_pct: 2,
}

const KEY_MAP: Record<keyof CommissionRates, string> = {
  platform_pct: 'platform_margin_pct',
  influencer_pct: 'influencer_commission_pct',
  user_referral_bonus_pct: 'user_referral_bonus_pct',
  agency_pct: 'agency_commission_pct',
  refund_window_days: 'refund_window_days',
  influencer_payout_min: 'influencer_payout_min',
  seller_referral_bonus_pct: 'seller_referral_bonus_pct',
  seller_referral_bonus_months: 'seller_referral_bonus_months',
  max_influencer_commission_pct: 'max_influencer_commission_pct',
}

/**
 * platform_settings 에서 모든 정산 rate 한 번에 읽어옴.
 * 테이블/키 없으면 DEFAULTS fallback.
 */
export async function getCommissionRates(DB: D1Database): Promise<CommissionRates> {
  try {
    const { results } = await DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN (
        'platform_margin_pct', 'influencer_commission_pct', 'user_referral_bonus_pct',
        'agency_commission_pct', 'refund_window_days', 'influencer_payout_min'
      )`
    ).all<{ key: string; value: string }>()
    const map = new Map((results || []).map(r => [r.key, r.value]))
    const out: CommissionRates = { ...DEFAULTS }
    for (const [field, settingKey] of Object.entries(KEY_MAP) as Array<[keyof CommissionRates, string]>) {
      const raw = map.get(settingKey)
      if (raw !== undefined) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) (out as Record<string, number>)[field] = n
      }
    }
    return out
  } catch {
    return { ...DEFAULTS }
  }
}

interface SplitInput {
  total_amount: number              // 결제 금액 (원)
  has_influencer: boolean            // ?ref= 진입 + 매장 차단 안 됨 + 공구 referral_disabled=0
  has_agency: boolean                // 셀러 소속 에이전시 존재
}

interface SplitResult {
  platform: number                   // 유어딜 운영비
  influencer: number                 // 인플루언서 commission (없으면 0)
  user_bonus: number                 // 사용자 referral 보너스 (always 지급 if has_influencer flag 원본 = ?ref= 있었음)
  agency: number                     // 에이전시 commission (없으면 0)
  seller_receivable: number          // 셀러 receivable (남은 전부)
  platform_absorbs_user_bonus: boolean  // 인플 차단됐는데 사용자 보너스만 지급해야 할 때 true
}

/**
 * 매출을 ledger 계정별로 분배.
 * has_influencer = false 인 케이스 (?ref= 자체 없음): 인플 + 사용자 보너스 모두 0.
 * has_influencer = true 인 케이스: 인플 + 사용자 보너스 양쪽 지급.
 * has_influencer = false + ?ref= 있었으나 차단된 케이스: 차단 케이스 별도 split 호출자가 platform_absorbs_user_bonus=true 로 호출 (이 함수 내부에선 input flag 로 판단 X).
 */
export function calcSplit(rates: CommissionRates, input: SplitInput): SplitResult {
  const { total_amount, has_influencer, has_agency } = input
  const platform = Math.floor(total_amount * rates.platform_pct / 100)
  const influencer = has_influencer ? Math.floor(total_amount * rates.influencer_pct / 100) : 0
  const user_bonus = has_influencer ? Math.floor(total_amount * rates.user_referral_bonus_pct / 100) : 0
  const agency = has_agency ? Math.floor(total_amount * rates.agency_pct / 100) : 0
  const seller_receivable = total_amount - platform - influencer - user_bonus - agency
  return {
    platform, influencer, user_bonus, agency, seller_receivable,
    platform_absorbs_user_bonus: false,
  }
}

/**
 * 인플 차단된 케이스용 split — 사용자 보너스는 유어딜이 떠안음.
 */
export function calcSplitInfluencerBlocked(rates: CommissionRates, input: Omit<SplitInput, 'has_influencer'>): SplitResult {
  const { total_amount, has_agency } = input
  const user_bonus = Math.floor(total_amount * rates.user_referral_bonus_pct / 100)
  // 사용자 보너스는 ledger 에서 user_wallet credit 으로 즉시 적립, 유어딜 운영비 차감
  const platform_after_absorb = Math.floor(total_amount * rates.platform_pct / 100) - user_bonus
  const platform = Math.max(0, platform_after_absorb)  // 음수 방지
  const agency = has_agency ? Math.floor(total_amount * rates.agency_pct / 100) : 0
  const seller_receivable = total_amount - platform - user_bonus - agency
  return {
    platform, influencer: 0, user_bonus, agency, seller_receivable,
    platform_absorbs_user_bonus: true,
  }
}

/**
 * 인플 commission % 계산 — 영입 보너스 + 협업 deal + cap 고려.
 * 우선순위: max(base + 영입 보너스 (활성 시), 협업 deal %) — 최대 cap 까지.
 */
export function calcInfluencerCommissionPct(
  rates: CommissionRates,
  ctx: {
    is_referred_by_this_influencer: boolean       // 매장이 이 인플이 영입한 경우
    referral_bonus_active: boolean                 // 보너스 기간 내
    deal_commission_pct: number | null              // 협업 deal 활성 시 우대 %
  },
): number {
  const base = rates.influencer_pct
  const referralPct = (ctx.is_referred_by_this_influencer && ctx.referral_bonus_active)
    ? rates.seller_referral_bonus_pct
    : 0
  const candidateBase = base + referralPct
  const candidateDeal = ctx.deal_commission_pct ?? 0
  // 우대 deal 이 base+referral 보다 크면 deal 우선
  const winner = Math.max(candidateBase, candidateDeal)
  return Math.min(winner, rates.max_influencer_commission_pct)
}

export type { CommissionRates, SplitInput, SplitResult }
