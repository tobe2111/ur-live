/**
 * 🧬 주입 — 인플루언서 국가 필터 (2026-11-14)
 *    가드: src/tests/unit/influencer-country-filter-2026-11-14.test.ts
 *    대표: "유튜브 같은 경우에는 외국인들도 있을텐데 … 필터링을 할 수 있게 해줘"
 */
const T = 'src/tests/unit/influencer-country-filter-2026-11-14.test.ts'
const C = 'src/shared/ads/influencer-country.ts'
export default [
  { name: '국가필터 — 한국에서 미표기 한국어 채널을 뺀다', file: C,
    find: "  if (v === 'KR') return { sql: `(country = 'KR' OR (${NO_COUNTRY_SQL} AND ${KO_TEXT_SQL}))`, binds: [] }",
    replace: "  if (v === 'KR') return { sql: `country = 'KR'`, binds: [] }", test: T,
    why: '미표기의 94%(5,367명)가 한국 채널인데 한국 필터에서 빠진다.' },
  { name: '국가필터 — 외국에 해외 거주 한국어 채널이 섞인다', file: C,
    find: "  if (v === 'foreign') return { sql: `((${FOREIGN_DECLARED_SQL} OR ${NO_COUNTRY_SQL}) AND NOT ${KO_TEXT_SQL})`, binds: [] }",
    replace: "  if (v === 'foreign') return { sql: `(${FOREIGN_DECLARED_SQL} OR ${NO_COUNTRY_SQL})`, binds: [] }", test: T,
    why: "'US' 로 적은 보람튜브 같은 한국 채널이 외국인 목록에 들어간다." },
  { name: '국가필터 — 국가 코드를 검사 없이 SQL 에 넣는다', file: C,
    find: "  if (/^[A-Z]{2}$/.test(v)) return { sql: 'country = ?', binds: [v] }",
    replace: "  return { sql: `country = '${v}'`, binds: [] }", test: T,
    why: '쿼리스트링이 그대로 SQL 이 된다.' },
  { name: '국가필터 — 엑셀이 화면 국가를 무시한다', file: 'src/pages/admin/influencer-pool/ExcelExportButtons.tsx',
    find: "${country ? `&country=${encodeURIComponent(country)}` : ''}", replace: '', test: T,
    why: '화면은 한국만 보는데 파일엔 외국 채널이 섞여 나간다(조용한 불일치).' },
]
