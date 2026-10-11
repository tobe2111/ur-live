/**
 * 🏢 에이전시로 모은 '대신 등록' 길의 안내 문구 — 서버(410 응답)와 등록 모달이 **같은 문장**을 쓴다.
 *   2026-10-11 대표 *"모두 다 하자"* (결재 `docs/decisions/2026-10-11-agency-ideal-open-questions.md` 안 1).
 *   스위치는 `feature-flags.ts` `PERSONAL_BROKER_SIGNUP_DISABLED`.
 */
export const BROKERED_VIA_AGENCY_MSG =
  '다른 사장님 매장을 대신 등록·운영하는 일은 이제 에이전시 계정(이메일)으로 해요. 에이전시로 가입하면 [매장 대신 등록]이 있어요.'

/** 안내에서 보낼 곳 — 에이전시 가입 화면. */
export const AGENCY_SIGNUP_PATH = '/agency/signup'
