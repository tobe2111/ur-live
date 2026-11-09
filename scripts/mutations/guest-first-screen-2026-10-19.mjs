/** 🧬 주입 — 로그인 전 탭 셋 서버 첫 화면 (2026-10-19) */
const T = 'src/tests/unit/guest-first-screen-2026-10-19.test.tsx'
const B = 'src/worker/utils/guest-first-screen.ts'
export default [
  { name: '게스트첫화면 — 이용권 단계 줄을 안 그린다', file: B, find: '<p class="${GUEST_CLS.sub}">${esc(c.sub)}</p>${ticket()}${steps(c.steps)}</section>`', replace: '<p class="${GUEST_CLS.sub}">${esc(c.sub)}</p>${ticket()}</section>`', test: T, why: '단계 줄 높이만큼 마운트 때 아래가 밀린다.' },
  { name: '게스트첫화면 — 고정 버튼을 안 그린다', file: B, find: "`<div class=\"${GUEST_CLS.myHeadText}\"><p class=\"${GUEST_CLS.myHello}\">${esc(c.hello)}</p><p class=\"${GUEST_CLS.myHelloSub}\">${esc(c.helloSub)}</p></div></div></section>` + dock()", replace: "`<div class=\"${GUEST_CLS.myHeadText}\"><p class=\"${GUEST_CLS.myHello}\">${esc(c.hello)}</p><p class=\"${GUEST_CLS.myHelloSub}\">${esc(c.helloSub)}</p></div></div></section>`", test: T, why: '느린 폰에서 앱 코드가 올 때까지 카카오 버튼이 없다.' },
  { name: '게스트첫화면 — 페이지가 문구를 손으로 바꾼다', file: 'src/pages/guest/GuestPassPage.tsx', find: "defaultValue: c.headline2 })", replace: "defaultValue: '미리 사면 훨씬 싸요' })", test: T, why: '서버와 앱 문구가 갈려 마운트 때 제목이 바뀐다.' },
  { name: '게스트첫화면 — 예시 지갑 사진을 두 벌로', file: B, find: '<img src="${esc(w.img)}"', replace: '<img src="/assets/guest/x.webp"', test: T, why: '서버 첫 화면의 사진과 앱의 사진이 달라 마운트 때 그림이 바뀐다.' },
  { name: '게스트첫화면 — 마이 유달이를 다시 빈 칸으로(2026-11-09)', file: B, find: "<div class=\"${GUEST_CLS.myHead}\">${mascot()}", replace: "<div class=\"${GUEST_CLS.myHead}\"><span class=\"block shrink-0\" style=\"width:56px;height:82px\" aria-hidden=\"true\"></span>", test: T, why: '그림이 앱 코드 뒤(2.3초)로 밀린다 — 실측 LCP.' },
  { name: '게스트첫화면 — 마이 유달이를 lazy 로(2026-11-09)', file: B, find: 'loading="eager" decoding="async" data-udal="hello"', replace: 'loading="lazy" decoding="async" data-udal="hello"', test: T, why: '첫 화면 자리의 그림이 지연 로딩되고 앱 <img>(eager) 와 속성이 갈린다.' },
  { name: '게스트첫화면 — 예시 줄 사진을 다른 주소로(2026-11-09)', file: 'src/shared/guest-page.ts', find: "  cafe: '/assets/guest/wallet-brunch.webp',", replace: "  cafe: '/assets/guest/example-brunch.webp',", test: T, why: '지갑과 같은 그림을 다른 주소로 한 번 더 받는다(종전 번들 사본 사고).' },
  { name: '게스트첫화면 — 로그인 키가 갈린다', file: B, find: "s.getItem('session_login')", replace: "s.getItem('session')", test: T, why: '세션 로그인 사용자에게 게스트 화면이 잠깐 보인다.' },
  { name: '게스트첫화면 — 세션 쿠키가 있어도 그린다', file: 'src/worker/index.ts', find: '} else if (!authed && guestTabOf(url.pathname) &&', replace: '} else if (guestTabOf(url.pathname) &&', test: T, why: '로그인한 사람에게 게스트 화면이 먼저 그려진다.' },
]
