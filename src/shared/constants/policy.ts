/**
 * 🛡️ 유어딜 정책 SSOT (single source of truth) — 모든 정책 한 페이지.
 *
 * 영구 룰 (CLAUDE.md):
 *   ① 환불/만료/수수료/세금 hardcode 금지 → 항상 본 파일 import.
 *   ② 정책 변경 시 본 파일만 수정 → 전체 시스템 자동 반영.
 *   ③ 신규 매직 넘버 생기면 본 파일 적절 섹션에 추가.
 *
 * ── INDEX ───────────────────────────────────────────────────────
 *  ① REFUND_POLICY       — 환불 / 만료 / 분쟁 / 출금
 *  ② COMMISSION_DEFAULTS — 수수료율 (플랫폼/셀러/에이전시/제휴/추천)
 *  ③ TAX_POLICY          — 원천징수율 + 임계값 (사업소득/기타소득)
 *  ④ TIME_CONSTANTS      — 폴링 / dedup / threshold (초 단위)
 *  ⑤ SELLER_ROLES        — `src/shared/seller-roles.ts` (역할 helper)
 *  ⑥ WITHHOLDING_RATES   — `src/worker/utils/tax-withholding.ts` (재내보내기)
 *  ⑦ DB 스키마            — `src/shared/db/production-schema.ts`
 *  ⑧ 동적 정책 (어드민)    — DB 테이블 `platform_settings` (key/value)
 * ────────────────────────────────────────────────────────────────
 */

// ── ① 환불 / 만료 / 분쟁 / 출금 ────────────────────────────────
export const REFUND_POLICY = {
  /** 예약 (appointment) 노쇼 자동 알림 — 시작 시간 후 N분 */
  APPOINTMENT_NOSHOW_ALERT_MIN: 30,

  /** 예약 취소 환불 마감 — 시작 N시간 이내 취소 시 환불 X */
  APPOINTMENT_CANCEL_DEADLINE_HOURS: 12,

  /** Voucher 만료 후 자동 환불 마감 — 만료 N일 이내 */
  VOUCHER_REFUND_AFTER_EXPIRY_DAYS: 7,

  /** 미사용 voucher 만료 후 archive — N일 */
  VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS: 365,

  /** 분쟁 N시간 미처리 → admin escalation */
  DISPUTE_ESCALATION_HOURS: 24,

  /** 30일 분쟁 N건+ → 재발 매장 경고 */
  DISPUTE_REPEAT_STORE_THRESHOLD: 5,

  /** 30일 분쟁 N건+ → 어뷰징 의심 사용자 */
  DISPUTE_REPEAT_USER_THRESHOLD: 3,

  /** 토스 환불 재시도 최대 횟수 (지수 backoff) */
  TOSS_REFUND_MAX_RETRY: 5,

  /** 최소 commission 출금 금액 (KRW) */
  COMMISSION_MIN_WITHDRAWAL: 10_000,
} as const

// ── ② 수수료율 (% 단위 — 코드에서 / 100 후 사용) ─────────────────
export const COMMISSION_DEFAULTS = {
  /** 플랫폼 fee — `platform_settings.platform_fee_pct` 미설정 시 fallback */
  PLATFORM_FEE_PCT: 5,

  /** 위탁 판매 셀러 commission */
  SELLER_COMMISSION_PCT: 10,

  /** 에이전시 입점 분배 (platform_fee 중) */
  AGENCY_SHARE_PCT: 30,

  /** 인플루언서 입점 분배 (platform_fee 중) */
  INFLUENCER_INTRO_SHARE_PCT: 20,

  /** 에이전시 본인 commission (매출 기준) */
  AGENCY_OWN_RATE: 2.0,

  /** 셀러 등급별 보너스 (% 가산) */
  TIER_COMMISSION_BONUS: { bronze: 0, silver: 1, gold: 2, platinum: 3 } as Record<string, number>,

  /** 제휴 마케팅 추천인 보상 — `platform_settings.affiliate_commission_rate` 미설정 시 fallback */
  AFFILIATE_COMMISSION_PCT: 5,

  /** 공구 양쪽 보너스 (추천인 + 피추천인 각각 %) */
  REFERRAL_BONUS_BOTHSIDES_PCT: 0.5,

  /** 숙박 등 외부 카테고리 commission 상한 — exploding rate 방지 */
  STAYS_COMMISSION_CAP_PCT: 20,
} as const

// ── ③ 원천징수율 + 세무 임계값 ──────────────────────────────────
// ⚠️ default 3.3% (사업소득 — 반복 활동, 대부분 인플루언서).
//    8.8% 는 기타소득 (단발성 협업) 만. 동적 적용 — `sellers.tax_type` 컬럼 기반.
//    실제 적용 로직: `src/worker/utils/tax-withholding.ts:withholdAndLog`
export const TAX_POLICY = {
  /** 사업소득 (반복 활동 — 대부분 인플루언서) — ratio (3.3% = 0.033) */
  BUSINESS_INCOME_RATE: 0.033,
  /** 기타소득 (단발성 협업) — ratio (8.8% = 0.088) */
  OTHER_INCOME_RATE: 0.088,
  /** 기타소득 연 누계 분리과세 한도 (KRW). 초과 시 종합소득 합산. */
  OTHER_INCOME_THRESHOLD: 3_000_000,
} as const

// 재내보내기 — tax-withholding 의 WITHHOLDING_RATES 도 본 파일에서 import 가능.
//   사용: `import { WITHHOLDING_RATES } from '@/shared/constants/policy'`
export { WITHHOLDING_RATES } from '../../worker/utils/tax-withholding'

// ── ④ 시간 상수 (초 단위 — ms 필요 시 * 1000) ────────────────────
export const TIME_CONSTANTS = {
  /** Discord/Slack alert dedup window — 같은 (title, severity) 재발송 차단 */
  ALERT_DEDUP_DEFAULT_SEC: 300,

  /** YouTube 라이브 status 폴링 간격 (cron 보조) */
  YOUTUBE_LIVE_POLL_SEC: 120,

  /** 라이브 임박 알림 threshold (시작 N초 전) */
  LIVE_IMMINENT_THRESHOLD_SEC: 60,

  /** PWA 설치 prompt dismiss 만료 */
  PWA_DISMISS_DAYS: 7,

  /** 추천 attribution sessionStorage TTL */
  REFERRAL_ATTRIBUTION_HOURS: 24,

  /** rate_limit_attempts window — 1분 */
  RATE_LIMIT_WINDOW_SEC: 60,

  /** 5xx 스파이크 detection threshold (1분 내 N건) */
  ERROR_SPIKE_THRESHOLD: 10,
} as const
