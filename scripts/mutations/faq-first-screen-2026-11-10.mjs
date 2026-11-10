/** 🧬 주입 — 자주 묻는 질문 서버 첫 화면 (2026-11-10) */
const T = 'src/tests/unit/faq-first-screen-2026-11-10.test.tsx'
const B = 'src/worker/utils/faq-first-screen.ts'
export default [
  { name: 'FAQ첫화면 — 답변 본문을 서버가 넣는다', file: B, find: '<div class="ur-faq-a" aria-hidden="true" inert=""></div>', replace: '<div class="ur-faq-a" aria-hidden="true" inert=""><div><p>${esc(f.answer)}</p></div></div>', test: T, why: '모션 CSS 가 붙기 전엔 답이 전부 펼쳐 보인다(첫 화면이 두 배로 길어졌다가 마운트 때 접힌다).' },
  { name: 'FAQ첫화면 — 질문을 절반만 그린다', file: B, find: 'const rows = CONCEPT_FAQ.map(', replace: 'const rows = CONCEPT_FAQ.slice(0, 3).map(', test: T, why: '마운트 때 아래 질문이 생겨 고객센터 상자가 밀린다.' },
  { name: 'FAQ첫화면 — 머리줄 h1 을 보이게 그린다', file: B, find: '${SUB_PAGE_HEAD.h1} ${SUB_PAGE_HEAD.h1Hidden}', replace: '${SUB_PAGE_HEAD.h1} ${SUB_PAGE_HEAD.h1Shown}', test: T, why: '스크롤 0 인데 제목이 두 번(머리줄 + 큰 제목) 보였다가 마운트 때 하나가 사라진다.' },
  { name: 'FAQ첫화면 — 첫 칩을 꺼진 모양으로', file: B, find: '${i === 0 ? FAQ_CLS.chipOn : FAQ_CLS.chipOff}', replace: '${FAQ_CLS.chipOff}', test: T, why: "'전체' 가 선택된 상태인데 서버 그림에선 아무 칩도 안 켜져 마운트 때 색이 바뀐다." },
  { name: 'FAQ첫화면 — PC 에서 네비 예약을 뺀다', file: B, find: "const topnav = isMobile ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", replace: "const topnav = isMobile || true ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", test: T, why: 'PC 에서 네비가 마운트 때 끼어들어 첫 화면이 113px 밀린다.' },
  { name: 'FAQ첫화면 — 페이지가 클래스를 손으로 적는다', file: 'src/pages/FAQPage.tsx', find: 'className={FAQ_CLS.chips}', replace: 'className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide -mx-1 px-1"', test: T, why: '상수가 바뀌어도 앱이 안 따라와 서버와 갈린다.' },
  { name: 'FAQ첫화면 — 머리줄 부품이 큰 제목 클래스를 손으로 적는다', file: 'src/components/ui/sub-page-header.tsx', find: 'className={SUB_PAGE_HEAD.title}', replace: "className={'origin-left text-[24px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white truncate'}", test: T, why: '마이 아래 모든 하위 화면 머리줄이 서버 첫 화면과 갈릴 수 있다.' },
  { name: 'FAQ첫화면 — 워커가 폰에만 그린다', file: 'src/worker/index.ts', find: "buildFaqFirstScreen(urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')))", replace: 'buildFaqFirstScreen(urdealLoaderHtml, true)', test: T, why: 'PC 가 폰 본문을 받아 액자·네비 없이 마운트 때 밀린다.' },
  { name: 'FAQ첫화면 — 첫 화면 CSS 자격에서 빠진다', file: 'src/worker/utils/css-first-boot.ts', find: "    || pathname === '/faq' || pathname === '/faq/'", replace: '    || false', test: T, why: '서버가 그린 첫 화면이 앱 CSS 를 기다려 안 보인다(토큰판만 들어간다).' },
]
