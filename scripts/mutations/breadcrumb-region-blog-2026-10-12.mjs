/**
 * 🧬 주입 — **지역·블로그 빵부스러기** (2026-10-12)
 *
 * 되돌리면 전부 **조용히** 종전으로 간다. 화면도 빌드도 안 깨지고, 검색결과에서 빵부스러기 대신
 * 생 URL 이 뜰 뿐이다 — 그건 서치콘솔에서 대표만 볼 수 있다(실측 당시 67페이지가 그 상태였다).
 */
const S = 'src/worker/utils/surface-list-jsonld.ts'
const B = 'src/features/blog/api/blog-ssr-meta.ts'
const T = 'src/tests/unit/breadcrumb-region-blog-2026-10-12.test.ts'

export default [
  {
    name: '빵부스러기 — 지역 단계를 안 쌓는다 (종전 상태: 44개 전부 0건)',
    file: S,
    find: `  if (regionRef) {
    const sidoUrl = \`\${origin}/region/\${encodeURIComponent(regionRef.sido)}\``,
    replace: `  if (false as boolean) {
    const sidoUrl = \`\${origin}/region/\${encodeURIComponent(regionRef!.sido)}\``,
    test: T,
    why:
      '정확히 종전 상태다. 경로가 동적이라 표 조회가 한 단계도 못 쌓고 `trail.length === 1` 에서 ' +
      '걸려 **빵부스러기가 아예 안 나온다**(`ItemList` 는 나오므로 더 눈에 안 띈다).',
  },
  {
    name: '빵부스러기 — 지역 허브 단계를 뺀다 (체인이 한 단계로 줄어 아무것도 안 나온다)',
    file: S,
    find: "  if (pathname === '/region' || regionRef) {\n    trail.push({ name: REGION_HUB_CRUMB, url: `${origin}/region` })",
    replace: "  if (false as boolean) {\n    trail.push({ name: REGION_HUB_CRUMB, url: `${origin}/region` })",
    test: T,
    why: '`/region` 허브 자신은 단계가 하나뿐이 되어 빵부스러기가 사라진다.',
  },
  {
    name: '빵부스러기 — 지역 URL 을 정규화 전 값으로 만든다 (canonical 과 어긋난다)',
    file: S,
    find: '    const sidoUrl = `${origin}/region/${encodeURIComponent(regionRef.sido)}`',
    replace: '    const sidoUrl = `${origin}${pathname}`',
    test: T,
    why:
      '`/region/강원특별자치도` 가 canonical `/region/강원` 과 다른 URL 을 가리킨다 — 같은 페이지를 ' +
      '두 주소로 말하는 셈이고, 빵부스러기는 그대로 그려지니 **에러가 전혀 안 난다**.',
  },
  {
    name: '빵부스러기 — 목록 표면이 체인을 두 벌 싣는다 (종전 동작)',
    file: S,
    find: '    ...(trail.length > 1 ? { breadcrumb: breadcrumbRef(meta.canonical) } : {}),',
    replace: '    ...(trail.length > 1 ? { breadcrumb: breadcrumbNode(trail, meta.canonical) } : {}),',
    test: T,
    why:
      '정확히 종전 코드다. 같은 `BreadcrumbList` 가 `@graph` 와 `breadcrumb` 양쪽에 들어가 ' +
      '**사람이 받는 응답 바이트도 두 배**가 된다(이 JSON 은 크롤러 전용이 아니다).',
  },
  {
    name: '빵부스러기 — 목록 본문 노드가 체인을 안 가리킨다 (고아 체인)',
    file: S,
    find: '    ...(trail.length > 1 ? { breadcrumb: breadcrumbRef(meta.canonical) } : {}),',
    replace: '',
    test: T,
    why:
      '체인 노드는 남지만 페이지가 그걸 자기 빵부스러기라고 말하지 않는다 — 소비자가 그 둘을 ' +
      '묶을 근거가 없어진다.',
  },
  {
    name: '빵부스러기 — 블로그 시드가 없으면 통째로 안 낸다 (종전 동작)',
    file: B,
    find: `  if (!ssrPayload) {
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blogBreadcrumb(origin, canonical)] }))
  }`,
    replace: "  if (!ssrPayload) return ''",
    test: T,
    why:
      '정확히 종전 코드다. 빵부스러기는 **경로만으로** 만들어지는데 시드(콜드 self-fetch timeout)에 ' +
      '묶여 있어서, 그 경우 `/blog` 가 구조화 데이터를 하나도 못 받았다.',
  },
  {
    name: '빵부스러기 — 블로그가 체인을 두 벌 싣는다',
    file: B,
    find: "      breadcrumb: { '@id': crumb['@id'] },",
    replace: '      breadcrumb: crumb,',
    test: T,
    why: '같은 문서에 동일한 `BreadcrumbList` 가 둘이 된다. 틀린 건 아니지만 말을 두 번 하는 것이다.',
  },
  {
    name: '빵부스러기 — 블로그가 사이트 이름을 손으로 적는다',
    file: B,
    find: '    { name: CONSUMER_SITE_NAME, url: `${origin}/` },',
    replace: "    { name: '유어딜', url: `${origin}/` },",
    test: T,
    why:
      '지금은 같은 값이라 **아무것도 안 깨진다** — 그래서 통과하기 쉽다. 브랜드 표기가 바뀌는 날 ' +
      '블로그만 옛 이름으로 남고, 그건 검색이 우리를 다른 엔티티로 읽게 만든다.',
  },
]
