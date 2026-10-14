/**
 * 🧹 블로그 목록 JSON-LD (2026-10-14) — 되돌려-검증 매니페스트.
 *
 * 불변식: ① 같은 글을 두 벌 내지 않는다 ② 항목·순번·상한·`numberOfItems` 는 그대로
 * ③ 브랜드 노드는 `@id` 참조(인라인 금지) ④ 시드 없음·0건이면 빵부스러기만.
 */
export default [
  {
    name: '🧹 blogPost 를 되살린다 (20편이 다시 두 벌 — 문서의 61%였던 그 자리)',
    file: 'src/features/blog/api/blog-ssr-meta.ts',
    find: "      mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items },",
    replace: "      blogPost: items.map(it => it.item),\n      mainEntity: { '@type': 'ItemList', itemListElement: items },",
    test: 'src/tests/unit/blog-list-jsonld-dedupe-2026-10-14.test.ts',
    why: '라이브 실측 그대로의 결함 — 모든 방문자가 쓸모없는 8KB 를 더 받는다.',
  },
  {
    name: '🧹 numberOfItems 선언을 뺀다 (소비자 표면과 갈린다)',
    file: 'src/features/blog/api/blog-ssr-meta.ts',
    find: "'@type': 'ItemList', numberOfItems: items.length, itemListElement: items",
    replace: "'@type': 'ItemList', itemListElement: items",
    test: 'src/tests/unit/blog-list-jsonld-dedupe-2026-10-14.test.ts',
    why: 'ItemList 권장 필드이고 다른 표면은 전부 선언한다.',
  },
  {
    name: '🧹 publisher 를 인라인 Organization 으로 (노드 42개였던 그 자리)',
    file: 'src/features/blog/api/blog-ssr-meta.ts',
    find: "      '@type': 'Blog', name, description, url: canonical,\n      publisher: { '@id': `${origin}/#organization` },",
    replace: "      '@type': 'Blog', name, description, url: canonical,\n      publisher: { '@type': 'Organization', name: '유어딜' },",
    test: 'src/tests/unit/blog-list-jsonld-dedupe-2026-10-14.test.ts',
    why: '브랜드 노드는 index.html 의 #organization 하나를 가리켜야 한다(매달린 참조 0 유지).',
  },
  {
    name: '🧹 항목 상한을 없앤다 (전량 덤프)',
    file: 'src/features/blog/api/blog-ssr-meta.ts',
    find: 'posts.slice(0, 20).filter(p => p && p.slug && p.title)',
    replace: 'posts.filter(p => p && p.slug && p.title)',
    test: 'src/tests/unit/blog-list-jsonld-dedupe-2026-10-14.test.ts',
    why: '사람이 받는 응답에도 실리므로 요약이지 덤프가 아니다.',
  },
  {
    name: '🧹 빵부스러기 참조를 매달린 @id 로 (같은 @graph 밖을 가리킨다)',
    file: 'src/features/blog/api/blog-ssr-meta.ts',
    find: "      breadcrumb: { '@id': crumb['@id'] },\n    }\n    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blog, crumb] }))",
    replace: "      breadcrumb: { '@id': crumb['@id'] },\n    }\n    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blog] }))",
    test: 'src/tests/unit/blog-list-jsonld-dedupe-2026-10-14.test.ts',
    why: '정의되지 않은 @id 를 가리키면 구글이 그 필드를 버린다(2026-10-12 에 값을 치른 자리).',
  },
]
