/**
 * 🔗 정본 주소 불변식 셋 (2026-10-12, 대표 "다 개선하고 또 개선할 것 있는지 찾아줘") — 주입 매니페스트.
 * 가드: src/tests/unit/canonical-facet-entity-2026-10-12.test.ts
 *
 * 셋 다 **에러가 안 난다** — 빌드도 테스트도 초록이고 화면도 안 깨진다. 크롤러만 영향을 받으므로
 * 재 본 사람만 안다. 그래서 절반을 **반대 방향**(과차단·신호 충돌)으로 심었다: 이 영역에서
 * "너무 많이 막는" 쪽이 "덜 막는" 쪽보다 피해가 크다(색인은 빠지면 돌아오는 데 수주다).
 */
const TEST = 'src/tests/unit/canonical-facet-entity-2026-10-12.test.ts'

export default [
  {
    name: '🔗 필터 canonical 이 값 검증을 건너뛴다 — 무한 thin URL 복귀',
    file: 'src/shared/seo/consumer-surfaces.ts',
    find: '    if (ok && !ok.includes(v.trim())) continue',
    replace: '    if (false) continue',
    test: TEST,
    why: '허용 *키*만 보고 값은 비어 있지 않으면 통과시키면 `?category=테스트123` 이 자기 자신을 정본이라 선언한다(실측 43자).',
  },
  {
    name: '🔗 제목 접두가 검증을 건너뛴다 — 없는 카테고리의 정체성을 지어낸다',
    file: 'src/shared/seo/consumer-surfaces.ts',
    find: '      return !ok || ok.includes(v) ? v : undefined',
    replace: '      return v',
    test: TEST,
    why: 'canonical 만 고치면 `<title>테스트123 기프티콘 교환권…</title>` 과 같은 `og:title` 이 그대로 나간다 — 공유 카드에도 실린다.',
  },
  {
    name: '🔗 brand 축이 되살아난다 — 검증할 목록이 없는 축을 보존',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "    canonicalParams: ['category'],\n    canonicalParamValues: { category: VOUCHER_FILTER_CATEGORIES },",
    replace: "    canonicalParams: ['category', 'brand'],\n    canonicalParamValues: { category: VOUCHER_FILTER_CATEGORIES },",
    test: TEST,
    why: '브랜드는 DB 에서 오는 82종이라 허용 목록을 만들 수 없고 sitemap 도 한 건도 제출하지 않는다 — 보존하면 그게 곧 무한 URL 이다.',
  },
  {
    name: '🔗 반대 방향 — 제목 축까지 떼서 살아 있는 딥링크의 제목을 죽인다',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "    titleParams: ['brand', 'category'],\n",
    replace: "",
    test: TEST,
    why:
      '🔴 **2026-10-12 에 제가 실제로 이렇게 했다가 기존 가드에 잡혔다.** `?brand=` 는 브랜드 칩이 ' +
      '만드는 살아 있는 사용자 링크이고(`VouchersPage` 가 그 값으로 필터), ' +
      '`consumer-surface-seo.test.ts` 가 *"브랜드가 카테고리보다 우선"* 을 일부러 잠가 뒀다. ' +
      'canonical 이 통합하므로 색인 피해가 없는데 기능만 죽는다.',
  },
  {
    name: '🔗 제목 축이 canonical 축을 다시 겸한다 — 묶이면 한쪽을 못 고친다',
    file: 'src/shared/seo/consumer-surfaces.ts',
    find: "  const titleKeys = entry.titleParams ?? entry.canonicalParams",
    replace: "  const titleKeys = entry.canonicalParams",
    test: TEST,
    why:
      '이 묶임이 **진짜 설계 결함**이었다 — canonical 보존("이 URL 을 색인해 달라")과 제목 접두 ' +
      '("이 화면이 무엇인지")는 다른 질문인데 한 필드가 둘을 결정하니, 무한 URL 을 막으려고 축을 ' +
      '떼면 딥링크 제목까지 같이 죽는다.',
  },
  {
    name: '🔗 허용 집합이 비어 버린다 — 멀쩡한 카테고리가 통째로 통합된다',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "export const VOUCHER_FILTER_CATEGORIES: readonly string[] = [\n  '커피/음료',",
    replace: "export const VOUCHER_FILTER_CATEGORIES: readonly string[] = [\n  // '커피/음료',",
    test: TEST,
    why: '🔴 반대 방향. 목록이 쪼그라들면 색인 대상 카테고리가 조용히 `/vouchers` 로 합쳐지고, sitemap 제출분도 `filter` 에서 떨어진다.',
  },
  {
    name: '🔗 경로 정규화가 중복 슬래시를 안 접는다',
    file: 'src/shared/seo/consumer-surfaces.ts',
    find: '  const collapsed = pathname.replace(/\\/{2,}/g, \'/\')',
    replace: '  const collapsed = pathname',
    test: TEST,
    why: '`//vouchers` 가 자기 자신을 정본이라 선언했고, 그보다 나쁜 건 표 조회가 실패해 **메타가 통째로 null** 이던 것이다.',
  },
  {
    name: '🔗 sitemap 이 카테고리를 손으로 적는다 — canonical 과 갈린다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: "const SITEMAP_VOUCHER_FALLBACK: readonly string[] = ['편의점', '커피/음료', '베이커리/도넛']\n  .filter((c) => VOUCHER_FILTER_CATEGORIES.includes(c))",
    replace: "const SITEMAP_VOUCHER_FALLBACK: readonly string[] = ['편의점', '커피/음료', '베이커리/도넛']",
    test: TEST,
    why: '제출분이 허용분의 부분집합이 아니면 *제출한 URL 의 정본이 딴 곳을 가리키는* 모순이 조용히 생긴다(2026-07-29 영문 슬러그 6건이 그 사고였다). '
       + '🔁 2026-10-18 재조준: 제출이 D1 재고 집계로 바뀌어 이 배열은 **집계 실패 폴백**이 됐다(이름만 바뀌었고 부분집합 불변식은 그대로 — 폴백도 제출이다).',
  },
  {
    name: '🔗 /products 가 다시 자기자신을 정본으로 — 상품 360건 색인 경쟁',
    file: 'src/worker/utils/detail-ssr-meta.ts',
    find: '    const canonicalPath = isDeal\n      ? null\n      : canonicalDetailPath({ id: id ?? \'\', deal_only: d.deal_only, category: d.category })',
    replace: '    const canonicalPath = null',
    test: TEST,
    why: '같은 상품이 `/pass/2919`·`/products/2919` 로 각각 자기를 정본이라 선언하면 구글은 둘 다 무시하고 자기가 고른다.',
  },
  {
    name: '🔗 교환권에 cross-canonical 을 겹친다 — noindex 와 반대 신호',
    file: 'src/worker/utils/detail-ssr-meta.ts',
    find: '    const canonicalPath = isDeal\n      ? null\n      : canonicalDetailPath',
    replace: '    const canonicalPath = false\n      ? null\n      : canonicalDetailPath',
    test: TEST,
    why: '🔴 반대 방향. "이 페이지를 X 로 합쳐라" + "색인하지 마라" 는 서로 반대다. 색인 안 하는 URL 은 합칠 것도 없으니 종전 그대로 둬야 한다.',
  },
  {
    name: '🔗 상품 상세 API 가 다시 400 을 준다 — soft-404 복귀',
    file: 'src/features/products/api/products.routes.ts',
    // ⚠️ 앵커는 **상세 핸들러 전용 모양**(`if (isNaN(id)) {` 블록)으로 고유화한다 — 같은 파일의
    //    하위 리소스들은 `if (isNaN(id)) return ...` 한 줄이고, `'Product not found'` 문자열만으로는
    //    에러 핸들러 네 곳에도 맞는다.
    // 🔀 2026-10-12 재조준: 파일 래칫에 맞추려고 그 6줄 블록을 **형제 핸들러와 같은 1줄**로 모았다.
    //    앵커는 `'Product not found' }, 404` 로 고유하다 — 같은 파일의 하위 리소스·쓰기 핸들러는
    //    `'Invalid product ID' }, 400` 이고, 에러 핸들러의 404 는 여러 줄 모양이다.
    find: "if (isNaN(id)) return c.json({ success: false, error: 'Product not found' }, 404);",
    replace: "if (isNaN(id)) return c.json({ success: false, error: 'Invalid product ID' }, 400);",
    test: TEST,
    why: '워커 술어는 `self-fetch-404` 에만 걸린다 — 400 이면 `/products/abc` 가 `200 + index, follow` 로 색인 가능해진다(무한 thin URL).',
  },
  {
    name: '🔗 공구 상세 API 가 다시 400 을 준다',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: "      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)",
    replace: "      return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)",
    test: TEST,
    why: '`/vouchers/abc`·`/pass/abc`·`/group-buy/abc` 가 전부 이 엔드포인트를 지난다 — 한 자리가 세 라우트를 결정한다.',
  },
  {
    name: '🔗 숙소 상세 API 가 다시 400 을 준다',
    file: 'src/features/group-buy/api/stays-public.routes.ts',
    find: "    if (!Number.isFinite(productId)) return c.json({ success: false, error: '숙소를 찾을 수 없습니다' }, 404)",
    replace: "    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'Invalid productId' }, 400)",
    test: TEST,
    why: '`/stays/abc` 가 색인 가능해진다. 2026-10-12 에 `/stays/:id` 가 정본이 됐으므로 그 축의 쓰레기 URL 이 바로 정본 자리를 차지한다.',
  },
  {
    name: '🔗 하위 리소스까지 404 로 쓸어버린다 — "저장 실패" 를 "없음" 이라 말한다',
    file: 'src/features/products/api/products.routes.ts',
    find: "  if (isNaN(id)) return c.json({ success: false, error: 'Invalid product ID' }, 400);",
    replace: "  if (isNaN(id)) return c.json({ success: false, error: 'Invalid product ID' }, 404);",
    test: TEST,
    why: '🔴 반대 방향. 세 응답(읽기 404 · 쓰기 400 · 가용성 200)은 각자 다른 사고를 막는다 — 일관성을 이유로 한쪽으로 몰면 안 된다.',
  },
  {
    name: '🔗 술어를 400 으로 넓힌다 — API 를 고치는 대신 쉬운 길',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "  return ENTITY_SLOTS.has(slot) && ssrStatus === 'self-fetch-404'",
    replace: "  return ENTITY_SLOTS.has(slot) && (ssrStatus === 'self-fetch-404' || ssrStatus === 'self-fetch-400')",
    test: TEST,
    why: '🔴 반대 방향이고 **2026-10-12 에 제가 실제로 이 길을 갔다가 기존 주입에 잡혔다**. 일시적 400 이 영구 noindex 가 된다.',
  },
]
