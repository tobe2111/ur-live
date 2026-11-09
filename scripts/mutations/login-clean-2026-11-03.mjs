/** 🧬 주입 — 로그인 A안 (2026-11-03) */
const T = 'src/tests/unit/login-clean-2026-11-03.test.ts'
const F = 'src/pages/LoginPage.tsx'
export default [
  { name: '로그인A — 에이전시 단독 줄이 기본 화면에도 다시 선다', file: F, find: '{(showEmailLogin || showForgotPassword) && <div className="mt-10 pt-5 border-t', replace: '{true && <div className="mt-10 pt-5 border-t', test: T, why: '에이전시 로그인이 한 화면에 두 번 보인다.' },
  { name: '로그인A — 버튼 문구가 옛 문구로', file: F, find: "t('login.kakaoStart', { defaultValue: LOGIN_COPY.kakaoStart })", replace: "t('auth.kakaoQuickStart')", test: T, why: '군더더기 문구(3초 만에)가 돌아온다.' },
]
