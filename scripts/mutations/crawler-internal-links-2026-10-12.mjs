/**
 * 🔗 2026-10-12 — 크롤러 문서의 내부 링크 주입.
 *
 * 시험: src/tests/unit/crawler-internal-links-2026-10-12.test.ts
 * 근거(라이브, Googlebot UA 로 `<a href>` 를 셌다): 목록·지역 표면이 전부 **a태그 0** 이었다.
 * 허브 → 상세 방향이 통째로 비어 있었고, 양쪽(링크를 낸다 / 교환권엔 안 낸다)을 같이 잠근다.
 */
const NS = 'src/worker/utils/crawler-noscript.ts'
// 🔁 2026-10-14 — 행·글자 조립이 `crawler-noscript-rows.ts` 로 **추출**됐다(685줄 → 래칫 600 초과).
//    아래 앵커들의 결함은 한 글자도 안 바꿨고 **파일 경로만** 따라갔다.
const NS_ROWS = 'src/worker/utils/crawler-noscript-rows.ts'
const TEST = 'src/tests/unit/crawler-internal-links-2026-10-12.test.ts'

export default [
  {
    name: '🔗 목록 행을 링크로 안 감싼다 (종전 동작 — 글만)',
    why: 'JSON-LD `ItemList` 는 "이 목록의 항목" 이라는 설명이고, 크롤 발견과 내부 링크 가치는 '
       + '`<a href>` 가 만든다. JS 를 안 돌리는 Yeti·AI 검색봇에겐 이 문서가 전부다.',
    file: NS_ROWS,
    // 🔁 2026-10-14 재조준: `liOf` 가 사진을 품으며 `${esc(r.text)}` → `${body}` 로 바뀌었다.
    //    불변식(행을 링크로 감싼다)은 그대로다.
    find: "return `<li>${r.href ? `<a href=\"${esc(r.href)}\">${body}</a>` : body}</li>`",
    replace: "return `<li>${esc(r.text)}</li>`",
    test: TEST,
  },
  {
    name: '🔗 교환권에도 링크를 낸다 — noindex 2,260건에 크롤 예산',
    why: '교환권 상세는 2026-07-07 결정으로 noindex 다. 링크를 열면 *색인하지 말라고 한 URL* 로 '
       + '크롤 예산이 빠진다(그 쪽은 에러가 안 나고 순위만 조용히 깎인다).',
    file: NS_ROWS,
    find: "  if (p?.deal_only === 1) return null\n  if (p?.id == null || p.id === '') return null",
    replace: "  if (p?.id == null || p.id === '') return null",
    test: TEST,
  },
  {
    name: '🔗 쇼핑 폴백을 뺀다 — `/browse`·`/map` 의 쇼핑 상품만 링크를 잃는다',
    why: '`canonicalDetailPath` 는 순수 쇼핑 상품에 `null`(= cross-canonical 아님)을 준다. '
       + '그걸 "링크 없음" 으로 읽으면 쇼핑만 조용히 글로 남는다 — 첫 판이 실제로 그랬고 '
       + '빌더를 눈으로 보고서야 드러났다.',
    file: NS_ROWS,
    find: "    || FLOW_CONFIG.standard_checkout.detailPath(p.id)",
    replace: "    || null",
    test: TEST,
  },
  {
    name: '🔗 주소를 손으로 조립한다 — ItemList·sitemap 과 세 벌',
    why: '같은 상품이 서로 다른 URL 로 제출되면 색인이 갈린다. 2026-10-12 에 `/pass`↔`/stays`↔'
       + '`/products` 로 같은 상품이 경쟁하던 것을 고친 그 자리다.',
    file: NS_ROWS,
    find: "  const path = canonicalDetailPath({ id: p.id, deal_only: p.deal_only, category: p.category })",
    replace: "  const path = `/products/${p.id}`",
    test: TEST,
  },
  {
    name: '🔗 href 를 탈출하지 않는다 — 속성이 끊긴다',
    why: "상품 id·주소에 따옴표가 섞이면 `href=\"…\" onmouseover=…` 로 속성이 끊긴다. "
       + '글자 쪽 탈출(`esc(r.text)`)만 있으면 주소 쪽은 무방비다.',
    file: NS_ROWS,
    find: '`<a href="${esc(r.href)}">',
    replace: '`<a href="${r.href}">',
    test: TEST,
  },
  {
    name: '🔗 id 가 없어도 링크를 만든다 — 빈 주소',
    why: '시드에 `id` 가 없는 행이 실제로 있다(실측). 그때 `/products/undefined` 같은 주소를 내면 '
       + '크롤러가 404 를 받고, 그 404 는 2026-10-12 수리로 **noindex** 라 신호만 낭비된다.',
    file: NS_ROWS,
    find: "  if (p?.id == null || p.id === '') return null",
    replace: "  if (false) return null",
    test: TEST,
  },
]
