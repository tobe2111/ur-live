/** 🧬 주입 — 이용권 상세 PC 서버 첫 화면 (2026-11-09) */
const T = 'src/tests/unit/detail-pc-first-screen-2026-11-09.test.tsx'
const B = 'src/worker/utils/detail-ssr-body.ts'
export default [
  { name: '🖥️ PC상세 — 상단 네비 높이 예약을 뺀다', file: B, find: '      topnav + crumbHtml(d.category) +', replace: '      crumbHtml(d.category) +', test: T, why: 'React 가 sticky 네비(113px)를 맨 위에 세우며 본문 전체가 내려간다(CLS).' },
  { name: '🖥️ PC상세 — 우측 aside 를 안 그린다(반쪽 그리드)', file: B, find: '`<aside class="${DETAIL_PC_FS.aside}"></aside></div>`', replace: "'</div>'", test: T, why: '마운트 때 360px 구매 박스가 끼어들며 그린 쪽이 가로로 줄어든다(2026-09-16 이유 1).' },
  { name: '🖥️ PC상세 — 큰 사진 폭을 폰 폭으로', file: B, find: 'const heroUrl = detailCropUrl(main, DETAIL_HERO_DESKTOP_WIDTH, multi ? DETAIL_PC_HERO_RATIO_MULTI : DETAIL_PC_HERO_RATIO_SINGLE)', replace: 'const heroUrl = detailCropUrl(main, 900, multi ? DETAIL_PC_HERO_RATIO_MULTI : DETAIL_PC_HERO_RATIO_SINGLE)', test: T, why: 'React 와 URL 이 갈려 사진을 두 번 받고 preload 가 버려진다.' },
  { name: '🖥️ PC상세 — 워커가 UA 를 안 넘긴다(PC 도 폰 본문)', file: 'src/worker/index.ts', find: "buildDetailFirstScreen(ssrPayload, urdealLoaderHtml, url.search, isMobileUserAgent(c.req.header('user-agent')))", replace: 'buildDetailFirstScreen(ssrPayload, urdealLoaderHtml, url.search)', test: T, why: 'PC 가 폰 슬라이드(숨김)를 받아 사진 두 벌 + PC 첫 화면 없음.' },
  { name: '🖥️ PC상세 — 제목 헤더 클래스를 손으로 바꾼다', file: 'src/shared/detail-pc-first-screen.ts', find: "h1: 'mt-2 text-[20px] leading-[1.3] font-semibold tracking-[-.02em] text-gray-900 dark:text-white',", replace: "h1: 'mt-2 text-[22px] leading-[1.3] font-semibold tracking-[-.02em] text-gray-900 dark:text-white',", test: T, why: '서버와 앱 제목 크기가 갈려 마운트 때 글자가 바뀐다.' },
]
