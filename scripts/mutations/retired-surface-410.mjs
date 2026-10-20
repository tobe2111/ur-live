/**
 * 🧨 철거된 서비스의 URL 은 410 Gone (2026-10-12, 대표 *"SEO 측면에서 어떻게 해야하는지 알려줘"* → *"모두 해줘"*) — 주입 매니페스트.
 * 가드: src/tests/unit/retired-surface-410-2026-10-12.test.ts
 *
 * 다섯 조각이 쌍이다(판정 SSOT · 410+noindex · 메타 미주입 · robots 중립 · 선언 없음).
 * 아래 주입은 그 각각을 하나씩 되돌려 가드가 정말 빨간불을 내는지 확인한다.
 */
const TEST = 'src/tests/unit/retired-surface-410-2026-10-12.test.ts'
const META = 'src/worker/utils/surface-ssr-meta.ts'
const WORKER = 'src/worker/index.ts'
const ROBOTS = 'public/robots.txt'

export default [
  {
    name: '🧨 철거 판정에서 /supplier 가 빠진다',
    file: META,
    find: "return /^\\/(wholesale|supplier)(\\/|$)/.test(pathname)",
    replace: "return /^\\/(wholesale)(\\/|$)/.test(pathname)",
    test: TEST,
    why: '제조사 대시보드도 같은 철거분이다 — 빠지면 그 경로만 200 으로 남아 soft-404 가 반쪽 남는다.',
  },
  {
    name: '🧨 철거 판정이 경로 경계를 잃어 살아 있는 표면을 삼킨다',
    file: META,
    find: "return /^\\/(wholesale|supplier)(\\/|$)/.test(pathname)",
    replace: "return /^\\/(wholesale|supplier)/.test(pathname)",
    test: TEST,
    why: '경계가 없으면 `/wholesaler` 같은 미래 경로가 통째로 410 이 된다 — 이 방향이 가장 큰 사고다.',
  },
  {
    name: '🧨 서비스 철거와 엔티티 소멸을 한 상태코드로 묶는다',
    file: WORKER,
    // 🔀 2026-10-12 재조준: 등록 안 된 경로도 404 가 되어 삼항에 `unknownPath` 가 붙었다.
    //   지키는 불변식은 그대로 — **철거 표면은 410, 엔티티 부재는 404**(둘을 섞지 않는다).
    find: "const goneStatus = retiredSurface ? 410 : ((entityGone || unknownPath) ? 404 : 0);",
    replace: "const goneStatus = (retiredSurface || entityGone || unknownPath) ? 410 : 0;",
    test: TEST,
    why: '상품은 다시 올라온다(404="지금 없다") — 410 을 주면 재등록해도 색인이 안 돌아온다. 둘은 다른 판정이다.',
  },
  {
    name: '🧨 410 응답 전환이 사라져 다시 200 을 준다',
    file: WORKER,
    find: "    c.res = goneStatus\n      ? new Response(rewritten.body, {",
    replace: "    c.res = false\n      ? new Response(rewritten.body, {",
    test: TEST,
    why: '200 은 "이 페이지가 있다" 는 선언이다 — 본문 0자로 200 을 주는 것이 구글이 정의한 soft 404 다.',
  },
  {
    name: '🧨 철거 표면이 noindex 를 못 받는다',
    file: WORKER,
    // 🔀 2026-10-12 재조준: 같은 블록이 등록 안 된 경로의 noindex 도 맡는다(앵커만 옮겼다).
    find: "    if (entityGone || unknownPath || retiredSurface) {",
    replace: "    if (entityGone) {",
    test: TEST,
    why: '410 을 못 읽는 수집기(네이버 Yeti 포함)를 위한 두 번째 신호다 — 하나만 두면 한쪽 크롤러에 안 전달된다.',
  },
  {
    name: '🧨 워커가 철거 판정을 직접 베낀다 (SSOT 이탈)',
    file: WORKER,
    find: "const retiredSurface = isRetiredSurface(url.pathname);",
    replace: "const retiredSurface = /^\\/(wholesale|supplier)(\\/|$)/.test(url.pathname);",
    test: TEST,
    why: '판정이 두 벌이 되면 갈린다 — 한쪽만 고치는 날 상태코드와 메타가 서로 다른 말을 한다.',
  },
  {
    name: '🧨 robots 가 철거 URL 을 차단해 410 을 못 읽게 만든다',
    file: ROBOTS,
    find: "Disallow: /wholesale/product",
    replace: "Disallow: /wholesale\nDisallow: /wholesale/product",
    test: TEST,
    why: '폐기 URL 처리에서 가장 흔한 실수 — 차단하면 크롤러가 410 을 읽을 수 없어 색인에 영구 잔존한다.',
  },
  {
    name: '🧨 거래성 경로 차단이 걷힌다 (크롤 예산)',
    file: ROBOTS,
    find: "Disallow: /wholesale/cart\nDisallow: /wholesale/checkout",
    replace: "Disallow: /wholesale/checkout",
    test: TEST,
    why: '애초에 색인 의도 0 인 결제·대시보드 경로다 — 열면 죽은 경로에 크롤 예산을 쓴다(반대 방향 불변식).',
  },
  {
    name: '🧨 cron 이 죽은 utongstart 경로를 다시 예열한다',
    file: 'src/worker/cron/cache-prewarm.ts',
    find: "  // 🛡️ 2026-05-27 (loading P0): 인기 셀러 + 인기 상품 detail dynamic prewarm.",
    replace: "  const WS_PREWARM_PATHS = ['/api/wholesale/catalog', '/api/wholesale/banners'];\n  for (const p of WS_PREWARM_PATHS) { try { await fetch(`https://utongstart.com${p}`); } catch { /* noop */ } }\n\n  // 🛡️ 2026-05-27 (loading P0): 인기 셀러 + 인기 상품 detail dynamic prewarm.",
    test: TEST,
    why: '그 도메인은 어느 Pages 프로젝트에도 안 붙어 있다 — 5분마다 죽은 주소를 두드리며 서브리퀘스트 예산(실측 ~49/50)을 먹는다.',
  },
  {
    name: '🧨 sitemap 이 410 인 도매 URL 을 색인해 달라고 선언한다',
    file: 'src/worker/routes/sitemap.routes.ts',
    // 🔀 2026-10-14 재조준 — 앵커였던 `/browse` 줄의 priority 가 0.9 → 0.5 로 바뀌었다(본문 43자
    //   · 카탈로그 1건). **결함은 한 글자도 안 바꿨다** — 앵커를 이 파일에서 가장 안 흔들리는
    //   홈 줄로 옮겼을 뿐이다.
    find: "    { loc: '/', priority: 1.0, changefreq: 'daily' },",
    replace: "    { loc: '/', priority: 1.0, changefreq: 'daily' },\n    { loc: '/wholesale', priority: 1.0, changefreq: 'daily' },",
    test: TEST,
    why: '색인 요청과 410 은 서로 반대 신호다 — 서치콘솔에 수집오류로 쌓이고 사이트맵 신뢰도가 깎인다.',
  },
]
