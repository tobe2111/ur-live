/**
 * 🧬 주입 — 로그아웃 이용권 탭 모션(2026-11-04)
 */
const T = 'src/tests/unit/guest-pass-motion-2026-11-04.test.ts'
export default [
  {
    name: '이용권모션 — 티켓 착지가 투명에서 시작(서버 첫 화면 깜빡임)',
    file: 'src/pages/guest/GuestPassPage.tsx',
    find: '@keyframes ur-gp-land { 0% { transform: translateY(0); }',
    replace: '@keyframes ur-gp-land { 0% { opacity: 0; transform: translateY(0); }',
    test: T,
    why: '서버가 이미 그린 티켓이 앱이 뜨는 순간 꺼졌다 다시 켜진다.',
  },
  {
    name: '이용권모션 — 표식이 서버와 같이 쓰는 클래스에서 빠진다',
    file: 'src/shared/guest-page.ts',
    find: "ticketQr: 'ur-gp-qr shrink-0",
    replace: "ticketQr: 'shrink-0",
    test: T,
    why: 'QR 스캔 줄이 조용히 사라진다(에러 없음).',
  },
  {
    name: '이용권모션 — 예시가 화면에 들어와도 안 켜진다',
    file: 'src/pages/guest/GuestPassPage.tsx',
    find: "el.classList.add('ur-gp-on'); io.disconnect()",
    replace: 'io.disconnect()',
    test: T,
    why: '예시 이용권과 보러 가기 버튼이 투명한 채 영영 안 보인다.',
  },
  {
    name: '이용권모션 — 동작 줄이기에서 숨긴 예시가 안 돌아온다',
    file: 'src/pages/guest/GuestPassPage.tsx',
    find: '.ur-gp-shelf .ur-gs-rows > *,.ur-gp-shelf .ur-gp-browse{opacity:1}',
    replace: '',
    test: T,
    why: '움직임을 끈 사람에게 예시 이용권이 통째로 안 보인다.',
  },
]
