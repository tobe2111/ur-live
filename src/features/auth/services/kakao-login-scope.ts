/**
 * 🔑 카카오 로그인 동의 항목(scope) — 한 곳에서 정한다 (2026-10-11 대표 "로그인할 때 채널 추가" 진행)
 *
 * - `KAKAO_OIDC_ENABLED` 켜짐 → 동의 항목을 **명시**한다(id_token 으로 사용자정보 왕복 1회 생략, 2026-06-20).
 * - `KAKAO_CHANNEL_ADD_ENABLED` 켜짐 → 그 목록에 `plusfriends`(카카오톡 채널 추가 상태 및 내역)를 더한다.
 *   그러면 로그인 동의 화면에 **유어딜 채널 추가** 체크가 함께 뜨고, 동의하면 가입과 동시에 채널 친구가 된다.
 *
 * ⚠️ 채널 플래그는 **카카오 개발자 콘솔 설정을 마친 뒤에만** 켠다. 콘솔에 `plusfriends` 동의항목이 없는데
 *   요청하면 카카오가 로그인 자체를 거부한다(KOE205) — 로그인 전체가 막힌다. 그래서 기본 OFF 다.
 *   콘솔 순서: 비즈 앱 전환 → 비즈니스 채널 전환 → 앱에 채널 연결 → 대표 채널 지정 → 동의항목에서
 *   '카카오톡 채널 추가 상태 및 내역' 을 선택 동의로 설정. (developers.kakao.com/docs/ko/kakaotalk-channel/common)
 *
 * 반환값이 null 이면 scope 를 보내지 않는다 — 그때 카카오는 콘솔에 설정된 동의항목을 전부 보여준다.
 */
export const KAKAO_OIDC_SCOPES = ['openid', 'account_email', 'profile_nickname', 'profile_image'] as const

export type KakaoScopeEnv = {
  KAKAO_OIDC_ENABLED?: string
  KAKAO_CHANNEL_ADD_ENABLED?: string
  /** 📞 2026-11-04 대표 "최대한 받자" — 콘솔에서 '카카오계정(전화번호)' 검수 승인 **뒤에만** 'true'. 전에 켜면 KOE205 로 로그인이 막힌다. */
  KAKAO_PHONE_SCOPE_ENABLED?: string
  /** 📣 2026-11-04 카카오싱크 약관 태그(쉼표) — 동의 화면에 띄울 약관. 콘솔 '약관 관리' 에 등록한 태그 그대로. 비우면 안 보낸다. */
  KAKAO_SERVICE_TERMS?: string
  /** 📣 그중 '마케팅 정보 수신(선택)' 약관의 태그 — 손님이 동의하면 terms_agreements 에 marketing 으로 남긴다. */
  KAKAO_MARKETING_TERM_TAG?: string
}

export function kakaoLoginScope(env: KakaoScopeEnv): string | null {
  if (!env.KAKAO_OIDC_ENABLED) return null
  const scopes: string[] = [...KAKAO_OIDC_SCOPES]
  if (env.KAKAO_CHANNEL_ADD_ENABLED === 'true') scopes.push('plusfriends')
  if (env.KAKAO_PHONE_SCOPE_ENABLED === 'true') scopes.push('phone_number')
  return scopes.join(',')
}

/**
 * 📞 id_token(OIDC)에는 **전화번호가 없다** — 번호를 받기로 했으면 사용자정보 API 를 한 번 더 부른다(0.2~0.3초).
 * 꺼져 있으면 종전 그대로 id_token 빠른 길.
 */
export function kakaoNeedsUserInfo(env: KakaoScopeEnv): boolean {
  return env.KAKAO_PHONE_SCOPE_ENABLED === 'true'
}

/** 카카오싱크 동의 화면에 띄울 약관 태그(`service_terms` 파라미터) — 없으면 null(파라미터를 안 붙인다). */
export function kakaoServiceTermsParam(env: KakaoScopeEnv): string | null {
  const tags = (env.KAKAO_SERVICE_TERMS || '').split(',').map((t) => t.trim()).filter((t) => /^[A-Za-z0-9_.-]{1,50}$/.test(t))
  return tags.length ? tags.join(',') : null
}
export { recordKakaoMarketingConsent } from './kakao-marketing-consent' // 📣 2026-11-04 — 로그인 라우트가 import 한 줄로 쓰게
