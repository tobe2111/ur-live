/** 🧬 주입 — 마이 하위 화면 서버 첫 화면. 가드: src/tests/unit/my-sub-first-screen-2026-11-10.test.tsx */
const T = 'src/tests/unit/my-sub-first-screen-2026-11-10.test.tsx'
export default [
  { name: '마이하위첫화면 — 워커가 세션 없이도 그린다', file: 'src/worker/index.ts', find: "} else if (authed && mySubPageOf(url.pathname) && shouldRenderMobileFirstScreen(", replace: "} else if (mySubPageOf(url.pathname) && shouldRenderMobileFirstScreen(", test: T, why: '비로그인은 앱이 로그인으로 보낸다 — 머리줄을 보여 줬다 지우게 된다.' },
  { name: '마이하위첫화면 — CSS 자격이 세션 없이도 열린다', file: 'src/worker/utils/css-first-boot.ts', find: "    || (authed && mySubPageOf(pathname) !== null)", replace: "    || (mySubPageOf(pathname) !== null)", test: T, why: '첫 화면이 안 그려지는 요청에 첫 화면 CSS 를 싣는다(헛 바이트).' },
  { name: '마이하위첫화면 — 표면 CSS 연결을 뺀다(머리줄이 스타일 없이 뜬다)', file: 'src/worker/utils/css-first-boot.ts', find: "if (p === '/notifications' || mySubPageOf(p) !== null) return 'notifications'", replace: "if (p === '/notifications') return 'notifications'", test: T, why: '첫 화면 CSS 가 홈 것으로 떨어져 머리줄 클래스가 빠진다.' },
  { name: '마이하위첫화면 — 제목이 화면과 갈린다(마운트 때 글자가 바뀐다)', file: 'src/shared/my-sub-pages.ts', find: "'/my-coupons': '쿠폰함',", replace: "'/my-coupons': '내 쿠폰',", test: T, why: '서버 제목과 앱 제목이 다르면 마운트 때 제목이 바뀐다.' },
  { name: '마이하위첫화면 — 화면이 제목을 바꾼다(서버는 옛 제목)', file: 'src/pages/MyStaysPage.tsx', find: '<SubPageHeader title="내 숙소 예약"', replace: '<SubPageHeader title="숙소 예약 내역"', test: T, why: '반대 방향 — 화면만 고치면 서버 첫 화면이 낡는다.' },
  { name: '마이하위첫화면 — 뿌리가 다시 한 화면 높이를 차지한다(로더가 화면 밖)', file: 'src/worker/utils/notifications-first-screen.ts', find: "export const MY_SUB_ROOT_CLS = SUB_PAGE_CLS.replace('min-h-[100dvh] ', '')", replace: "export const MY_SUB_ROOT_CLS = SUB_PAGE_CLS", test: T, why: '머리줄 칸이 100dvh 면 그 아래 로더가 안 보인다.' },
]
