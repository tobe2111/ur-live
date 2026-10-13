/**
 * 🍞 2026-10-12 — 쇼핑 상세 빵부스러기 주입.
 *
 * 시험: src/tests/unit/product-breadcrumb-2026-10-12.test.ts
 * 근거(라이브 전수, Googlebot UA · JSON-LD 파싱): 색인 대상 상세 넷 중 `/products/:id` 하나만
 * `BreadcrumbList` 0건이었다. 조건을 좁힌 쪽(② 반대 방향)도 같이 잠근다 — 무조건 달면
 * 이용권·숙소의 정본(`/pass`·`/stays`)과 **서로 다른 빵부스러기**를 주장하게 된다.
 */
const META = 'src/worker/utils/detail-ssr-meta.ts'
const TEST = 'src/tests/unit/product-breadcrumb-2026-10-12.test.ts'

export default [
  {
    name: '🍞 쇼핑 상세가 빵부스러기를 안 낸다 — 검색결과에 생 URL',
    why: '형제 셋(`/pass`·`/stays`·`/u/:handle`)은 다 내는데 쇼핑만 빠져 있었다. '
       + '빌드·화면 영향 0 이라 라이브를 파싱해서 센 사람만 안다.',
    file: META,
    find: 'JSON.stringify(breadcrumb ? [product, breadcrumb] : [product])',
    replace: 'JSON.stringify([product])',
    test: TEST,
  },
  {
    name: '🍞 조건을 무조건으로 — 이용권·숙소에도 쇼핑 빵부스러기가 붙는다',
    why: '정본이 `/pass/2919` 인 페이지가 `홈 › 쇼핑 › 닭도리탕` 을 주장하면, 같은 항목에 두 URL 이 '
       + '서로 다른 경로를 말한다(그 정본의 제 빵부스러기는 `홈 › 동네딜 › …`). 교환권은 noindex 인데 '
       + '쇼핑도 아니다. 빌더를 눈으로 보고서야 드러난 자리라 가드가 없으면 그대로 되돌아간다.',
    file: META,
    find: "const shopCrumb = !isDeal && canonicalPath == null && pathname.startsWith('/products/')",
    replace: "const shopCrumb = true",
    test: TEST,
  },
  {
    name: '🍞 중간 라벨을 손으로 적는다 — 표와 두 벌',
    why: "`/browse` 의 crumb 가 바뀌면 목록 표면의 빵부스러기만 따라가고 상세는 옛 라벨로 남는다(에러 0).",
    file: META,
    find: "? CONSUMER_SURFACE_SEO['/browse']?.crumb",
    replace: "? '쇼핑'",
    test: TEST,
  },
  {
    name: '🍞 중간 단계가 `/products` 를 가리킨다 — 없는 목록 URL',
    why: '쇼핑 목록의 주소는 `/browse` 다. `/products` 는 2026-10-12 수리로 **404 + noindex** 인 경로다 '
       + '— 빵부스러기가 404 를 가리키면 그 체인을 구글이 버린다.',
    file: META,
    find: "{ '@type': 'ListItem', position: 2, name: shopCrumb, item: `${origin}/browse` }",
    replace: "{ '@type': 'ListItem', position: 2, name: shopCrumb, item: `${origin}/products` }",
    test: TEST,
  },
  {
    name: '🍞 마지막 항목이 canonical 아닌 자기 경로',
    why: '빵부스러기 마지막은 현재 페이지의 **정본**이어야 한다. `pathname` 을 쓰면 canonical 과 '
       + '다른 URL 을 가리켜 서로 반대 신호가 된다(2026-10-12 오전 canonical 작업의 교훈).',
    file: META,
    find: "{ '@type': 'ListItem', position: 3, name, item: canonical },\n      ],\n    } : null",
    replace: "{ '@type': 'ListItem', position: 3, name, item: `${origin}${pathname}` },\n      ],\n    } : null",
    test: TEST,
  },
]
