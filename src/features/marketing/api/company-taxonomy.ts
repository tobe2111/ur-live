/**
 * 🧭 **업종 분류 정본(SSOT)** — 파트너풀 업체 업종 체계 (2026-10-24 대표 지시).
 *
 * > 대표: *"법조계, 뭐 그런 업종 구별이 더 체계적으로 잘 되어야 함. 지금은 정확도가 많이 낮음."*
 *
 * ## 무엇이 틀려 있었나 (라이브 실측 2026-10-24)
 * 법조계 상호(`법무법인`·`변호사`·`법률사무소`·`법무사`) **433건**의 분류:
 * ```
 *   전문서비스/법률   55 (12.7%)  ← 정답
 *   전문서비스/노무  215 (49.7%)  ← 최대 오분류
 *   온라인판매/통신판매 115
 *   세무사 15 · 회계 9 · 세무·기장 6 · 대행사(마케팅 등) 17 · 공동구매 1
 * ```
 * **87%가 틀렸다.** 그리고 `전문서비스` 라벨 자체가 중복이었다 — `세무사`(7,517)와
 * `세무·기장`(5,447)이 **같은 업종 두 칸**이고, 둘 다 `storeinfo` 의 같은 업종코드(`M10402`)에서 왔다
 * (라벨을 바꾼 시점 전후로 갈린 **라벨 드리프트**).
 *
 * ## 원인 — 거친 코드가 권위값이었다
 * `storeinfo`(상가업소정보)는 업종 소분류코드로 순회하고, 코드마다 **우리가 손으로 붙인 라벨 하나**를
 * category/subcategory 에 박는다. 그 코드가 우리보다 거칠다 — `M10307`('노무') 안에
 * `솔숲노동법률사무소`·`노동법률사무소선의`(법조계) · `마음온심리상담센터`(심리상담) 가 섞여 있고,
 * `M10402`('세무사') 안에 `출입국대표행정사도담행정사사무소`(행정사)가 있다.
 * 그런데 `company-save` 의 등록부 분기가 **상호에서 얻은 근거를 통째로 버린다**
 * (`if (registry) return { ...l, _type, _conf }` — `classifyLead` 의 category/subcategory 를 안 쓴다).
 *
 * ## 정본 3원칙
 * 1. **전문직은 국가자격 단위로 나눈다.** 전문직 상호에는 자격명 표기가 법으로 사실상 강제돼 있어
 *    (변호사법·세무사법 등 명칭 사용 제한) **상호의 자격명은 추측이 아니라 등록부급 사실**이다.
 *    그래서 거친 업종코드보다 **더 구체적인 근거**로 취급한다(권위 역전이 아니라 정밀화).
 * 2. **같은 업종에 라벨이 둘이면 통합한다**(띄어쓰기·어미 변형). 라벨이 갈리면 필터·통계·발송
 *    세그먼트가 조용히 반으로 쪼개진다.
 * 3. **업종이 아닌 값은 업종 칸에 넣지 않는다.**
 *
 * ⚠️ **이 파일이 못 하는 것**: 상호에 자격명이 없으면 아무 말도 하지 않는다(`null`) — 그 행은
 * 등록부 라벨을 그대로 유지한다. 예: `마음온심리상담센터` 는 여전히 `노무` 로 남는다(심리상담은
 * 우리 업종 체계에 없다). 정확도를 **더 낮추지 않으면서** 확실한 것만 고치는 설계다.
 * ⚠️ `온라인판매`(통신판매업 신고)는 **덮지 않는다** — "온라인으로 무엇을 판다"는 별개 축의 신고
 * 사실이고, 덮으면 그 축의 통계가 망가진다(법조계 115건은 그래서 그대로 남는다).
 */

/** 전문직 = 국가자격 단위. 이 값들이 `전문서비스` 의 정본 서브카테고리다. */
export const PROFESSION_SUBCATEGORIES = [
  '변호사', '법무사', '행정사', '노무사', '세무사', '회계사',
  '변리사', '감정평가사', '건축사', '관세사', '손해사정사',
] as const
export type ProfessionSubcategory = typeof PROFESSION_SUBCATEGORIES[number]

/**
 * 상호 → 자격 판정 규칙. **위에서부터 먼저 맞는 것을 채택하므로 순서가 규칙이다.**
 *
 * 🩸 순서를 틀리면 조용히 어긋난다(실측 상호로 확인한 함정들):
 * - `윤순혁세무회계사무소` 는 `회계사` 를 **부분문자열로 품는다** → 세무사 규칙이 먼저여야 한다.
 * - `노동법률사무소`(공인노무사가 여는 사무소)는 `법률사무소` 를 품는다 → 노무사 규칙이 먼저.
 * - `법무법인` 은 `법무사` 를 품지 **않는다**(법무법**인**) — 둘은 안전하게 구분된다.
 * - `건축사` 는 `건축사업부` 같은 일반어에 걸리므로 **`건축사사무소` 로만** 좁힌다.
 */
const PROFESSION_RULES: ReadonlyArray<readonly [ProfessionSubcategory, RegExp]> = [
  ['노무사', /노무사|노무법인|인사노무|노동법률/],
  ['세무사', /세무사|세무법인|세무회계|기장대리/],
  ['회계사', /공인회계사|회계법인|회계사무소/],
  ['변리사', /변리사|특허법인|특허사무소/],
  ['법무사', /법무사/],
  ['행정사', /행정사/],
  ['변호사', /변호사|법무법인|법률사무소|법률사무|로펌/],
  ['감정평가사', /감정평가/],
  ['관세사', /관세사|관세법인/],
  ['손해사정사', /손해사정/],
  ['건축사', /건축사사무소/],
]

/** 전문직 라벨은 전부 이 카테고리·티어를 쓴다(기존 `전문서비스` tier 5 와 동일 — 접촉 우선순위 불변). */
export const PROFESSION_CATEGORY = '전문서비스'
export const PROFESSION_TIER = 5

/**
 * 🏛 **등록부 라벨을 덮지 않는 카테고리** — 통신판매업 신고는 "온라인으로 판다"는 별개 축의 사실이다.
 *   여기 든 카테고리는 상호에 자격명이 있어도 유지한다(그 축의 통계를 지키기 위해).
 */
export const PROFESSION_REFINE_BLOCKED = new Set(['온라인판매'])

/** 상호에서 국가자격 업종을 뽑는다. 단서가 없으면 `null`(= 아무 말도 하지 않는다). */
export function classifyProfession(name: string | null | undefined): ProfessionSubcategory | null {
  const s = String(name || '').replace(/\s+/g, '')
  if (s.length < 2) return null
  for (const [sub, re] of PROFESSION_RULES) if (re.test(s)) return sub
  return null
}

/**
 * 🔁 **중복 라벨 통합표** — 같은 업종에 라벨이 둘 이상이던 것(라이브 실측 건수).
 *   라벨이 갈리면 어드민 필터·세그먼트·통계가 조용히 반으로 쪼개진다.
 */
export const CANON_SUBCATEGORY: Readonly<Record<string, string>> = {
  // 전문서비스 — 자격 단위로(원칙 1)
  '법률': '변호사',          // 66
  '노무': '노무사',          // 1,544
  '세무·기장': '세무사',     // 5,447 (같은 코드 M10402 가 '세무사' 7,517 과 갈려 있었다)
  '회계': '회계사',          // 1,532
  // 대행사 — 띄어쓰기 변형
  '마케팅 대행사': '마케팅대행', // 1,587 ↔ '마케팅대행' 7,759
  // 창업 — 띄어쓰기 변형
  '창업 컨설팅': '창업컨설팅',   // 2,507 ↔ '창업컨설팅' 550
  // 식자재·납품 — 11개 라벨에 141건이 흩어져 있었다
  '주류 도매': '주류도매',
  '주류도매상': '주류도매',
  '식자재 유통': '식자재유통',
  '업소용 식자재': '식자재유통',
  '식자재 마트': '식자재유통',
  '커피 원두 납품': '원두납품',
}

/**
 * 서브카테고리를 정본으로 바꾼다(모르는 값은 그대로 — 키워드에서 온 값을 버리지 않는다).
 * ⚠️ 저장 경로의 **한 자리**에서만 부르면 소스가 몇 개든 라벨이 갈리지 않는다.
 */
export function canonSubcategory(subcategory: string | null | undefined): string | null {
  const s = String(subcategory ?? '').trim()
  if (!s) return subcategory == null ? null : (subcategory as string)
  return CANON_SUBCATEGORY[s] ?? s
}

export interface RefineInput {
  company_name?: string | null
  category?: string | null
  subcategory?: string | null
  tier?: number | null
}
export interface RefineResult { category: string | null; subcategory: string | null; tier: number | null }

/**
 * 등록부 라벨 + 상호 자격명 → 정본 업종.
 *
 * - 상호에 자격명이 있고 그 카테고리가 차단 목록(`온라인판매`)이 아니면 **전문직 라벨이 이긴다**(원칙 1).
 * - 그 밖에는 등록부 라벨을 유지하고 **중복 라벨만 통합**한다(원칙 2).
 */
export function refineRegistryLabel(input: RefineInput): RefineResult {
  const category = input.category ?? null
  const prof = PROFESSION_REFINE_BLOCKED.has(String(category || '')) ? null : classifyProfession(input.company_name)
  if (prof) return { category: PROFESSION_CATEGORY, subcategory: prof, tier: input.tier ?? PROFESSION_TIER }
  return { category, subcategory: canonSubcategory(input.subcategory), tier: input.tier ?? null }
}
