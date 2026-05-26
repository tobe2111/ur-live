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

  /** 큐레이터 핀 어필리에이트 % — 큐레이터에게만 적립 (피구매자 X).
   *  BOTHSIDES 0.5 와 별도. products.referral_commission_rate 가 있으면 그쪽 우선.
   *  2026-05-25 도입: 사용자 결정 — 링크샵 핀 단독 비율. */
  CURATOR_AFFILIATE_PCT: 1.0,

  /** 숙박 등 외부 카테고리 commission 상한 — exploding rate 방지 */
  STAYS_COMMISSION_CAP_PCT: 20,
} as const

// ── ⑪ 호스팅 + 정산 (migration 0280, 2026-05-25) ────────────────
//   Phase 3 — 누구나 voucher 공구 호스팅. host_user_id 별 모집.
//   Phase 4 — 큐레이터 → 셀러 자동 승급 안내 (누적 평생 정산액 기반).
export const HOSTING_DEFAULTS = {
  /** 호스트 인센티브 % — 친구가 본 호스트의 공구 참여 시 호스트 적립. */
  HOST_INCENTIVE_PCT: 1.0,
  /** 호스트당 모집 가능 동시 공구 수 — 스팸 방지 */
  MAX_ACTIVE_HOSTINGS: 10,
  /** 호스트 모집 기본 기간 (일) */
  DEFAULT_DEADLINE_DAYS: 7,
  /** 호스트 본인 목표 최소 / 최대 인원 */
  MIN_TARGET: 2,
  MAX_TARGET: 100,
  /** 호스트 노트 최대 길이 */
  NOTE_MAX_LEN: 200,
  /** invite_code 길이 (hex) */
  INVITE_CODE_LEN: 8,
} as const

export const WITHDRAWAL_DEFAULTS = {
  /** 출금 최소 금액 (KRW) — 재정의 (기존 COMMISSION_MIN_WITHDRAWAL=10000 과 동일, 명시 SSOT) */
  MIN_AMOUNT: 10_000,
  /** 큐레이터 → 셀러 승급 권유 threshold (누적 평생 정산) */
  SELLER_UPGRADE_THRESHOLD: 500_000,
  /** 승급 안내 cooldown (일) — 거절 후 N일 재안내 */
  UPGRADE_REOFFER_DAYS: 30,
} as const

// ── ⑩ 배송 재설계 (migration 0279, 2026-05-25) ──────────────────
//   기존 calculateShippingFee (subtotal, baseFee, freeThreshold) 는 V1 — deprecated 안 함.
//   신규 calculateShippingFeeV2 가 본 정책 + regional_shipping_fees 테이블 사용.
//
//   배송 추적 3중 안전망:
//     1. tracker.delivery GraphQL (무료, https://apis.tracker.delivery/graphql)
//     2. 외부 페이지 URL fallback (택배사별 매핑)
//     3. cron sync 6시간 + 14일→7일 추정 fallback
export const SHIPPING_DEFAULTS = {
  /** 제주 추가 배송비 (KRW) — 기본값. regional_shipping_fees 가 SSOT. */
  JEJU_EXTRA_FEE: 3000,
  /** 도서산간 추가 배송비 (KRW) — 기본값. */
  ISLAND_EXTRA_FEE: 5000,
  /** 배송 후 자동 DELIVERED 추정 일수 — 추적 시스템이 동작하면 무시. */
  AUTO_DELIVERED_AFTER_DAYS: 7,
  /** tracker.delivery sync 주기 (시간) — cron 에서 사용. */
  TRACKER_SYNC_INTERVAL_HOURS: 6,
  /** tracker.delivery API endpoint */
  TRACKER_DELIVERY_API: 'https://apis.tracker.delivery/graphql',
  /** tracker.delivery sync 최대 동시 호출 수 (rate limit 보호) */
  TRACKER_SYNC_BATCH_SIZE: 50,
  /** SHIPPING 상태 orders 가 sync 대상 — 마지막 sync 후 N분 지나야 재시도. */
  TRACKER_SYNC_MIN_INTERVAL_MIN: 60,
  /** 합배송 도입 — Phase 6 까지 false. 활성화 시 products.bundling_key 필요. */
  ENABLE_BUNDLING: false,
} as const

// ── ⑨ 큐레이터 링크샵 (migration 0278, 2026-05-25) ──────────────
//   handle 정책 / 핀 상한 / 충돌 suffix 정책 SSOT.
//   변경 시 본 상수만 수정 → 백엔드 + 클라이언트 자동 반영.
export const CURATOR_DEFAULTS = {
  /** 핸들 최소 길이 — UX/SEO 최소치 */
  HANDLE_MIN_LEN: 3,
  /** 핸들 최대 길이 — URL/공유 가독성 */
  HANDLE_MAX_LEN: 30,
  /** 핸들 정규식 — 소문자 영숫자 + underscore. 한글/하이픈/대문자 금지 (URL 안전 + 변별성). */
  HANDLE_PATTERN: /^[a-z0-9_]{3,30}$/,
  /** 핸들 예약어 — 시스템 라우트와 충돌 방지. URL `/u/admin` 같은 case 차단. */
  HANDLE_RESERVED: [
    'admin', 'api', 'auth', 'me', 'login', 'logout', 'signup', 'help', 'support',
    'seller', 'agency', 'staff', 'official', 'urteam', 'urdeal', 'live',
    'shop', 'browse', 'cart', 'checkout', 'order', 'orders', 'product', 'products',
    'curator', 'pin', 'pins', 'earnings', 'wallet', 'points', 'voucher', 'vouchers',
    'about', 'terms', 'privacy', 'contact', 'faq', 'guide',
  ] as readonly string[],
  /** 1 큐레이터당 최대 핀 개수 — DB 비대 방지 + UI 페이지네이션 회피. */
  PIN_MAX_PER_USER: 200,
  /** 핀 노트 (큐레이터 한 줄) 최대 길이 */
  PIN_NOTE_MAX_LEN: 200,
  /** 핸들 변경 cooldown (일) — 어뷰징 + SEO 안정 */
  HANDLE_CHANGE_COOLDOWN_DAYS: 30,
  /** Bio 최대 길이 */
  BIO_MAX_LEN: 160,
  /** 핀 stats 기본 조회 기간 (일) */
  STATS_DEFAULT_RANGE_DAYS: 7,
  /** ref 쿠키 TTL (시간) — 기존 affiliate_ref 24h 와 동일. */
  REF_COOKIE_TTL_HOURS: 24,
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
