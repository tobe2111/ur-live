/** 🧬 주입 — 핀 공유 주소 서버 리다이렉트. 가드: src/tests/unit/pin-link-server-redirect-2026-11-11.test.ts */
const T = 'src/tests/unit/pin-link-server-redirect-2026-11-11.test.ts'
export default [
  { name: '핀링크 — 워커 배선을 뺀다(공유 링크가 다시 문서를 두 번 받는다)', file: 'src/worker/index.ts', find: " const pinApi = pinRedirectApiPath(url.pathname); if (pinApi) return app.fetch(new Request(`${url.origin}${pinApi}`, request), env as never, ctx as never);", replace: "", test: T, why: '소개 링크가 앱 껍데기 + JS 부팅을 거친 뒤에야 상품으로 간다(검은 화면 두 번).' },
  { name: '핀링크 — 요청 헤더를 버린다(클릭 기록이 UA·쿠키를 못 본다)', file: 'src/worker/index.ts', find: "return app.fetch(new Request(`${url.origin}${pinApi}`, request), env as never, ctx as never);", replace: "return app.fetch(new Request(`${url.origin}${pinApi}`), env as never, ctx as never);", test: T, why: '핸들러의 클릭 기록(logPinClick)이 원래 요청의 UA·리퍼러를 읽는다.' },
  { name: '핀링크 — 유어샵 본체까지 리다이렉트로 본다(유어샵이 안 열린다)', file: 'src/shared/seo/pin-link.ts', find: "const PIN_LINK_RE = /^\\/u\\/([A-Za-z0-9_-]{1,40})\\/p\\/(\\d{1,12})\\/?$/", replace: "const PIN_LINK_RE = /^\\/u\\/([A-Za-z0-9_-]{1,40})(?:\\/p\\/(\\d{1,12}))?\\/?$/", test: T, why: '반대 방향 — `/u/{handle}` 자체가 API 로 넘어가 유어샵 화면이 사라진다.' },
  { name: '핀링크 — /u/me 를 핸들로 본다', file: 'src/shared/seo/pin-link.ts', find: "if (!m || m[1] === 'me') return null", replace: "if (!m) return null", test: T, why: '`/u/me` 는 내 유어샵 탭이다 — 핸들 조회로 보내면 안 된다.' },
  { name: '핀링크 — 앱 안 이동용 라우트를 지운다(앱 안에서 누르면 갈 곳이 없다)', file: 'src/App.tsx', find: '<Route path="/u/:handle/p/:productId" element={<CuratorPinClientRedirect />} />', replace: '', test: T, why: '서버 리다이렉트는 문서 요청만 탄다 — 앱 안 클릭은 이 라우트가 받는다.' },
]
