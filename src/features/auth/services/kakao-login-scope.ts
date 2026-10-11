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

export function kakaoLoginScope(env: { KAKAO_OIDC_ENABLED?: string; KAKAO_CHANNEL_ADD_ENABLED?: string }): string | null {
  if (!env.KAKAO_OIDC_ENABLED) return null
  const scopes: string[] = [...KAKAO_OIDC_SCOPES]
  if (env.KAKAO_CHANNEL_ADD_ENABLED === 'true') scopes.push('plusfriends')
  return scopes.join(',')
}
