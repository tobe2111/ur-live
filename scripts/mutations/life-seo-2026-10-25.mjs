// 🏠 사장님 생활 서비스 검색 노출 (2026-10-25) — `src/tests/unit/life-seo-2026-10-25.test.ts` 가 잡아야 하는 결함.
const TEST = 'src/tests/unit/life-seo-2026-10-25.test.ts'
export default [
  {
    name: '🏠 robots 가 업종 견적 페이지를 다시 막는다',
    file: 'public/robots.txt',
    find: 'Disallow: /life/requests\n',
    replace: 'Disallow: /life/request\n',
    test: TEST,
    why: '개인 목록(/life/requests)을 막으려던 접두가 업종 페이지 17개까지 막아 색인이 0 이었다(수리 전 라이브).',
  },
  {
    name: '🏠 생활 허브 크롤러 본문에서 업종 링크가 빠진다',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '...lifeChildLinks(path)]',
    replace: ']',
    test: TEST,
    why: '업종 페이지 17개가 sitemap 으로만 발견되고 허브에서 이어지는 링크가 0 이 된다.',
  },
  {
    name: '🏠 업종 페이지 구조화 데이터가 사라진다',
    file: 'src/worker/utils/surface-list-jsonld.ts',
    find: '  nodes.push(...lifeJsonLdNodes(path, origin, meta.canonical))',
    replace: '  nodes.push(...[])',
    test: TEST,
    why: 'Service(대상 사업자)가 없으면 AI 검색이 일반 소비자 이사·청소 앱과 구분할 신호가 없다.',
  },
]
