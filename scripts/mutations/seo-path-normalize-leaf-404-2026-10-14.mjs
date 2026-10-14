/**
 * 🧬 2026-10-14 — 끝 슬래시·`/index.html` 301 · 잎 표면 꼬리 404 의 주입.
 *
 * 근거·실측은 `src/tests/unit/seo-path-normalize-leaf-404-2026-10-14.test.ts` 머리말.
 * **절반이 반대 방향**이다 — 이 수리는 "더 막는" 쪽으로 틀리면 멀쩡한 URL 이 301·404 가 되고
 * 색인 복구가 수주라서, 막는 방향도 함께 잠근다.
 */
const NORM = 'src/shared/seo/path-normalize.ts'
const KNOWN = 'src/shared/seo/known-routes.ts'
const WORKER = 'src/worker/index.ts'
const TEST = 'src/tests/unit/seo-path-normalize-leaf-404-2026-10-14.test.ts'

// 🔑 주석까지 포함한 **실제 한 줄**이다 — 코드 부분만 쓰면 스왑 주입의 find 가 안 맞아 조용히 헛돈다(2026-10-14 실제로 그랬다).
const WIRE = "        const norm = normalizeDocPath(url.pathname); if (norm && isKnownAppPath(norm)) return Response.redirect(`${url.origin}${norm}${url.search || ''}`, 301); // 🔗 2026-10-14 끝 슬래시·`/index.html` 301(같은 내용의 다른 철자 — 404 가 아니다). SSOT: shared/seo/path-normalize"
const BLOG = '        const renamed = resolveRenamedBlogPath(url.pathname);'

export default [
  {
    name: '🔗 정규화 배선을 없앤다 (끝 슬래시·index.html 중복이 돌아온다)',
    file: WORKER,
    find: WIRE,
    replace: '        // 배선 제거',
    test: TEST,
    why:
      '라이브 실측 — `/faq/index.html`·`/blog/`·`/products/2917/` 가 **자기 canonical + 제네릭 홈 ' +
      '제목**으로 나갔다. 같은 페이지가 두세 URL 로 색인 경쟁한다.',
  },
  {
    name: '🔗 반대 방향 — `isKnownAppPath` 게이트를 없앤다 (모르는 경로를 301 로 보낸다)',
    file: WORKER,
    find: 'if (norm && isKnownAppPath(norm)) return Response.redirect(',
    replace: 'if (norm) return Response.redirect(',
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다** — 라우트 표에 없는 경로까지 301 로 보내면 404 로 선언해야 할 ' +
      'thin URL 에 영구 리다이렉트를 주고, 잘못 잡으면 멀쩡한 페이지가 색인에서 사라진다.',
  },
  {
    name: '🔗 301 → 302 (임시라 색인이 합쳐지지 않는다)',
    file: WORKER,
    // ⚠️ `${norm}` 을 포함해야 **고유**하다 — 종전 find 는 레거시 호스트·블로그 슬러그 301 에도
    //   맞아 엉뚱한 줄을 302 로 바꿨고, 내 줄은 301 그대로라 **주입이 헛돌았다**.
    find: "${norm}${url.search || ''}`, 301);",
    replace: "${norm}${url.search || ''}`, 302);",
    test: TEST,
    why:
      '302 는 *"잠깐 저기 있다"* 라 구글이 **옛 URL 을 계속 정본으로** 둔다. 철자를 합치려면 ' +
      '영구(301)여야 한다.',
  },
  {
    name: '🔗 리다이렉트에서 쿼리를 버린다',
    file: WORKER,
    find: "return Response.redirect(`${url.origin}${norm}${url.search || ''}`, 301);",
    replace: 'return Response.redirect(`${url.origin}${norm}`, 301);',
    test: TEST,
    why:
      '`/blog/?page=2` 가 `/blog` 로 가며 **페이지가 사라진다**. 2026-09-13 결제 콜백에서 쿼리를 ' +
      '통째로 지워 "결제 정보가 올바르지 않습니다" 가 뜬 그 클래스다.',
  },
  {
    name: '🔗 정규화를 블로그 슬러그 301 뒤로 옮긴다 (순서)',
    file: WORKER,
    find: `${WIRE}\n${BLOG}`,
    replace: `${BLOG}\n${WIRE}`,
    test: TEST,
    why:
      '철자를 먼저 한 가지로 만들지 않으면 뒤 판정들이 **같은 페이지의 변형을 각각** 본다 ' +
      '(블로그 리네임 맵이 `/blog/old-slug/` 를 못 찾는다).',
  },
  {
    name: '🔗 고정점 루프를 한 바퀴만 돈다 (결과가 또 정규화 대상 = 리다이렉트 루프)',
    file: NORM,
    find: '  for (let i = 0; i < 4; i += 1) {',
    replace: '  for (let i = 0; i < 1; i += 1) {',
    test: TEST,
    why:
      '`/index.html/index.html` 이 `/index.html` 로만 줄어 **다시 정규화 대상**이 된다. 브라우저가 ' +
      '같은 301 을 반복해 받고 크롤러는 그 체인을 포기한다.',
  },
  {
    name: '🔗 `/index.html` 꼬리를 떼지 않는다',
    file: NORM,
    find: '    if (p.endsWith(INDEX_SUFFIX)) p = p.slice(0, -INDEX_SUFFIX.length) || \'/\'',
    replace: '    if (false) p = p.slice(0, -INDEX_SUFFIX.length) || \'/\'',
    test: TEST,
    why: '실측 24쌍 중 **20쌍이 이 모양**이었다(`/*/index.html`). 끝 슬래시만 고치면 절반이 남는다.',
  },
  {
    name: '🔗 반대 방향 — `/api/` 를 건너뛰지 않는다',
    file: NORM,
    find: "const SKIP_PREFIXES = ['/api/', '/assets/', '/.well-known/', '/cdn-cgi/']",
    replace: "const SKIP_PREFIXES = ['/assets/', '/.well-known/', '/cdn-cgi/']",
    test: TEST,
    why:
      'API 요청이 301 을 맞는다. POST 는 301 을 따라가지 않거나 메서드가 바뀌어 **결제 웹훅·' +
      'same-origin fetch 가 조용히 깨진다**(2026-07-20 도메인 이전 때 `/api/*` 를 301 에서 뺀 그 이유).',
  },
  {
    name: '🗺️ 2세그먼트 판정을 최상위 집합으로 되돌린다 (잎 51개가 다시 무한 thin URL)',
    file: KNOWN,
    find: '  return KNOWN_PARENT_SEGMENTS.has(segs[0])',
    replace: '  return KNOWN_TOP_SEGMENTS.has(segs[0])',
    test: TEST,
    why:
      '라이브 실측 — `/browse/zz`·`/map/zz`·`/urshorts/zz`·`/gdpr/zz`·`/faq/a/b/c` 가 전부 ' +
      '**200 + index, follow + 자기 canonical** 이었다. 자식 라우트가 **아예 없는** 표면에 아무 ' +
      '꼬리를 달면 색인 후보가 무한히 생기고 크롤 예산이 실제 상품에서 빠진다.',
  },
  {
    name: '🗺️ 반대 방향 — 부모 집합에서 `seller` 를 뺀다 (대시보드 깊은 경로가 404)',
    file: KNOWN,
    find: "  's', 'seller', 'stays', 'store', 'terms', 'u', 'user', 'v', 'vouchers',",
    replace: "  's', 'stays', 'store', 'terms', 'u', 'user', 'v', 'vouchers',",
    test: TEST,
    why:
      '셀러 대시보드 ~70경로가 통째로 404 가 된다. 2026-10-12 가 **App.tsx 만 읽어 대시보드 180개를 ' +
      '404 로 만들 뻔한** 그 사고의 재발이고, 이 쪽이 thin URL 보다 훨씬 비싸다.',
  },
  {
    name: '🗺️ 반대 방향 — 부모 집합에서 `u`·`pass` 를 뺀다 (유어샵·이용권 상세가 404)',
    file: KNOWN,
    find: "  'pay', 'payment', 'points', 'product', 'products', 'profile', 'referral', 'region',",
    replace: "  'pay', 'payment', 'points', 'product', 'profile', 'referral', 'region',",
    test: TEST,
    why:
      '`products` 를 빼면 쇼핑 상세 360건이 404 다. 공유된 링크·sitemap 제출분이 통째로 죽고 ' +
      '색인 복구는 수주다 — 목록을 손으로 고르면 안 되는 이유다(가드가 라우트 표와 양방향 대조).',
  },
  {
    name: '🗺️ 부모 집합에 잎을 끼워 넣는다 (`faq` — 양방향 대조의 군더더기 쪽)',
    file: KNOWN,
    find: "  'about', 'account', 'admin', 'ads', 'agency', 'area-report', 'auth', 'blog',",
    replace: "  'about', 'account', 'admin', 'ads', 'agency', 'area-report', 'auth', 'blog', 'faq',",
    test: TEST,
    why:
      '한쪽 방향만 보는 가드는 **집합에 군더더기를 넣어도 통과**한다 — 잎을 하나 끼워 넣으면 ' +
      '그 표면의 무한 thin URL 이 조용히 되살아난다(`/faq/zzzqqq` 가 다시 200 + index).',
  },
]
