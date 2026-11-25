/**
 * 로그인 콜백이 `?error=코드` 로 돌아왔을 때 손님에게 보여 줄 문구.
 *
 * 🪶 2026-11-25 — `App.tsx` 안에 있던 표를 여기로 옮겼다. 그 표는 **모든 화면의 첫 코드**(index 묶음)에 실려 있었는데
 *   실제로 쓰이는 것은 로그인이 실패해 돌아온 드문 순간뿐이다. 토스트 모듈과 같이 그때만 불러온다(첫 화면 무게 −).
 *   같은 날 문구 한 줄(`email_already_linked`)을 더한 것이 소개 화면의 무게 예산을 넘겼다 — 올리는 대신 내렸다.
 * ⚠️ 흔적 정리에 쓰는 코드 목록(`authErrors`)은 `App.tsx` 에 남긴다 — 그건 즉시 돌아야 한다(늦으면 보호 경로가 옛 흔적으로 통과한다).
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  session_cookie_failed: '로그인 세션 발급에 실패했어요. 다시 시도해주세요.',
  kakao_auth_failed: '카카오 인증에 실패했어요. 다시 시도해주세요.',
  kakao_sync_failed: '카카오 로그인에 일시적 문제가 발생했어요. 다시 시도해주세요.',
  database_error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
  firebase_config_error: '인증 설정 오류가 발생했어요. 관리자에게 문의해주세요.',
  env_missing: '서버 환경 설정이 누락됐어요. 관리자에게 문의해주세요.',
  no_code: '카카오 인증 코드를 받지 못했어요. 다시 시도해주세요.',
  oauth_state_mismatch: '인증 정보가 만료됐어요. 다시 시도해주세요.',
  oauth_state_expired: '로그인 세션이 만료됐어요. 처음부터 다시 시도해주세요.',
  // 🚪 2026-11-25: 카카오 계정의 이메일이 이미 다른 방법으로 가입돼 있을 때 — 종전엔 "서버 오류" 로 보였다(다시 해도 같은 결과).
  email_already_linked: '이 이메일로 이미 가입한 계정이 있어요. 로그인 화면의 "이메일로 로그인"(또는 처음 가입한 방법)으로 들어와 주세요.',
  // 🌏 2026-11-18 구글 로그인(외국인 손님만 보는 버튼) — 그 손님이 읽을 말이라 영어로 둔다.
  email_in_use_kakao: 'This email is already registered with Kakao. Please continue with Kakao.',
  email_in_use: 'This email is already registered. Please log in with your email and password.',
  google_auth_failed: 'Google sign-in failed. Please try again.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_unavailable: 'Google sign-in is not available right now.',
}

export function oauthErrorMessage(code: string): string {
  return OAUTH_ERROR_MESSAGES[code] || `로그인 중 오류가 발생했어요 (${code})`
}
