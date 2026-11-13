/** 🧬 주입 — 유어쇼츠 PC 첫 화면(430 액자). 가드: src/tests/unit/urshorts-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/urshorts-first-screen-2026-11-09.test.tsx'
export default [
  { name: '유어쇼츠PC — 워커가 PC 를 다시 로더로', file: 'src/worker/index.ts', find: "} else if (url.pathname === '/urshorts' && ssrPayload) {", replace: "} else if (url.pathname === '/urshorts' && ssrPayload && shouldRenderMobileFirstScreen(c.req.header('user-agent'))) {", test: T, why: '라이브 PC 첫 글자 1.9~2.4s(로더뿐).' },
  { name: '유어쇼츠PC — 액자 없이 그린다', file: 'src/worker/utils/urshorts-first-screen.ts', find: 'const framed = isMobile ? page :', replace: 'const framed = true ? page :', test: T, why: '액자 밖 전체 폭으로 그리면 앱이 430 으로 접으며 전부 밀린다.' },
  { name: '유어쇼츠PC — PC 에 첫 화면 CSS 를 다시 안 넣는다', file: 'src/worker/utils/css-first-boot.ts', find: " || pathname === '/urshorts' || pathname === '/urshorts/' /* 🖥️ 2026-11-13 유어쇼츠 PC", replace: " /* 🖥️ 2026-11-13 유어쇼츠 PC", test: T, why: 'CSS 가 없으면 서버 그림이 맨 글자로 보였다 바뀐다.' },
]
