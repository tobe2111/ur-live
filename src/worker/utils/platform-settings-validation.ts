/**
 * 💸 2026-07-11: platform_settings 값 서버측 검증 레지스트리 (PUT /api/admin/tools/settings 전용).
 *
 * 배경: 이 endpoint 는 임의 key/value upsert 라, 8월 flip 머니 스위치
 * (commission_budget_enabled / promo_funding_source / gb_engine_enabled …)에 오타값이 저장되면
 * 읽는 쪽의 `==='true'` / `==='owner'` strict 비교가 **조용히 OFF/폴백으로 동작** — flip 세션이
 * "켰는데 안 켜짐"을 오판. 클라(AdminPlatformSettingsPage)에도 검증이 있으나 서버가 SSOT.
 *
 * 원칙:
 *  - **알려진 키만 검증** — 레지스트리에 없는 키는 통과(타 어드민 페이지가 이 endpoint 로
 *    다양한 키를 쓰므로 hard-whitelist 금지). 규칙은 실제 read-site 의 해석 범위에서 도출.
 *  - 위반 시 요청 **전체 거부**(부분 적용 금지) — 어드민이 즉시 인지.
 *  - ⚠️ suffix 패턴(`*_enabled` 일괄 boolean) 금지 — kt_alpha_consumer_enabled 등은 '0'/'1'
 *    semantics (Number() 읽기)라 오검증 위험. 키를 명시 등재만.
 */

type Validator = (value: string) => string | null

/** read-site 가 === 'true' strict 비교 — 'true'/'false' 외 전부 오동작(조용히 OFF). */
function boolStr(value: string): string | null {
  return value === 'true' || value === 'false' ? null : "'true' 또는 'false' 만 허용됩니다"
}

function enumOf(allowed: string[]): Validator {
  return (value) => (allowed.includes(value) ? null : `허용 값: ${allowed.map((v) => `'${v}'`).join(', ')}`)
}

/** 수수료/비율(%) — read-site 들이 0~100 범위만 수용(order-commissions pg_reserve clamp 등). */
function pct(value: string): string | null {
  const n = Number(value)
  if (value.trim() === '' || !Number.isFinite(n)) return '숫자(%)만 허용됩니다'
  if (n < 0 || n > 100) return '0~100 사이 값만 허용됩니다'
  return null
}

/** 금액/개수 — 0 이상 유한 숫자. */
function nonNegNum(value: string): string | null {
  const n = Number(value)
  if (value.trim() === '' || !Number.isFinite(n)) return '숫자만 허용됩니다'
  if (n < 0) return '0 이상이어야 합니다'
  return null
}

function intRange(min: number, max: number): Validator {
  return (value) => {
    const n = Number(value)
    if (value.trim() === '' || !Number.isFinite(n) || !Number.isInteger(n)) return '정수만 허용됩니다'
    if (n < min || n > max) return `${min}~${max} 사이 값만 허용됩니다`
    return null
  }
}

/** 캡 우선 보전 축 — order-commissions.ts 의 요청 축 키(CSV). ''=우선 없음(전 축 비례). */
// 🛑 2026-08-31: 'agency_intro'(에이전시 매장영입 1%) 폐지 — 설정으로도 되살릴 수 없다.
const COMMISSION_AXES = ['affiliate', 'multi_tier']
function priorityAxes(value: string): string | null {
  if (value === '') return null
  const bad = value.split(',').map((s) => s.trim()).filter(Boolean).filter((k) => !COMMISSION_AXES.includes(k))
  return bad.length === 0 ? null : `알 수 없는 축: ${bad.join(', ')} (허용: ${COMMISSION_AXES.join(', ')} — 쉼표 구분, 빈 값=우선 없음)`
}

/** CSV of 양의 정수 (예: seller_ids "1234,5678") — 빈 값 허용(없음). */
function csvPosInts(value: string): string | null {
  if (value.trim() === '') return null
  const bad = value.split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !/^\d+$/.test(s) || Number(s) <= 0)
  return bad.length === 0 ? null : `양의 정수 CSV 여야 함 (잘못된 항목: ${bad.join(', ')})`
}

/**
 * 🥡 **빈 값이 허용되는 %/정수** — 미수령 정책 전용 (2026-08-03).
 *
 * `shared/pickup-refund.ts` 의 `pct()` 는 빈 문자열을 **미설정**으로 보고 소비자에게 유리한
 * 기본값(100% = 전액 환불)으로 되돌린다 — *"값이 없을수록 소비자에게 유리해야 한다"*.
 * 그래서 여기서 `''` 를 거부하면 **어드민이 칸을 비우는 순간 저장 전체가 막힌다.**
 * 위의 `pct`/`intRange` 는 빈 값을 오류로 보므로(등록된 키들은 항상 값이 있는 게 맞다) 재사용하지 않는다.
 */
function optionalPct(value: string): string | null {
  return value.trim() === '' ? null : pct(value)
}
function optionalIntRange(min: number, max: number): Validator {
  const inner = intRange(min, max)
  return (value) => (value.trim() === '' ? null : inner(value))
}
/** 자유 텍스트 — 빈 값 허용, 길이만 제한(실수로 문서를 통째로 붙여넣는 것 방지). */
function optionalText(max: number): Validator {
  return (value) => (value.length <= max ? null : `${max}자 이하여야 합니다`)
}

/** key → 검증 규칙. read-site 주석은 규칙 근거(범위 출처). */
const SETTING_VALIDATORS: Record<string, Validator> = {
  // ── 🥡 미수령 환불 정책 (④-b) — read-site: shared/pickup-refund.ts ──
  //   게이트가 여기 없으면 'True'·'1' 같은 오타가 저장되고 `=== 'true'` 가 조용히 OFF 로 읽는다.
  //   대표가 "켰다"고 믿는 정책이 안 도는 것 — 이 파일이 존재하는 바로 그 이유다.
  pickup_unclaimed_policy_enabled: boolStr,
  pickup_unclaimed_cold_pct: optionalPct,
  pickup_unclaimed_room_pct: optionalPct,
  pickup_unclaimed_room_grace_days: optionalIntRange(0, 365),
  // ── 운영자 문의 연락처 — read-site: features/seller/api/seller-gb.routes.ts ──
  operator_support_contact: optionalText(200),
  // ── boolean 스위치 (read-site === 'true') ──
  commission_budget_enabled: boolStr,          // order-commissions.ts:252
  // 💸 채널별 요율(직접10%/중개5%) 승격 게이트 — read-site: ledger.ts channelPlatformRate.
  //   env 가 아니라 여기 둔 이유: 어드민에서 **재배포 없이** 끌 수 있어야 롤백이 빠르다.
  fee_channel_rates_enabled: boolStr,
  // 💎 2026-08-30 대표 "매장 영입도 딜로 쌓아줘" — 영입 보상을 현금 송금 대신 딜 적립으로.
  //   read-site: cron/influencer-payout.ts (성숙 시점). 기본 OFF = 종전 현금 경로.
  gb_pricing_enabled: boolStr,                 // 🔌 공구가 청구 킬스위치(기본 ON — 'false' 만 끔). gb-order-pricing
  gb_engine_enabled: boolStr,                // gb-marketplace:26 / gb-proposals:27 / seller-orders:1285
  voucher_deal_payment_enabled: boolStr,     // 💰 이용권 딜 결제 (group-buy.routes join). ⚠️ 켜기 전 influencer_deal_bonus_pct=0 — 보너스 20% > 이용권 마진 5~10% 라 팔릴수록 적자
  seller_promo_field_enabled: boolStr,         // seller-orders.routes.ts:814
  settlement_skip_ledgered: boolStr,           // auto-settlement.ts:54 / restaurant-settlement.routes.ts:87
  agency_auto_settle_legacy_enabled: boolStr,  // cron/agency-auto-settle.ts:59

  // ── enum ──
  promo_funding_source: enumOf(['platform', 'owner']),           // ledger.ts:482 등 === 'owner'
  platform_fee_pct_direct: optionalPct,                          // 직접 입점 요율(기본 10) — ledger.ts
  // 💸 2026-08-27 신설: 대행사 경유 요율(기본 5). 그전엔 중개 매장이 `platform_fee_pct` 로 **떨어져서**
  //   맞았는데, 그건 "종전 경로가 마침 5% 다" 라는 전제였고 라이브에서 그 전제가 깨져 있었다
  //   (매장 7곳 전부 `sellers.commission_rate = 10`). 이제 채널별로 각자 값을 갖는다.
  platform_fee_pct_brokered: optionalPct,                        // 대행사 경유 요율(기본 5) — ledger-commission-policy.ts
  commission_priority_axes: priorityAxes,                        // order-commissions.ts:257 CSV parse
  flip_pilot_seller_ids: csvPosInts,                             // flip-pilot.ts (전역 스위치 OFF 여도 지정 매장만 flip 검증)
  influencer_payout_frequency: enumOf(['weekly', 'biweekly', 'monthly']), // AdminCommissionSettingsPage select

  // ── 비율(%) 0~100 ──
  pg_reserve_pct: pct,                 // order-commissions.ts:254 (0~100 clamp)
  commission_rate_default: pct,        // points.routes.ts:31 / fee-resolver 폴백
  commission_rate_live: pct,           // settlement-automation.ts:558
  commission_rate_meal_voucher: pct,   // group-buy helpers.ts:26 / cron/auto-settlement.ts:28
  agency_commission_rate: pct,
  affiliate_commission_rate: pct,      // affiliate-credit.ts:38
  tier1_commission_rate: pct,
  tier2_commission_rate: pct,
  max_influencer_commission_pct: pct,  // marketing.routes.ts:325/375
  influencer_store_intro_pct: pct,     // influencer-store-intro-commission.ts:24
  // 🏪 2026-08-27: 유효기간(개월). 미등록이면 무검증 통과라 '열두달' 같은 값도 저장됐다.
  influencer_store_intro_months: intRange(1, 120), // influencer-store-intro-commission.ts isStoreIntroExpired
  influencer_deal_bonus_pct: pct,      // marketing.routes.ts:679
  curator_affiliate_pct: pct,
  host_incentive_pct: pct,
  curator_withholding_rate: pct,
  platform_margin_pct: pct,            // AdminCommissionSettingsPage (ledger 분배)
  influencer_commission_pct: pct,
  user_referral_bonus_pct: pct,
  agency_commission_pct: pct,
  seller_referral_bonus_pct: pct,      // seller-registration.routes.ts
  platform_fee_pct: pct,               // ledger.ts:132 (v/100)
  seller_commission_pct: pct,          // ledger.ts:132 (v/100)
  agency_share_pct: pct,               // ledger.ts:255 (0<v<1 분수 또는 1~100 % — 둘 다 0~100 안)
  influencer_intro_share_pct: pct,     // ledger.ts:402 (동일)

  // ── 금액/딜/개수 (0 이상) ──
  invite_reward_amount: nonNegNum,                    // invite-reward.ts:69
  invite_reward_monthly_budget_krw: nonNegNum,        // invite-reward.ts:80 (0=무제한)
  agency_signup_bonus_monthly_budget_krw: nonNegNum,  // agency-store-intro-commission.ts:115 (0=무제한)
  min_donation: nonNegNum,
  free_shipping_threshold: nonNegNum,
  default_shipping_fee: nonNegNum,
  jeju_extra_fee: nonNegNum,
  island_extra_fee: nonNegNum,
  review_reward_text: nonNegNum,
  review_reward_image: nonNegNum,
  review_reward_video: nonNegNum,
  influencer_payout_min: nonNegNum,    // cron/influencer-payout.ts:74
  curator_min_withdrawal: nonNegNum,
  seller_upgrade_threshold: nonNegNum,
  pin_max_per_user: nonNegNum,
  hosting_max_active: nonNegNum,
  seller_referral_bonus_months: nonNegNum,
  affiliate_use_mature_min_hours: nonNegNum,          // affiliate-credit.ts §0-1 (0=즉시확정 현행)
  affiliate_referrer_daily_cap_krw: nonNegNum,        // affiliate-credit.ts §0-3 (0=무제한)
  affiliate_referrer_monthly_cap_krw: nonNegNum,      // affiliate-credit.ts §0-3 (0=무제한)

  // ── 일/날짜 ──
  refund_window_days: intRange(0, 365),
  auto_confirm_days: intRange(0, 365),
  return_period_days: intRange(0, 365),
  settlement_hold_days: intRange(0, 365),
  influencer_payout_day_of_month: intRange(1, 31),
}

/**
 * body 전체를 사전 검증 — 첫 위반의 한국어 메시지 반환(없으면 null).
 * 알려지지 않은 키는 검증하지 않음(기존 동작 보존 — pass-through).
 */
export function validatePlatformSettings(body: Record<string, unknown>): string | null {
  for (const [key, raw] of Object.entries(body)) {
    const validator = SETTING_VALIDATORS[key]
    if (!validator) continue
    const err = validator(String(raw))
    if (err) return `${key}: ${err}`
  }
  return null
}
