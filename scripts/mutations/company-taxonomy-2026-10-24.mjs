/**
 * 🧬 주입 — 업종 분류 정본: 전문직을 국가자격 단위로 (2026-10-24 대표 지시)
 *    가드: src/tests/unit/company-taxonomy-2026-10-24.test.ts
 *          src/tests/unit/reclassify-verdict-delta.test.ts
 *    대표: "법조계, 뭐 그런 업종 구별이 더 체계적으로 잘 되어야 함. 지금은 정확도가 많이 낮음."
 */
const T = 'src/tests/unit/company-taxonomy-2026-10-24.test.ts'
const V = 'src/tests/unit/reclassify-verdict-delta.test.ts'
const X = 'src/features/marketing/api/company-taxonomy.ts'
const C = 'src/features/marketing/api/company-classify.ts'
const S = 'src/features/marketing/api/company-save.ts'
const D = 'src/features/marketing/api/company-discovery.ts'
const I = 'src/features/marketing/api/store-info-collect.ts'
export default [
  {
    name: '업종정본 — 세무사/회계사 순서를 뒤집는다',
    file: X,
    find: "  ['세무사', /세무사|세무법인|세무회계|기장대리/],\n  ['회계사', /공인회계사|회계법인|회계사무소/],",
    replace: "  ['회계사', /공인회계사|회계법인|회계사무소/],\n  ['세무사', /세무사|세무법인|세무회계|기장대리/],",
    test: T,
    why: '`윤순혁세무회계사무소` 는 `회계사무소` 를 부분문자열로 품는다 — 순서가 뒤집히면 세무사가 회계사가 된다.',
  },
  {
    name: '업종정본 — 노무사/변호사 순서를 뒤집는다',
    file: X,
    find: "  ['노무사', /노무사|노무법인|인사노무|노동법률/],",
    replace: "  ['변호사', /변호사|법무법인|법률사무소|법률사무|로펌/],\n  ['노무사', /노무사|노무법인|인사노무|노동법률/],",
    test: T,
    why: '`노동법률사무소`(공인노무사 사무소)가 `법률사무소` 에 먼저 걸려 변호사로 분류된다.',
  },
  {
    name: '업종정본 — 건축사 규칙을 일반어로 넓힌다',
    file: X,
    find: "  ['건축사', /건축사사무소/],",
    replace: "  ['건축사', /건축사/],",
    test: T,
    why: '`삼성건축사업부` 처럼 `건축사` 를 품은 일반어가 전문직으로 분류된다.',
  },
  {
    name: '업종정본 — 옛 bare `기장` 오탐으로 되돌린다',
    file: X,
    find: '기장대리/],',
    replace: '기장/],',
    test: T,
    why: '부산 기장군 상호(`기장물산(주)`·`기장해녀수산`)가 세무사로 분류된다 — 라이브에서 실제로 그랬다.',
  },
  {
    name: '업종정본 — 통신판매 신고를 자격으로 덮는다',
    file: X,
    find: "export const PROFESSION_REFINE_BLOCKED = new Set(['온라인판매'])",
    replace: "export const PROFESSION_REFINE_BLOCKED = new Set<string>([])",
    test: T,
    why: '통신판매업 신고는 별개 축의 등록부 사실이다 — 덮으면 그 축의 통계가 망가진다.',
  },
  {
    name: '업종정본 — 중복 라벨 통합을 무력화한다',
    file: X,
    find: '  return CANON_SUBCATEGORY[s] ?? s',
    replace: '  return s',
    test: T,
    why: '같은 업종이 두 칸(`마케팅 대행사` 1,587 ↔ `마케팅대행` 7,759)으로 갈려 필터·세그먼트가 반으로 쪼개진다.',
  },
  {
    name: '업종정본 — classifyLead 에서 자격 판정을 떼어낸다',
    file: C,
    find: '  const prof = nameIsGeneric ? null : classifyProfession(name)\n  if (prof) return',
    replace: '  const prof: string | null = null\n  if (prof) return',
    test: T,
    why: '자격 판정이 사라지면 전문직이 거친 BIZ_RULES/키워드 라벨로 떨어진다(법조계가 대행사로).',
  },
  {
    name: '업종정본 — 키워드 라벨 통합을 되돌린다',
    file: C,
    find: '    subcategory: canonSubcategory(input.subcategory),',
    replace: '    subcategory: input.subcategory ?? null,',
    test: T,
    why: '키워드에서 온 라벨이 정본으로 통합되지 않아 같은 업종이 두 칸으로 남는다.',
  },
  {
    name: '업종정본 — 저장 경로의 등록부 정밀화를 제거한다',
    file: S,
    find: '        const ref = refineRegistryLabel(l)\n        return { ...l, category: ref.category, subcategory: ref.subcategory, tier: ref.tier, _type: t,',
    replace: '        return { ...l, _type: t,',
    test: T,
    why: '거친 등록부 코드(`M10307`=노무사)가 그대로 박혀 법조계·행정사가 잘못된 칸으로 들어온다.',
  },
  {
    name: '업종정본 — 재분류가 등록부 업종을 안 쓰게 되돌린다',
    file: D,
    find: 'UPDATE ad_company_leads SET category = ?, subcategory = ?, tier = COALESCE(tier, ?), lead_type = ?, classify_confidence = \'registry\', classified_v = ? WHERE id = ?',
    replace: 'UPDATE ad_company_leads SET lead_type = ?, classify_confidence = \'registry\', classified_v = ? WHERE id = ?',
    test: V,
    why: '라이브 41만 행의 라벨 교정이 닿는 유일한 자리다 — 빠지면 소급 수정이 조용히 안 일어난다.',
  },
  {
    name: '업종정본 — 등록부 비교에서 업종을 뺀다(교정이 조용히 멎는다)',
    file: 'src/features/marketing/api/reclassify-verdict-delta.ts',
    find: "  if (branch === 'registry') {",
    replace: "  if (false) {",
    test: V,
    why: '`changed=false` 가 되어 UPDATE 가 아예 실행되지 않는다 — 도장만 찍히고 라벨은 그대로 남는다.',
  },
  {
    name: '업종정본 — 규칙 버전을 안 올린 상태로 되돌린다',
    file: C,
    find: 'export const CLASSIFY_RULES_VERSION = 10',
    replace: 'export const CLASSIFY_RULES_VERSION = 9',
    test: T,
    why: '재검사 쿼리가 `classified_v < VERSION` 이고 시간 폴백이 없다 — 안 올리면 기존 41만 행이 옛 판정에 영구 갇힌다.',
  },
  {
    name: '업종정본 — 상가정보 라벨을 옛 값으로 되돌린다(드리프트 재발)',
    file: I,
    find: "{ code: 'M10307', category: '전문서비스', subcategory: '노무사', tier: 5 },",
    replace: "{ code: 'M10307', category: '전문서비스', subcategory: '노무', tier: 5 },",
    test: T,
    why: '같은 코드가 두 라벨을 만들던 드리프트(`세무사` 7,517 ↔ `세무·기장` 5,447)가 재발한다.',
  },
]
