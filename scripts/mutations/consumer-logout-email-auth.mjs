/**
 * 🧨 2026-10-01 — "로그아웃했는데 로그아웃 UI" + "이메일 가입·로그인" 가드의 되돌려-검증.
 *
 * 각 항목은 **고친 결함을 그대로 되살린다**. 가드가 빨간불이 안 나면 그 가드는 아무것도 안 지킨다.
 */
export default [
  {
    name: '소비자 헤더가 대시보드 토큰을 로그인으로 센다 (대표 신고 재현)',
    why: '이 한 줄이 원인이었다 — admin_token 하나만 남아도 헤더가 "로그인됨" 으로 그려지고 로그아웃 버튼이 뜬다.',
    file: 'src/components/main/DesktopTopNav.tsx',
    find: '  const loggedIn = hasConsumerSession()',
    replace: '  const loggedIn = isLoggedInSync()',
    test: 'src/tests/unit/consumer-logout-and-email-auth-2026-10-01.test.ts',
  },
  {
    name: '계정 메뉴 로그아웃이 소비자만 지운다 (전 역할 종료 확정 위반)',
    why: '2026-07-07 대표 확정 "전부 로그아웃" 이전의 반쪽 로그아웃. 대시보드 토큰이 남아 증상이 재발한다.',
    file: 'src/components/main/AccountMenu.tsx',
    find: "      const { logoutAll } = await import('@/features/auth/login-flow.service')\n      await logoutAll()",
    replace: "      const { clearAuthData } = await import('@/utils/auth')\n      clearAuthData('user')",
    test: 'src/tests/unit/consumer-logout-and-email-auth-2026-10-01.test.ts',
  },
  {
    name: '가입 폼이 손으로 적은 길이 검사로 되돌아간다 (서버 규칙과 갈림)',
    why: '폼은 통과시키고 서버는 400 — 사용자에겐 "가입이 안 된다" 로만 보인다(라이브 실측 클래스).',
    file: 'src/pages/RegisterPage.tsx',
    find: '    const pw = validatePasswordComplexity(formData.password)',
    replace: '    const pw = { ok: formData.password.length >= 8 } as { ok: true } | { ok: false; error: string }',
    test: 'src/tests/unit/consumer-logout-and-email-auth-2026-10-01.test.ts',
  },
  {
    name: '정책 모듈이 해싱 파일을 다시 끌어온다 (브라우저 번들에 crypto 유입)',
    why: '정책을 떼어낸 이유 자체가 사라진다 — 가입 폼이 PBKDF2 코드를 번들에 싣게 된다.',
    file: 'src/shared/password-policy.ts',
    find: "export const PASSWORD_MIN_LENGTH = 10",
    replace: "import '../lib/password'\nexport const PASSWORD_MIN_LENGTH = 10",
    test: 'src/tests/unit/consumer-logout-and-email-auth-2026-10-01.test.ts',
  },
  {
    name: '가입 폼이 서버 실패 이유를 다시 버린다',
    why: '서버가 "비밀번호는 10자 이상" 이라고 알려 줘도 화면엔 "회원가입에 실패했습니다" 만 떠서 고칠 수가 없다.',
    file: 'src/pages/RegisterPage.tsx',
    find: "      setError(errMsg || t('register.errorDefault', { defaultValue: '회원가입에 실패했습니다.' }))",
    replace: "      setError(t('register.errorDefault', { defaultValue: '회원가입에 실패했습니다.' })); void errMsg",
    test: 'src/tests/unit/consumer-logout-and-email-auth-2026-10-01.test.ts',
  },
  {
    name: '로그인 폼이 계정 잠금을 "비번 틀림" 으로 뭉갠다',
    why: '잠긴 사용자가 계속 시도해 잠금이 길어진다 — 서버는 423 으로 구분해 주는데 화면이 버린다.',
    file: 'src/pages/LoginPage.tsx',
    find: "      setError(msg || t('auth.invalidCredentials'))",
    replace: "      setError(t('auth.invalidCredentials')); void msg",
    test: 'src/tests/unit/consumer-logout-and-email-auth-2026-10-01.test.ts',
  },
]
