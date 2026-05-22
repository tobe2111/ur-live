/**
 * 🛡️ 2026-05-21 정책 중앙화 (single source of truth).
 *
 * 영구 룰 (CLAUDE.md):
 *   - 환불/만료/취소 정책 hardcode 금지
 *   - 항상 본 파일의 상수 import
 *   - 정책 변경 시 본 파일만 수정 → 전체 시스템 자동 반영
 */

export const REFUND_POLICY = {
  /** 예약 (appointment) 노쇼 자동 알림 — 시작 시간 후 N분 */
  APPOINTMENT_NOSHOW_ALERT_MIN: 30,

  /** 예약 취소 환불 마감 — 시작 N시간 이내 취소 시 환불 X */
  APPOINTMENT_CANCEL_DEADLINE_HOURS: 12,

  /** Voucher 만료 후 자동 환불 — 만료 N일 이내까지 */
  VOUCHER_REFUND_AFTER_EXPIRY_DAYS: 7,

  /** 미사용 voucher 만료 후 archive — N일 */
  VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS: 365,

  /** 분쟁 24시간 미처리 → admin escalation */
  DISPUTE_ESCALATION_HOURS: 24,

  /** 매장 30일 분쟁 N건+ → 재발 매장 경고 */
  DISPUTE_REPEAT_STORE_THRESHOLD: 5,

  /** 사용자 30일 분쟁 N건+ → 어뷰징 의심 */
  DISPUTE_REPEAT_USER_THRESHOLD: 3,

  /** 토스 환불 재시도 최대 횟수 */
  TOSS_REFUND_MAX_RETRY: 5,

  /** 최소 commission 출금 금액 (KRW) */
  COMMISSION_MIN_WITHDRAWAL: 10_000,
} as const

export const COMMISSION_DEFAULTS = {
  /** 플랫폼 fee % — platform_settings.platform_fee_pct 미설정 시 fallback */
  PLATFORM_FEE_PCT: 5,

  /** 위탁 판매 셀러 commission % */
  SELLER_COMMISSION_PCT: 10,

  /** 에이전시 입점 분배 % (platform_fee 중) */
  AGENCY_SHARE_PCT: 30,

  /** 인플루언서 입점 분배 % (platform_fee 중) */
  INFLUENCER_INTRO_SHARE_PCT: 20,

  /** 에이전시 본인 commission % (매출 기준) */
  AGENCY_OWN_RATE: 2.0,

  /** 셀러 등급별 보너스 */
  TIER_COMMISSION_BONUS: { bronze: 0, silver: 1, gold: 2, platinum: 3 } as Record<string, number>,

  /** 제휴 마케팅 추천인 보상 % (platform_settings.affiliate_commission_rate 미설정 시 fallback) */
  AFFILIATE_COMMISSION_PCT: 5,

  /** 공구 동시 추천 (양쪽 보너스) — 추천인/피추천인 각각 받는 % */
  REFERRAL_BONUS_BOTHSIDES_PCT: 0.5,

  /** 숙박 등 외부 카테고리 commission 상한 (%) — exploding rate 방지 */
  STAYS_COMMISSION_CAP_PCT: 20,
} as const

export const TAX_POLICY = {
  /** 사업소득 (default — 반복 활동) */
  BUSINESS_INCOME_RATE: 0.033,
  /** 기타소득 (단발성) */
  OTHER_INCOME_RATE: 0.088,
  /** 기타소득 연 누계 분리과세 한도 (KRW) */
  OTHER_INCOME_THRESHOLD: 3_000_000,
} as const
