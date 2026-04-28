/**
 * 시간 상수 — magic numbers 제거.
 *
 * 코드에 86400_000 / 60 / 1000 같은 raw 숫자 대신 의미 있는 이름 사용.
 *
 * @example
 *   setTimeout(refresh, ONE_MINUTE_MS)
 *   const expiresAt = Date.now() + 24 * ONE_HOUR_MS
 *   const daysSince = elapsedMs / ONE_DAY_MS
 */

// ── 기본 단위 ──────────────────────────────────────────────────────
export const ONE_SECOND_MS = 1_000;
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const ONE_WEEK_MS = 7 * ONE_DAY_MS;
export const ONE_MONTH_MS = 30 * ONE_DAY_MS; // 근사치 (실제 월 길이 다름)

// ── 자주 쓰는 polling 간격 ─────────────────────────────────────────
export const POLL_3_SEC = 3 * ONE_SECOND_MS;        // 경매 / 라이브 채팅
export const POLL_30_SEC = 30 * ONE_SECOND_MS;      // 알림 / 라이브 상태
export const POLL_1_MIN = ONE_MINUTE_MS;            // 일반 데이터 새로고침
export const POLL_5_MIN = 5 * ONE_MINUTE_MS;        // 통계 / 대시보드

// ── 인증 / 세션 TTL ────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL_MS = 60 * ONE_MINUTE_MS;        // 1시간
export const REFRESH_TOKEN_TTL_MS = 14 * ONE_DAY_MS;          // 14일
export const PIN_VERIFICATION_TTL_MS = 15 * ONE_MINUTE_MS;    // 15분
export const SESSION_COOKIE_TTL_MS = 30 * ONE_DAY_MS;         // 30일
export const KAKAO_STEPUP_TTL_MS = 15 * ONE_MINUTE_MS;        // 15분

// ── Cache TTL ──────────────────────────────────────────────────────
export const CACHE_SHORT_TTL_S = 60;              // 1분
export const CACHE_MEDIUM_TTL_S = 5 * 60;         // 5분
export const CACHE_LONG_TTL_S = 60 * 60;          // 1시간
export const CACHE_DAY_TTL_S = 24 * 60 * 60;      // 1일

// ── 비즈니스 로직 ──────────────────────────────────────────────────
export const ORDER_AUTO_CONFIRM_DAYS = 7;         // 7일 후 자동 확정
export const REFUND_WINDOW_DAYS = 7;              // 7일 환불 가능
export const VOUCHER_DEFAULT_EXPIRY_DAYS = 90;    // 식사권 90일
export const SETTLEMENT_PROCESSING_DAYS = 5;      // 정산 영업일 5일
