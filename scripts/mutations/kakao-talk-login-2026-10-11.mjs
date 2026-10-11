/**
 * 🧬 주입 — 카톡 간편로그인 + 옛 로그인 착지 주소 (2026-10-11 대표 "모두 가장 이상적으로 고치자")
 */
const T = 'src/tests/unit/kakao-talk-login-2026-10-11.test.ts'
export default [
  {
    name: '카톡로그인 — 옛 착지 주소도 로그인으로 처리한다',
    file: 'src/utils/auth-callback-bootstrap.ts',
    find: 'if (loginLanding && isStaleLoginLanding(window.location.hash, Date.now() / 1000)) {',
    replace: 'if (false) {',
    test: T,
    why: '방문 기록이 옛 주소를 열면 이전 사용자 wipe·남의 이름 표시·죽은 티켓 교환이 일어난다.',
  },
  {
    name: '카톡로그인 — 옛날 판정 여유를 0으로(폰 시계 오차에 정상 로그인이 막힌다)',
    file: 'src/utils/stale-login-landing.ts',
    find: 'export const STALE_GRACE_SEC = 600',
    replace: 'export const STALE_GRACE_SEC = 0',
    test: T,
    why: '폰 시계가 몇 분만 틀려도 방금 한 로그인을 옛날로 본다.',
  },
  {
    name: '카톡로그인 — 서버가 거절한 티켓도 다시 던진다',
    file: 'src/main.tsx',
    find: '        rejected = res.status === 400 || res.status === 401\n',
    replace: '',
    test: T,
    why: '거절된 티켓은 다시 던져도 같다 — 실패 기록만 쌓인다.',
  },
  {
    name: '카톡로그인 — 서버 sdk 모드가 사라진다',
    file: 'src/features/auth/api/kakao.routes.ts',
    find: "  if (c.req.query('mode') === 'sdk') return c.json({ success: true, data: { state, redirectUri, scope: loginScope || '' } });",
    replace: '',
    test: T,
    why: '준비가 늘 실패해 카톡 간편로그인이 한 번도 안 열린다(에러 없이 웹 로그인으로 떨어진다).',
  },
  {
    name: '카톡로그인 — 다른 계정으로 로그인에도 카톡 앱을 연다',
    file: 'src/pages/LoginPage.tsx',
    find: 'if (!wantsSwitch && startTalkLogin()) {',
    replace: 'if (startTalkLogin()) {',
    test: T,
    why: '카톡 앱은 지금 로그인된 계정으로만 들어간다 — 계정을 바꾸려는 사람을 같은 계정에 가둔다.',
  },
  {
    name: '카톡로그인 — 아이폰에도 SDK 를 미리 받는다',
    file: 'src/lib/kakao-talk-login.ts',
    find: 'return isAndroid() && detectInAppBrowser() === null',
    replace: 'return detectInAppBrowser() === null',
    test: T,
    why: '2026-05-04 아이폰 사파리가 SDK 를 화면과 함께 받다 멈춘 사고 — 이번 범위는 안드로이드뿐이다.',
  },
]
