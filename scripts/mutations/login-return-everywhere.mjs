/**
 * 🧭 로그인 복귀 — 전수 공식 (2026-10-01, 대표 "모든 경우의 수에 적용이 되어야 … 당연한 공식")
 * 가드: src/tests/unit/login-return-everywhere-2026-10-01.test.ts
 */
const TEST = 'src/tests/unit/login-return-everywhere-2026-10-01.test.ts'

export default [
  {
    name: '🧭 결제(체크아웃) 로그인 유도가 복귀를 다시 안 남긴다',
    file: 'src/pages/CheckoutPage.tsx',
    find: 'navigateToLogin={() => navigate(loginPathFromHere())}',
    replace: "navigateToLogin={() => navigate('/login')}",
    test: TEST,
    why: '돈 내려던 사람이 로그인 후 홈으로 떨어진다 — 이 공식이 생긴 이유 그 자체.',
  },
  {
    name: '🧭 세션 만료 리다이렉트가 복귀를 다시 안 남긴다',
    file: 'src/shared/utils/auth-api.ts',
    find: "  // Redirect\n  window.location.href = loginPathFromHere();",
    replace: "  // Redirect\n  window.location.href = '/login';",
    test: TEST,
    why: '작업 중 세션이 끊긴 사람을 홈으로 보낸다 — 하던 일이 통째로 사라진다.',
  },
  {
    name: '🧭 헬퍼가 외부 URL 에도 복귀를 붙인다 (오픈 리다이렉트)',
    file: 'src/utils/login-return.ts',
    find: "  return safe === '/' ? '/login' : `/login?returnUrl=${encodeURIComponent(safe)}`",
    replace: '  return `/login?returnUrl=${encodeURIComponent(raw)}`',
    test: TEST,
    why: 'safeInternalPath 를 건너뛰면 외부 URL 이 복귀 주소가 된다.',
  },
  {
    name: '🧭 전수 가드가 고쳐진 자리를 못 보게 만든다 (탐지 축소)',
    file: TEST,
    find: "      if (!ln.includes('/login') && !ln.includes('loginPathFromHere(')) return",
    replace: "      if (!ln.includes('/login')) return",
    test: TEST,
    why: '고칠수록 검사 대상이 줄어 "그 파일에 진입점이 있는가" 가 조용히 헛돈다.',
  },
  {
    name: '🧭 예외 상한을 풀어 공식을 형해화한다',
    file: TEST,
    find: "join(', ')}`).toBeLessThanOrEqual(10)",
    replace: "join(', ')}`).toBeLessThanOrEqual(10000)",
    test: TEST,
    why: "예외를 무제한 허용하면 전수 가드가 'login-return-ok' 를 붙이는 의식으로 전락한다.",
  },
]
