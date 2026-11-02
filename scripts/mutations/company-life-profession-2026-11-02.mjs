/**
 * 🧬 주입 — 파트너 풀 생활 업종 4종 + 전문직 수집 (2026-11-02)
 *    가드: src/tests/unit/company-life-profession-2026-11-02.test.ts
 *    대표: "응 모아줘. 필요해. 전문직종과 생활 카테고리 모두 각자 넣어줘야지"
 */
const T = 'src/tests/unit/company-life-profession-2026-11-02.test.ts'
const C = 'src/features/marketing/api/company-classify.ts'
export default [
  {
    name: '생활업종 — 청소년을 청소로 본다',
    file: C,
    find: '(청소(?!년)|',
    replace: '(청소|',
    test: T,
    why: '`푸른청소년수련관` 이 청소 업체 후보로 들어간다.',
  },
  {
    name: '생활업종 — 주방설비를 수리의 설비가 가로챈다',
    file: C,
    find: '((?<!주방\\s*)설비|',
    replace: '(설비|',
    test: T,
    why: '인테리어/주방설비 업체가 수리·설치로 옮겨 간다.',
  },
  {
    name: '생활업종 — 누수·방수 규칙을 뺀다(인테리어의 시공이 가로챈다)',
    file: C,
    find: "  { re: /(누수|방수|하수구|변기\\s*막힘|배관\\s*막힘)/, category: '수리·설치', subcategory: '누수·방수', tier: 3, type: 'partner' },\n",
    replace: '',
    test: T,
    why: '순서가 규칙이다 — `동네방수시공` 이 인테리어/인테리어·시공으로 간다.',
  },
  {
    name: '생활업종 — 5단계 검색어를 빼 버린다',
    file: 'src/features/marketing/api/company-keyword-grid.ts',
    find: '    ...S2_REGIONS.flatMap(r => S5_TRADES_LIFE.map(',
    replace: '    ...[].flatMap(r => S5_TRADES_LIFE.map(',
    test: T,
    why: '분류 칸만 있고 검색어가 없으면 애초에 안 모인다(이번 사고의 원인 그대로).',
  },
]
