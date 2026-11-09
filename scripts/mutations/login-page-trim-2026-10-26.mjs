/** 🧬 주입 — 손님 로그인 화면 정리(2026-10-26). 가드: src/tests/unit/login-page-trim-2026-10-26.test.ts */
const T = 'src/tests/unit/login-page-trim-2026-10-26.test.ts'
const F = 'src/pages/LoginPage.tsx'
export default [
  {
    name: '로그인 정리 — 약관 링크를 지운다',
    file: F,
    find: `<Link to="/terms" className={LOGIN_CLS.termsLink}>`, // 2026-11-09 클래스가 상수(LOGIN_CLS)로 옮겨가 앵커 재조준
    replace: `<Link to="/" className={LOGIN_CLS.termsLink}>`,
    test: T,
    why: '약관 제5조 고지가 사라진다 — 에러가 안 난다.',
  },
  {
    name: '로그인 정리 — 옛 제목(같이 사면)으로 되돌린다',
    file: F,
    find: `t('login.heroTitle2', { defaultValue: LOGIN_COPY.heroTitle })`, // 2026-11-09 문구가 LOGIN_COPY 로
    replace: `t('login.heroTitle', { defaultValue: '우리 동네 맛집, 같이 사면 더 싸다' })`,
    test: T,
    why: '없는 공동구매 기제를 첫 화면 제목이 약속한다.',
  },
]
