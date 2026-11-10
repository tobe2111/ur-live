/** 🧬 주입 — 알림 서버 첫 화면 (2026-11-10) */
const T = 'src/tests/unit/notifications-first-screen-2026-11-10.test.tsx'
const B = 'src/worker/utils/notifications-first-screen.ts'
export default [
  { name: '알림첫화면 — 워커가 세션 없이도 그린다', file: 'src/worker/index.ts', find: "} else if (authed && url.pathname === '/notifications') {", replace: "} else if (url.pathname === '/notifications') {", test: T, why: '비로그인이 머리줄을 먼저 보고 로그인으로 튕긴다(깜빡임).' },
  { name: '알림첫화면 — CSS 자격이 세션 없이도 열린다', file: 'src/worker/utils/css-first-boot.ts', find: "    || (authed && /^\\/notifications\\/?$/.test(pathname)) // 🔔", replace: "    || (/^\\/notifications\\/?$/.test(pathname)) // 🔔", test: T, why: '첫 화면이 없는 응답에 표면 CSS 를 인라인한다(무게).' },
  { name: '알림첫화면 — 머리줄을 좁은 칸으로', file: B, find: 'subPageHeadHtml(NOTIF_COPY.title, true)', replace: 'subPageHeadHtml(NOTIF_COPY.title)', test: T, why: "마운트 때 '모두 읽음' 칸이 88px 로 벌어지며 제목이 옆으로 민다." },
  { name: '알림첫화면 — 페이지가 뿌리 클래스를 손으로 적는다', file: 'src/pages/NotificationsPage.tsx', find: '<div className={NOTIF_CLS.root}>', replace: '<div className={`${SUB_PAGE_CLS_X} pb-safe-nav md:pb-20`}>', test: T, why: '상수가 바뀌어도 앱이 안 따라와 서버와 갈린다.' },
  { name: '알림첫화면 — PC 에서 네비 예약을 뺀다', file: B, find: "const topnav = isMobile ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", replace: "const topnav = isMobile || true ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", test: T, why: 'PC 에서 네비가 마운트 때 끼어들어 첫 화면이 113px 밀린다.' },
]
