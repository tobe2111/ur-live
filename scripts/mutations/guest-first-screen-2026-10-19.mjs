/** 🧬 주입 — 로그인 전 탭 셋 서버 첫 화면 (2026-10-19) */
const T = 'src/tests/unit/guest-first-screen-2026-10-19.test.tsx'
const B = 'src/worker/utils/guest-first-screen.ts'
export default [
  { name: '게스트첫화면 — 혜택 감싸개를 빠뜨린다', file: B, find: '`<div class="mt-5"><ul class="${GUEST_CLS.benefits}">${items}</ul></div>', replace: '`<ul class="${GUEST_CLS.benefits}">${items}</ul>', test: T, why: '혜택 목록이 20px 위로 붙어 마운트 때 카카오 버튼까지 튄다.' },
  { name: '게스트첫화면 — 마이 통계 줄을 안 그린다', file: B, find: '`<div class="${GUEST_CLS.myStats}">${stats}</div><div class="mt-5">${kakao()}</div></section>`', replace: '`<div class="mt-5">${kakao()}</div></section>`', test: T, why: '카카오 버튼이 통계 줄 높이만큼 위에 그려졌다가 내려간다.' },
  { name: '게스트첫화면 — 페이지가 문구를 손으로 바꾼다', file: 'src/pages/guest/GuestPassPage.tsx', find: "defaultValue: GUEST_COPY.pass.headline2 })", replace: "defaultValue: '미리 사면 훨씬 싸요' })", test: T, why: '서버와 앱 문구가 갈려 마운트 때 제목이 바뀐다.' },
  { name: '게스트첫화면 — 로그인 키가 갈린다', file: B, find: "s.getItem('session_login')", replace: "s.getItem('session')", test: T, why: '세션 로그인 사용자에게 게스트 화면이 잠깐 보인다.' },
  { name: '게스트첫화면 — 세션 쿠키가 있어도 그린다', file: 'src/worker/index.ts', find: '} else if (!authed && guestTabOf(url.pathname) &&', replace: '} else if (guestTabOf(url.pathname) &&', test: T, why: '로그인한 사람에게 게스트 화면이 먼저 그려진다.' },
]
