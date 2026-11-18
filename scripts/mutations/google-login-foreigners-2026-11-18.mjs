// 🌏 2026-11-18 — 외국인 손님 구글 로그인의 주입 매니페스트.
//   가드: src/tests/unit/google-login-foreigners-2026-11-18.test.tsx
const T = 'src/tests/unit/google-login-foreigners-2026-11-18.test.tsx'
const S = 'src/features/auth/services/google-oauth.ts'
const R = 'src/features/auth/api/google.routes.ts'
export default [
  { name: 'google: aud 를 안 본다', file: S, test: T,
    find: '  if (!audOk) return null\n', replace: '',
    why: '다른 앱용으로 발급된 구글 토큰으로 우리 회원 계정에 들어온다.' },
  { name: 'google: iss 를 안 본다', file: S, test: T,
    find: "  if (typeof payload.iss !== 'string' || !(GOOGLE_ISSUERS as readonly string[]).includes(payload.iss)) return null\n", replace: '',
    why: '구글이 아닌 곳이 낸 토큰을 믿는다.' },
  { name: 'google: 만료를 안 본다', file: S, test: T,
    find: '  if (!Number.isFinite(exp) || exp <= nowSec) return null\n', replace: '',
    why: '만료된 토큰이 계속 로그인이 된다.' },
  { name: 'google: 이메일 미확인을 받는다', file: S, test: T,
    find: "  if (!(payload.email_verified === true || payload.email_verified === 'true')) return null\n", replace: '',
    why: '확인 안 된 이메일로 가입해 남의 이메일 주소를 선점한다.' },
  { name: 'google: 같은 이메일 카카오 회원에 자동 연결', file: S, test: T,
    find: "    return { kind: 'email_in_use', via: owner.kakao_id ? 'kakao' : 'other' }",
    replace: "    return { kind: 'existing', user: toLoginUser(owner) }",
    why: '이메일만 같으면 남의 카카오 계정을 구글 계정 하나로 가져간다(카카오 EMAIL_ALREADY_LINKED 와 같은 클래스).' },
  { name: 'google: state 를 안 본다', file: R, test: T,
    find: "  if (!state) return c.redirect(loginErrorPath('oauth_state_expired', '/'), 302)",
    replace: "  if (!state && false) return c.redirect(loginErrorPath('oauth_state_expired', '/'), 302)",
    why: 'CSRF — 남이 만든 code 로 손님 브라우저를 공격자 계정에 로그인시킨다.' },
  { name: 'google: 자격 없이도 켜졌다고 답한다', file: S, test: T,
    find: '  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim() && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CLIENT_SECRET.trim())',
    replace: '  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim())',
    why: '시크릿이 없는데 버튼이 떠서 누르면 항상 실패한다.' },
  { name: 'google: 한국어 기기에도 버튼', file: 'src/components/auth/GoogleLoginButton.tsx', test: T,
    find: "  return !l.startsWith('ko')", replace: '  return true',
    why: '한국어 손님의 로그인 화면이 바뀌고 요청이 하나 는다(대표 결정: 외국어 기기만).' },
]
