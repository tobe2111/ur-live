/**
 * 🧬 주입 — **숙소 정본 단일화(#18) + thin 지역 noindex(#21)** (2026-10-12)
 *
 * 둘 다 되돌리면 **조용히** 종전으로 간다. 화면도 빌드도 안 깨지고, 달라지는 것은 크롤러가 보는 것뿐이다
 * (같은 상품이 두 URL 로 색인 경쟁 · thin 지역이 색인 가능). 그건 서치콘솔에서 대표만 본다.
 *
 * 🔴 ⑤가 가장 위험한 방향이다 — `요약 부재 → noindex` 로 뒤집으면 **배포 직후 지역 44개가 통째로**
 *    색인에서 빠지고(cron 이 아직 안 돌았거나 KV miss 면 전부 부재), 색인은 돌아오는 데 수주 걸린다.
 */
const M = 'src/worker/utils/detail-ssr-meta.ts'
const W = 'src/worker/index.ts'
const SM = 'src/worker/routes/sitemap.routes.ts'
const D = 'src/shared/seo/region-digest.ts'
const T = 'src/tests/unit/stay-canonical-thin-region-2026-10-12.test.ts'

export default [
  {
    name: '숙소 정본 — Product/AggregateOffer 를 안 만든다 (종전 상태: LodgingBusiness 만)',
    file: M,
    find: "    const product: Record<string, unknown> | null = fromPrice > 0 ? {\n      '@type': 'Product',",
    replace: "    const product: Record<string, unknown> | null = (false as boolean) ? {\n      '@type': 'Product',",
    test: T,
    why:
      '정확히 종전 상태다 — `/stays/:id` 가 "살 수 있는 것" 신호 0 으로 돌아간다. 그런데 그 페이지를 ' +
      'canonical 로 지목한 상태라, **리치 페이지에서 빈 페이지로 정본을 옮긴 것**이 되어 종전보다 나쁘다.',
  },
  {
    name: '숙소 정본 — 객실 가격 없이도 Offer 를 만든다 (가격을 지어낸다)',
    file: M,
    find: '    const product: Record<string, unknown> | null = fromPrice > 0 ? {',
    replace: '    const product: Record<string, unknown> | null = true ? {',
    test: T,
    why:
      '`lowPrice: 0` 짜리 `AggregateOffer` 를 발행한다 — 0원에 살 수 있다고 말하는 셈이고 구글 정책 ' +
      '위반이다(평점 0건에 `ratingValue: 0` 을 넣던 것과 같은 클래스).',
  },
  {
    name: '숙소 정본 — Offer 가 가리키는 매장 `@id` 를 없앤다 (매달린 참조)',
    file: M,
    find: "        availableAtOrFrom: { '@id': placeId },",
    replace: "        availableAtOrFrom: { '@id': `${canonical}#store` },",
    test: T,
    why:
      '정의된 노드가 `#place` 인데 `#store` 를 가리킨다 — 구글이 그 필드를 **버리면서 에러를 안 낸다**. ' +
      '2026-10-11 에 상세에서 같은 자리를 이미 한 번 밟았다.',
  },
  {
    name: '숙소 정본 — `/pass/:id` canonical 을 자기 자신으로 환원 (두 URL 색인 경쟁)',
    file: M,
    // 🔀 2026-10-12 재조준: `buildProductMeta` 도 같은 SSOT 를 쓰게 되면서 이 줄이 **두 곳**에
    //    맞게 됐다(그러면 러너가 어느 쪽을 고쳤는지 모른다). 결함은 한 글자도 안 바꾸고 앞줄을
    //    더해 `buildDetailMeta` 쪽으로 고유화한다 — `buildProductMeta` 는 삼항이라 모양이 다르다.
    find:
      "    const canonicalPath = canonicalDetailPath({ id: id ?? '', deal_only: d.deal_only, category: d.category })\n" +
      '    const canonical = `${origin}${canonicalPath && canonicalPath.startsWith(\'/\') ? canonicalPath : pathname}`',
    replace:
      "    const canonicalPath = canonicalDetailPath({ id: id ?? '', deal_only: d.deal_only, category: d.category })\n" +
      '    const canonical = `${origin}${pathname}`',
    test: T,
    why:
      '정확히 종전 상태다 — 같은 `products.id` 가 `/pass/2887` 과 `/stays/2887` **둘 다** 자기를 ' +
      '정본이라 선언한다. 둘 다 200 이고 둘 다 `index, follow` 라 아무 에러도 안 난다.',
  },
  {
    name: '숙소 정본 — sitemap 이 다시 `/pass/` 를 하드코딩 (sitemap ↔ ItemList 모순)',
    file: SM,
    find: '        const loc = canonicalDetailPath({ id: g.id, deal_only: g.deal_only, category: g.category });\n        if (!loc) continue;',
    replace: '        const loc = `/pass/${g.id}`;\n        if (!loc) continue;',
    test: T,
    why:
      '정확히 종전 상태다 — sitemap 은 숙소 49건을 `/pass/` 로 제출하는데 `/stays` ItemList·`/region` ' +
      '항목은 `/stays/` 를 가리킨다. 같은 상품을 두 주소로 말하는 신호인데 **빌드도 화면도 안 깨진다**.',
  },
  {
    name: '숙소 정본 — 크롤러 본문을 안 붙인다 (종전 6자 = 로더뿐)',
    file: W,
    // 🔀 2026-10-12 후속 재조준: 같은 날 서버 첫 화면이 생겨 배선이 [첫 화면 || (`<noscript>` + 로더)]
    //    가 됐다. 불변식은 그대로 — **로더만 남으면 본문이 6자로 되돌아간다**.
    find: 'el.setInnerContent(stayFirst || (stayNoscriptFromPayload(ssrPayload) + urdealLoaderHtml), { html: true });',
    replace: 'el.setInnerContent(urdealLoaderHtml, { html: true });',
    test: T,
    why:
      '정확히 종전 상태다 — 정본으로 지목된 페이지의 본문이 6자가 된다(구글이 thin content 로 보는 수준). ' +
      '`stayNs` 는 계산만 되고 안 쓰인다 — **tsc 도 안 막는다**(문자열 변수 미사용).',
  },
  {
    name: '숙소 정본 — 크롤러 본문이 로더를 **대체**한다 (JS 없는 사람에게 빈 화면)',
    file: W,
    // 🔀 재조준: 첫 화면 쪽은 로더를 **자기 안에** 품으므로(`shortLoader`), 이 결함이 사는 자리는
    //    이제 **폴백 경로**다 — 거기서 로더가 빠지면 하드로드 첫 프레임이 빈 화면이 된다.
    find: 'stayNoscriptFromPayload(ssrPayload) + urdealLoaderHtml',
    replace: 'stayNoscriptFromPayload(ssrPayload)',
    test: T,
    why:
      '로더가 사라져 하드로드 첫 프레임이 빈 화면이 된다. `<noscript>` 는 JS 가 돌면 렌더조차 안 되므로 ' +
      '**사람에게는 아무것도 안 보이고** 크롤러만 멀쩡해 보인다.',
  },
  {
    name: '🔴 thin 지역 — 요약이 없으면 noindex (부재 ≠ thin)',
    file: D,
    find: '  if (!digestJson) return false\n  if (!REGION_PATH_RE.test(pathname)) return false',
    replace: '  if (!digestJson) return true\n  if (!REGION_PATH_RE.test(pathname)) return false',
    test: T,
    why:
      '**이 세션에서 가장 위험한 방향이다.** cron 전·KV miss·조회 실패면 요약이 없으므로, 배포 직후 ' +
      '색인 대상 지역 **44개가 통째로** `noindex` 로 나간다. 데이터 부재는 thin 이 아니다.',
  },
  {
    name: '🔴 thin 지역 — 요약이 비면 noindex (같은 방향의 다른 문)',
    file: D,
    find: '  if (!rows.length) return false',
    replace: '  if (!rows.length) return true',
    test: T,
    why:
      '위와 같은 사고를 **다른 문**으로 만든다 — 파싱은 됐는데 행이 0 인 경우(봉투가 바뀌었거나 cron 이 ' +
      '빈 요약을 썼을 때). 문이 둘이라 한쪽만 잠그면 샌다.',
  },
  {
    name: 'thin 지역 — 교환권도 센다 (매장이 없는데 지역 딜로 집계)',
    file: D,
    // 🔀 2026-10-12 재조준: 같은 규칙이 `regionChildLinks` 의 세는 루프에도 생겨 이 한 줄이
    //   **두 곳**에 맞게 됐다(앵커는 유일해야 한다). `regionThinByDigest` 쪽 맥락까지 포함한다 —
    //   결함(thin 판정이 교환권을 센다)은 한 글자도 안 바꿨다.
    find: "  let n = 0\n  for (const r of rows) {\n    if (Number(r?.deal_only) === 1) continue",
    replace: "  let n = 0\n  for (const r of rows) {\n    if (false as boolean) continue",
    test: T,
    why:
      '교환권(기프티콘)은 매장이 없고 주소도 지역 딜이 아니다 — 그걸 세면 실제로는 thin 인 지역이 ' +
      '임계값을 넘어 **색인 가능한 빈 페이지**로 남는다(고치려던 결함 그대로).',
  },
  {
    name: 'thin 지역 — 임계값을 손으로 적는다 (sitemap 과 갈린다)',
    file: D,
    find: '  return n < REGION_INDEX_MIN_DEALS',
    replace: '  return n < 2',
    test: T,
    why:
      'sitemap 제출 게이트(`computeRegionStats`)는 `REGION_INDEX_MIN_DEALS` 를 쓴다 — 두 벌이 되면 ' +
      '**sitemap 이 제출한 URL 에 noindex 가 붙는** 서로 반대 신호가 조용히 생긴다.',
  },
  {
    name: '🔴 thin 지역 — 워커가 요약 대신 `crawlerPayload` 를 넘긴다 (MAIN 시드로 오판)',
    file: W,
    find: 'regionThinByDigest(url.pathname, digestRaw)',
    replace: 'regionThinByDigest(url.pathname, crawlerPayload)',
    test: T,
    why:
      '둘은 봉투 모양이 같아(`{success,data:[]}`) 받는 쪽이 **구분할 수 없다**. KV miss 면 MAIN 시드' +
      '(1페이지 50건, 서울 44 편중)가 흘러들어 **경기·전남·충남처럼 멀쩡한 지역이 noindex** 가 된다.',
  },
  {
    name: 'thin 지역 — 판정 결과를 메타에 반영하지 않는다 (계산만 하고 안 쓴다)',
    file: W,
    find: "const sm = sm0 && !sm0.noindex && regionThinByDigest(url.pathname, digestRaw) ? { ...sm0, noindex: true } : sm0;",
    replace: "const sm = sm0; void regionThinByDigest;",
    test: T,
    why:
      '2026-10-12 에 같은 레포에서 배운 것: **계산과 사용은 다른 자리다.** 판정이 멀쩡히 돌아도 메타에 ' +
      '안 붙으면 종전과 byte-동일이고, 함수는 멀쩡히 export 돼 있어 유닛 시험만 보면 초록이다.',
  },
  {
    name: 'thin 지역 — 리치결과 빌더에 **옛 메타**를 넘긴다 (색인 말라면서 리치결과를 준다)',
    file: W,
    find: 'jsonLd: buildSurfaceListJsonLd(url.pathname, url.search, origin2, sm, crawlerPayload)',
    replace: 'jsonLd: buildSurfaceListJsonLd(url.pathname, url.search, origin2, sm0!, crawlerPayload)',
    test: T,
    why:
      '`noindex` 를 붙인 메타가 아니라 갱신 전 메타를 넘기므로 `BreadcrumbList`·`CollectionPage` 가 ' +
      '그대로 나간다 — "색인하지 말라" 와 "리치결과를 달라" 를 같은 문서에서 동시에 말한다.',
  },
]
