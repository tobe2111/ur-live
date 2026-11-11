/** 🧬 주입 — 뷰어 목록 미리 받기 + /my-store 301. 가드: src/tests/unit/videos-list-preload-2026-11-11.test.ts */
const T = 'src/tests/unit/videos-list-preload-2026-11-11.test.ts'
export default [
  { name: '뷰어목록 — 워커 배선을 뺀다(목록 요청이 다시 앱 부팅 뒤에 출발)', file: 'src/worker/index.ts', find: "{ c.res.headers.append('Link', SHORTS_ALL_PRELOAD_LINK);", replace: "{", test: T, why: '2026-11-11 라이브 실측 — 목록 요청 3.3s 출발.' },
  { name: '뷰어목록 — 앱이 다른 주소를 받는다(미리 받은 것을 버리고 두 번 받는다)', file: 'src/shared/urshorts-list-cache.ts', find: "inflight = fetch(SHORTS_ALL_PATH)", replace: "inflight = fetch('/api/urshorts?all=1&v=2')", test: T, why: 'preload 는 주소가 글자까지 같아야 재사용된다.' },
  { name: '뷰어목록 — crossorigin 을 뺀다(요청 모드가 안 맞아 두 번 받는다)', file: 'src/shared/urshorts-list-cache.ts', find: "rel=preload; as=fetch; crossorigin`", replace: "rel=preload; as=fetch`", test: T, why: 'fetch() 는 cors 모드다 — preload 가 no-cors 면 브라우저가 재사용하지 않는다.' },
  { name: '뷰어목록 — /my-store 서버 301 을 뺀다(앱이 켜진 뒤에야 넘긴다)', file: 'src/shared/seo/consumer-redirects.ts', find: "  '/my-store': '/user/profile',\n", replace: "", test: T, why: '옛 링크·북마크가 앱 껍데기를 받고 나서야 마이로 간다(라이브 1.6s).' },
]
