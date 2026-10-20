/**
 * 🧬 주입 — 센트리는 보낼 것이 생길 때만 켠다 (2026-10-15 폰 CPU 4배 프로파일: 홈 첫 4초 실행 50KB · 144ms)
 */
const T = 'src/tests/unit/sentry-sdk-slim-2026-10-11.test.ts'
export default [
  {
    name: '센트리온디맨드 — 빵부스러기가 다시 SDK 를 켠다',
    file: 'src/lib/performance-monitor.ts',
    find: 'lib().then((m) => m.queueBreadcrumb(b)).catch(() => {})',
    replace: 'lib().then((m) => m.ensureSentry()).then((S) => S.addBreadcrumb(b)).catch(() => {})',
    test: 'src/tests/unit/web-vitals-warn-once-2026-10-07.test.ts',
    why: '부팅 1초 뒤 매 세션 SDK 를 받아 실행한다 — load 뒤로 미룬 효과가 다시 사라진다.',
  },
  {
    name: '센트리온디맨드 — 모든 세션이 다시 미리 켠다',
    file: 'src/main.tsx',
    find: 'const SENTRY_PRELOAD_RATE = 0.01',
    replace: 'const SENTRY_PRELOAD_RATE = 1',
    test: T,
    why: '오류 없는 99% 세션도 SDK 를 받아 실행한다.',
  },
  {
    name: '센트리온디맨드 — 켜진 뒤에도 직접 보낸다(중복 보고)',
    file: 'src/main.tsx',
    find: "        window.removeEventListener('error', onErrorEvent)\n",
    replace: '',
    test: T,
    why: '켜진 뒤엔 SDK 전역 핸들러도 같은 오류를 잡아 두 번 보고된다 — 센트리 쿼터를 태운다.',
  },
  {
    name: '센트리온디맨드 — 사용자 정보가 SDK 를 켠다',
    file: 'src/lib/sentry.ts',
    find: '    whenReady((S) => S.setUser(user))',
    replace: '    ensureSentry().then((S) => S.setUser(user)).catch(() => {})',
    test: T,
    why: '로그인할 때마다 SDK 를 받아 실행한다.',
  },
]
