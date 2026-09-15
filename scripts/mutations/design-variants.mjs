/**
 * 🎨 시안 갤러리 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/design-variants-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/design-variants-2026-09-15.test.ts'

export default [
  {
    name: '🎨 시안 갤러리가 robots 차단에서 빠진다 (가짜 숫자가 검색에 뜬다)',
    file: 'public/robots.txt',
    find: 'Disallow: /design/\n',
    replace: '',
    test: TEST,
    why: '어디에서도 링크하지 않아도 주소는 샌다 — 색인되면 가짜 매출이 검색 결과에 남는다.',
  },
  {
    name: '🎨 시안 갤러리가 noindex 를 안 건다 (robots 가 서빙 안 되면 무방비)',
    file: 'src/pages/design-variants/DesignVariantsPage.tsx',
    find: 'url="/design/variants" noindex',
    replace: 'url="/design/variants"',
    test: TEST,
    why: '2026-07-29 에 라이브 robots.txt 가 Cloudflare Managed 로 통째 대체된 적이 있다 — 그때 남는 방어가 이 한 줄이다.',
  },
  {
    name: '🎨 시안이 실제 API 를 부른다 (편의 도구가 라이브를 건드릴 수 있게 된다)',
    file: 'src/pages/design-variants/sets/seller-analytics.tsx',
    find: 'const pick = (c: VariantCtx) => (c.data === \'full\' ? FULL : EMPTY)',
    replace: 'const pick = (c: VariantCtx) => { void fetch(\'/api/seller/analytics\'); return c.data === \'full\' ? FULL : EMPTY }',
    test: TEST,
    why: '시안은 가짜 데이터로만 그린다 — 그래야 이 화면이 무엇도 망가뜨릴 수 없다.',
  },
  {
    name: '🎨 시안 갤러리가 정적 import 로 바뀐다 (모든 소비자가 안 쓰는 코드를 받는다)',
    file: 'src/App.tsx',
    find: "const DesignVariantsPage = lazy(() => import('./pages/design-variants/DesignVariantsPage'))",
    replace: "import DesignVariantsPage from './pages/design-variants/DesignVariantsPage'",
    test: TEST,
    why: '내부 도구 하나 때문에 소비자 첫 페인트가 무거워진다.',
  },
  {
    name: '🎨 세트 등록 키와 본문 id 가 갈린다 (URL 이 안 맞는다)',
    file: 'src/pages/design-variants/sets/seller-analytics.tsx',
    find: "  id: 'seller-analytics',\n  label: '셀러 매출 분석',",
    replace: "  id: 'analytics',\n  label: '셀러 매출 분석',",
    test: TEST,
    why: '`?set=` 은 등록 키를 쓰는데 본문 id 가 다르면 대표가 연 주소와 그려지는 세트가 어긋난다.',
  },
  {
    name: '🎨 목록 미러가 로더와 갈린다 (이름은 있는데 못 여는 세트)',
    file: 'src/pages/design-variants/registry.ts',
    find: "  { id: 'seller-analytics', label: '셀러 매출 분석', route: '/seller/analytics' },",
    replace: "  { id: 'seller-analytics-v2', label: '셀러 매출 분석', route: '/seller/analytics' },",
    test: TEST,
    why: 'lazy 라 이름을 두 곳에 적는다 — 갈리면 목록엔 뜨는데 눌러도 안 열린다.',
  },
  {
    name: '🎨 기준선("지금")이 사라진다 (좋아졌는지 알 수 없다)',
    file: 'src/pages/design-variants/sets/seller-analytics.tsx',
    find: "{ id: 'a', label: '안 A · 지금'",
    replace: "{ id: 'a', label: '안 A'",
    test: TEST,
    why: '바꾸기 전 화면이 목록에 없으면 세 안 중 무엇이 개선인지 판단할 기준이 없다.',
  },
  {
    name: '🎨 데이터 스위치가 시안에 안 닿는다 (0 일 때 무너지는 걸 못 본다)',
    file: 'src/pages/design-variants/DesignVariantsPage.tsx',
    find: 'v.render({ data: dataMode })',
    replace: "v.render({ data: 'full' })",
    test: TEST,
    why: '대표가 불편해한 화면은 숫자가 전부 0 이었다 — 데이터가 있을 때만 보면 그 문제가 안 보인다.',
  },
  {
    name: '🎨 열자마자 한 장만 뜬다 (기본이 "하나씩" 으로 되돌아감)',
    file: 'src/pages/design-variants/DesignVariantsPage.tsx',
    find: "const side = params.get('side') !== '0'",
    replace: "const side = params.get('side') === '1'",
    test: TEST,
    why: '실사고 2026-09-15 — 기본이 한 장이면 첫 안(= 지금 쓰는 화면)만 떠서 "시안이 안보이는데?" 가 된다.',
  },
  {
    name: '🎨 나란히인데 첫 안만 그린다',
    file: 'src/pages/design-variants/DesignVariantsPage.tsx',
    find: 'const shown = set ? (side ? set.variants : set.variants.filter',
    replace: 'const shown = set ? (false ? set.variants : set.variants.filter',
    test: TEST,
    why: '나란히를 켜도 한 장만 나오면 비교 도구가 아니다.',
  },
  {
    name: '🎨 안 개수 표시가 사라진다 (한 장만 보여도 이상한 줄 모른다)',
    file: 'src/pages/design-variants/DesignVariantsPage.tsx',
    find: ', 안 {set.variants.length}개',
    replace: '',
    test: TEST,
    why: '"안 3개" 라고 적혀 있어야 한 장만 뜬 날 화면이 스스로 어긋남을 말해 준다.',
  },
]
