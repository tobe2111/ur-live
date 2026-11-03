/**
 * 🩹 소비자 표시 되살리기 (2026-11-03 대표 신고 "로그인을 했는데도 왜 이렇게 뜨지?") — 주입 매니페스트.
 * 가드: src/tests/unit/consumer-session-restore-2026-11-03.test.ts
 */
const TEST = 'src/tests/unit/consumer-session-restore-2026-11-03.test.ts'
export default [
  {
    name: '🩹소비자복구 서버 세션이 살아 있어도 표시를 안 되살린다',
    file: 'src/features/auth/consumer-session-restore.ts',
    find: "    localStorage.setItem('session_login', 'true')\n    if (u.name",
    replace: "    if (u.name",
    test: TEST,
    why: '카카오로 로그인돼 있는데 PC 계정 메뉴가 계속 "로그인/회원가입" 을 띄운다.',
  },
  {
    name: '🩹소비자복구 헤더가 되살린 뒤에도 다시 안 그린다',
    file: 'src/features/auth/consumer-session-restore.ts',
    find: '    window.dispatchEvent(new Event(CONSUMER_SESSION_RESTORED_EVENT))\n',
    replace: '',
    test: TEST,
    why: '값은 되살렸는데 헤더는 이미 손님으로 그려져 새로고침 전까지 그대로다.',
  },
  {
    name: '🩹소비자복구 익명 방문마다 서버에 묻는다',
    file: 'src/utils/auth-callback-bootstrap.ts',
    find: '    if (!hasConsumer && hasRole) void import(',
    replace: '    if (!hasConsumer) void import(',
    test: TEST,
    why: '모든 익명 페이지뷰가 요청 하나씩 더 쓴다.',
  },
]
