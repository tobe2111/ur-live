/** 🧬 주입 — 로그인 복귀 구매 창 (2026-11-13) · 가드: src/tests/unit/login-resume-buy-2026-11-13.test.ts */
const T = 'src/tests/unit/login-resume-buy-2026-11-13.test.ts'
export default [
  { name: 'resumebuy: 복귀 주소에 수량이 빠진다', file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "localStorage.setItem('loginReturnUrl', `${window.location.pathname}?via=login&qty=${quantity}`)",
    replace: "localStorage.setItem('loginReturnUrl', window.location.pathname)", test: T,
    why: '로그인하고 돌아온 손님이 구매를 또 누르고 수량을 또 골라야 한다.' },
  { name: 'resumebuy: 카카오 왕복이 표식을 지운다', file: 'src/features/auth/api/kakao.routes.ts',
    find: "const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto', 'via', 'qty'] as const;",
    replace: "const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto'] as const;", test: T,
    why: '프론트만 보존하고 서버가 지워 실제 카카오 로그인 뒤엔 창이 안 열린다.' },
  { name: 'resumebuy: 로그인 복귀에 비서 문구가 뜬다', file: 'src/pages/group-buy/useAgentHandoff.ts',
    find: "    setFromAgent(!login)", replace: "    setFromAgent(true)", test: T,
    why: "로그인하고 돌아온 손님에게 'AI 비서가 고른 수량이에요' 라는 엉뚱한 문구가 뜬다." },
]
