/**
 * 🐢 2026-11-03 마이 — 늦게 켜진 에이전시가 보던 화면을 바꾸지 않는다. 시험: src/tests/unit/my-agency-late-connect-2026-11-03.test.tsx
 */
const T = 'src/tests/unit/my-agency-late-connect-2026-11-03.test.tsx'
export default [
  {
    name: '🐢 에이전시가 화면이 뜬 뒤 켜지면 탭·버튼이 한꺼번에 생긴다',
    file: 'src/pages/user-profile/useAgencyPresence.ts',
    find: 'return next.on && !startedOn ? prev : next',
    replace: 'return next',
    test: T,
    why: '실사용 CLS: 1.4초에 보던 \'나\' 화면이 사라졌다.',
  },
  {
    name: '🐢 자동 연결 성공 시 에이전시 구역이 흐름 한가운데 끼어든다',
    file: 'src/pages/user-profile/MyAgencyZone.tsx',
    find: 'if (!on || lateConnected) return null',
    replace: 'if (!on) return null',
    test: T,
    why: '#2090 부터 폰 마이에서 구역이 늦게 끼어들며 아래를 밀었다.',
  },
]
