/**
 * 소개 링크 유효기간(시간) — 2026-10-11 대표 "유효기간 24시간으로 해줘. 7일말고."
 *
 * ⚠️ 이 값이 `shared/constants/policy.ts` 가 아니라 여기 있는 이유: 이 값을 읽는
 *   `utils/affiliate-ref-store.ts` 를 `lib/api.ts`(엔트리)가 import 한다. policy.ts 를 거치면
 *   `app-constants` 청크 하나가 통째로 첫 페인트에 끌려온다(check-critical-chunks 가 잡았다).
 *   `policy.ts` 의 `CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS` 는 이 값을 그대로 다시 내보낸다 — 값은 여기 한 곳.
 */
export const REFERRAL_TTL_HOURS = 24
