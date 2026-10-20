/**
 * 🔑 로그인 복귀 주소 (2026-10-01, 대표 신고 "로그인하면 메인으로 간다") — 주입 매니페스트.
 * 가드: src/tests/unit/login-return-url-2026-10-01.test.ts
 *
 * 이 결함의 성질: **쓰는 사람만 있고 읽는 사람이 없었다.** 되돌리면 에러도 로그도 없이
 * 홈으로 떨어지고 화면은 멀쩡해 보인다 — 그래서 주입으로 고정한다.
 */
const TEST = 'src/tests/unit/login-return-url-2026-10-01.test.ts'
const SSOT = 'src/utils/login-return.ts'
const PAGE = 'src/pages/LoginPage.tsx'

export default [
  {
    name: '🔑 LoginPage 가 localStorage 복귀 주소를 다시 안 읽는다 (옛 수동 체인으로 환원)',
    file: PAGE,
    find: "returnUrlRef.current = resolveLoginReturnUrl(searchParams.get('returnUrl'))",
    replace: "returnUrlRef.current = searchParams.get('returnUrl') || sessionStorage.getItem('returnUrl') || '/'",
    test: TEST,
    why: '화면 9곳이 적어 두는 loginReturnUrl 을 아무도 안 읽게 된다 — 로그인하면 전부 홈으로 떨어지고 에러는 0이다.',
  },
  {
    name: '🔑 카카오로 보낼 때만 옛 체인으로 되돌린다',
    file: PAGE,
    find: "const currentReturnUrl = resolveLoginReturnUrl(searchParams.get('returnUrl'))",
    replace: "const currentReturnUrl = searchParams.get('returnUrl') || '/'",
    test: TEST,
    why: "여기서 '/' 를 보내면 콜백의 safeInternalPath(state, stored) 에서 그 '/' 가 저장값을 이긴다 — 결함의 마지막 고리.",
  },
  {
    name: '🔑 SSOT 가 localStorage 후보를 뺀다',
    file: SSOT,
    find: '    readStore(() => localStorage.getItem(LOGIN_RETURN_KEY)),',
    replace: '',
    test: TEST,
    why: '후보에서 빠지면 화면이 적어 둔 값이 영영 안 쓰인다(종전 동작 그대로).',
  },
  {
    name: "🔑 SSOT 가 '/' 를 유효한 후보로 받아들인다",
    file: SSOT,
    find: "    if (safe !== '/') return safe",
    replace: '    return safe',
    test: TEST,
    why: "'/' 는 '못 골랐다' 와 구분이 안 된다 — 받아들이면 앞 후보의 '/' 가 뒤 후보를 눌러 홈으로 간다.",
  },
  {
    name: '🔑 복귀 후 안 지운다',
    file: SSOT,
    find: '  try { localStorage.removeItem(LOGIN_RETURN_KEY) } catch { /* private mode */ }',
    replace: '  /* 안 지움 */',
    test: TEST,
    why: '남겨 두면 다음 로그인이 엉뚱한 옛 주소로 간다.',
  },
  {
    name: '🔑 SSOT 가 safeInternalPath 를 건너뛴다',
    file: SSOT,
    find: "    const safe = safeInternalPath(raw, '/')",
    replace: '    const safe = raw',
    test: TEST,
    why: '외부 URL·//·/login 자기참조가 복귀 주소가 된다 — 오픈 리다이렉트.',
  },
]
