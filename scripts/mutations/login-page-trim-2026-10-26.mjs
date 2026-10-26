/** 🧬 주입 — 손님 로그인 화면 정리(2026-10-26). 가드: src/tests/unit/login-page-trim-2026-10-26.test.ts */
const T = 'src/tests/unit/login-page-trim-2026-10-26.test.ts'
const F = 'src/pages/LoginPage.tsx'
export default [
  {
    name: '로그인 정리 — 약관 링크를 지운다',
    file: F,
    find: `<Link to="/terms" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">`,
    replace: `<Link to="/" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">`,
    test: T,
    why: '약관 제5조 고지가 사라진다 — 에러가 안 난다.',
  },
  {
    name: '로그인 정리 — 옛 제목(같이 사면)으로 되돌린다',
    file: F,
    find: `t('login.heroTitle2', { defaultValue: '우리 동네 가게, 미리 사면 더 싸게' })`,
    replace: `t('login.heroTitle', { defaultValue: '우리 동네 맛집, 같이 사면 더 싸다' })`,
    test: T,
    why: '없는 공동구매 기제를 첫 화면 제목이 약속한다.',
  },
]
