/** 🧬 주입 — 지역 착지 PC 첫 화면(네비 + CSS). 가드: src/tests/unit/region-first-screen-2026-11-08.test.ts */
const T = 'src/tests/unit/region-first-screen-2026-11-08.test.ts'
export default [
  { name: '지역PC — 상단 네비를 다시 안 그린다', file: 'src/worker/utils/region-first-screen.ts', find: "${pcPath ? pcTopNavBlockHtml(pcPath) : ''}", replace: '', test: T, why: '2026-11-13 PC 첫 화면이 네비 없이 뜨면 앱 네비(114px)가 꽂히며 본문이 밀린다.' },
  { name: '지역PC — PC 에 첫 화면 CSS 를 다시 안 넣는다', file: 'src/worker/utils/css-first-boot.ts', find: " || /^\\/region\\/[^/]+(?:\\/[^/]+)?\\/?$/.test(pathname) /* 🖥️ 2026-11-13 지역 착지 PC", replace: " /* 🖥️ 2026-11-13 지역 착지 PC", test: T, why: 'CSS 가 없으면 서버 첫 화면이 맨 글자로 보였다가 바뀐다.' },
  { name: '지역PC — 워커가 PC 를 다시 로더로', file: 'src/worker/index.ts', find: "} else if (!url.search && REGION_PATH_RE.test(url.pathname)) { const regionFirst", replace: "} else if (!url.search && REGION_PATH_RE.test(url.pathname) && shouldRenderMobileFirstScreen(c.req.header('user-agent'))) { const regionFirst", test: T, why: '라이브 PC 첫 글자 1.9~2.4s(로더뿐).' },
]
