/** 🧬 주입 — 검색 화면 서버 첫 화면 (2026-11-10) */
const T = 'src/tests/unit/search-first-screen-2026-11-10.test.tsx'
const B = 'src/worker/utils/search-first-screen.ts'
export default [
  { name: '검색첫화면 — 뿌리 클래스를 손으로 바꾼다', file: B, find: 'const page = `<div class="${SEARCH_CLS.root}">', replace: 'const page = `<div class="bg-white min-h-[100dvh]">', test: T, why: '서버와 앱 뿌리가 갈려 마운트 때 바탕·여백이 바뀐다.' },
  { name: '검색첫화면 — 유달이를 lazy 로', file: B, find: 'loading="eager" fetchpriority="high" decoding="async" data-udal="hello"', replace: 'loading="lazy" decoding="async" data-udal="hello"', test: T, why: '첫 화면 자리의 그림이 지연 로딩된다(종전 2.3초 문제의 재발).' },
  { name: '검색첫화면 — 검색어를 이스케이프 없이 넣는다', file: B, find: 'value="${escAttr(query)}"', replace: 'value="${query}"', test: T, why: '?q= 에 따옴표를 넣으면 속성이 깨져 HTML 주입이 된다.' },
  { name: '검색첫화면 — 최근 검색어 가드를 뺀다', file: B, find: "${query ? '' : searchFirstScreenGuardScript(nonce)}", replace: "''", test: T, why: '최근 검색어가 있는 사람에게 안내 그림이 먼저 떴다가 칩으로 바뀐다(깜빡임).' },
  { name: '검색첫화면 — PC 에서 네비 예약을 뺀다', file: B, find: "const topnav = isMobile ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", replace: "const topnav = isMobile || true ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", test: T, why: 'PC 에서 네비가 마운트 때 끼어들어 첫 화면이 113px 밀린다(PC 상세 첫 판의 실수).' },
  { name: '검색첫화면 — 헤더가 클래스를 손으로 적는다', file: 'src/components/search/SearchHeader.tsx', find: 'className={SEARCH_CLS.headerRow}', replace: 'className="flex items-center gap-2 px-3 py-2"', test: T, why: '상수가 바뀌어도 앱이 안 따라와 서버와 갈린다.' },
  { name: '검색첫화면 — 워커가 폰에만 그린다', file: 'src/worker/index.ts', find: "buildSearchFirstScreen(searchQueryOf(url.search), urdealLoaderHtml, nonce, shouldRenderMobileFirstScreen(c.req.header('user-agent')), ssrTarget", replace: "buildSearchFirstScreen(searchQueryOf(url.search), urdealLoaderHtml, nonce, true, ssrTarget", test: T, why: 'PC 가 폰 본문을 받아 액자·네비 없이 마운트 때 밀린다.' },
  { name: '검색첫화면 — 첫 화면 CSS 자격에서 빠진다', file: 'src/worker/utils/css-first-boot.ts', find: "    || pathname === '/search' || pathname === '/search/'", replace: "    || false", test: T, why: '서버가 그린 첫 화면이 앱 CSS 를 기다려 안 보인다(토큰판만 들어간다).' },
]
