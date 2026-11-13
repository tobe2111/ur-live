/** 🧬 주입 — 로그인 복귀 구매 창 (2026-11-13) · 가드: src/tests/unit/login-resume-buy-2026-11-13.test.ts */
const T = 'src/tests/unit/login-resume-buy-2026-11-13.test.ts'
export default [
  { name: 'resumebuy: 복귀 주소에 수량이 빠진다', file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "localStorage.setItem('loginReturnUrl', `${window.location.pathname}?via=login&qty=${quantity}`)",
    replace: "localStorage.setItem('loginReturnUrl', window.location.pathname)", test: T,
    why: '로그인하고 돌아온 손님이 구매를 또 누르고 수량을 또 골라야 한다.' },
  { name: 'resumebuy: 공용 규칙이 수량을 버린다', file: 'src/shared/login-return-query.ts',
    find: "export const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto', 'via', 'qty'] as const",
    replace: "export const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto', 'via'] as const", test: T,
    why: '로그인 왕복에서 수량이 사라져 구매 창이 1장으로 열린다.' },
  { name: 'resumebuy: 워커가 다시 자기 복사본을 둔다', file: 'src/features/auth/api/kakao.routes.ts',
    find: "  return isSafeInternalPathname(path) ? path + preserved : '/';",
    replace: "  const FORBIDDEN = ['/login', '/seller/login', '/admin/login', '/agency/login', '/auth/', '/oauth/'];\n  for (const prefix of FORBIDDEN) { if (path.startsWith(prefix)) return '/'; }\n  return path + preserved;", test: T,
    why: '같은 규칙이 두 벌이 되어 한쪽만 고치면 카카오 로그인만 값을 잃는다(2026-09-20 · 2026-11-13 두 번 겪었다).' },
  { name: 'resumebuy: 로그인 복귀에 비서 문구가 뜬다', file: 'src/pages/group-buy/useAgentHandoff.ts',
    find: "    setFromAgent(!login)", replace: "    setFromAgent(true)", test: T,
    why: "로그인하고 돌아온 손님에게 'AI 비서가 고른 수량이에요' 라는 엉뚱한 문구가 뜬다." },
]
