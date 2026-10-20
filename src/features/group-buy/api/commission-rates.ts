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
  // 🛑 2026-08-22 대표(심플 모델): 링크만 붙이면 아무나 받던 자동 커미션·구매자 보너스 기본 0 —
  //   인플루언서 수익은 매장이 제안한 딜 %(seller_influencer_deals)만. 재개는 어드민 platform_settings.
  influencer_pct: 0,
  user_referral_bonus_pct: 0,
  agency_pct: 2,
  refund_window_days: 7,
  influencer_payout_min: 100000,
  seller_referral_bonus_pct: 1,
  seller_referral_bonus_months: 6,
  max_influencer_commission_pct: 2,
}

/**
 * 딜 % 입력 검증선 — **정책 상한이 아니라 안전선**이다.
 *
 * 매장이 자기 지갑에서 주기로 한 값이라 유어딜이 몇 %인지 정하지 않는다(2026-08-22·08-30 대표).
 * 다만 100 을 넘으면 매장이 팔수록 손해라 명백한 오입력이므로 막는다.
 *
 * 🔒 **제안(marketing.routes 의 `/deals/propose` 양방향)과 정산(`calcInfluencerCommissionPct`)이
 * 반드시 같은 값을 써야 한다.** 갈리면 "제안은 되는데 정산에서 깎이는" 조용한 손실이 난다.
 */
export const DEAL_PCT_MAX = 90

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
        if (Number.isFinite(n) && n >= 0) (out as unknown as Record<string, number>)[field] = n
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
  // 🛑 2026-08-30 대표 *"자동분은 빼줘"* — **소개자 수익 = 매장이 합의한 딜 % 뿐이다.**
  //
  //   그전까지는 `max(자동분, 딜)` 이었다. 자동분 = `influencer_pct`(기본 0) +
  //   `seller_referral_bonus_pct`(1%, 그 소개자가 영입한 매장이고 보너스 기간 안일 때).
  //
  //   자동분을 없애는 이유는 재원이다. 정산식은
  //   `sellerAmount = 총액 − 유어딜 수수료 − 인플 − 유저보너스`(group-buy.routes) 라
  //   **자동분은 매장 지갑에서 나간다.** 매장은 그 1% 에 동의한 적이 없다 — 소개자가 자기를
  //   영입했다는 사실만으로 매 주문에서 조용히 빠져나갔다. 딜은 매장이 명시로 약속한 값이라
  //   같은 재원이어도 성격이 다르다.
  //
  //   ⇒ 합의 없는 자동 차감을 없애고, 매장이 스스로 정한 딜 % 만 남긴다.
  //
  //   `rates.influencer_pct` / `seller_referral_bonus_pct` / `max_influencer_commission_pct` 는
  //   설정으로는 남지만 **이 계산에는 더 이상 쓰이지 않는다**(어드민 화면·과거 정산 조회 호환).
  //   되살리려면 이 함수를 고쳐야 한다 — 설정값만 바꿔서는 안 살아난다.
  //
  //   상한 90 은 정책이 아니라 **입력 검증선**이다(100% 를 넘겨 매장이 손해 보는 값 차단).
  const deal = ctx.deal_commission_pct ?? 0
  return Math.max(0, Math.min(deal, DEAL_PCT_MAX))
}

export type { CommissionRates, SplitInput, SplitResult }
