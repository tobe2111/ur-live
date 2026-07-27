/**
 * 🧭 파트너 리드 판별·분류 SSOT (2026-07-27 — 대표 신고 "은평구 …수행기관 모집" 이 대행사로 수집됨).
 *
 *   **문제 2가지를 한 곳에서 해결한다.**
 *   ① 업체가 아닌 것(공고·모집글·정부 페이지)이 리드로 들어옴
 *      → 네이버 웹문서(webkr) 검색 결과의 *페이지 제목*을 상호로 삼는데, 구청 공고 페이지가 걸리면
 *        "은평구, 2026년 … 수행기관 모집" 이 그대로 업체명이 됨. 도메인(go.kr)·제목 어휘로 **저장 전 차단**.
 *   ② 분류가 "검색 키워드"로 정해져 실제 업종과 무관
 *      → '소상공인 마케팅' 으로 찾았으면 무엇이 걸리든 category=대행사. 세무사도 구청도 대행사가 됨.
 *        → **리드 자신의 텍스트(상호·설명·네이버 업종)를 근거로 재분류**하고, 근거가 없을 때만 키워드로 폴백 +
 *          `classify_confidence` 로 근거 유무를 남겨 어드민이 "분류 확인 필요"를 걸러볼 수 있게 한다.
 *
 *   분류 축(대표 질문 "어떻게 분류하는게 좋을까" 에 대한 설계 답):
 *     · lead_type  — **접촉 가치 축**. partner(매장을 데려올 파트너) / store(매장 자체=입점 대상) /
 *                    org(기관·협회·비영리 — 제휴는 되나 영업 대상 아님) / unknown(근거 부족)
 *     · category/subcategory — 업종 축(기존 COMPANY_CATEGORIES)
 *     · tier — 대표가 조정하는 우선순위 축(기존)
 *   세 축이 섞여 있던 것을 분리 → "대행사인데 사실 구청" 같은 오분류가 구조적으로 불가능해진다.
 *
 *   ⚠️ 허위 0 원칙: 여기서 하는 일은 *분류/차단*뿐. 연락처를 만들어내지 않는다.
 */

/** 업체가 아닌 도메인 — 정부/공공/학교/군. 이 호스트의 페이지는 업체 리드가 될 수 없다.
 *  (협회·조합 `or.kr` 은 '지역조직' 파트너로 실제 가치가 있어 차단하지 않고 lead_type=org 로 분류만.) */
export const NON_BUSINESS_HOST = /(?:^|\.)(?:go\.kr|gov\.kr|ac\.kr|ed\.kr|es\.kr|ms\.kr|hs\.kr|mil\.kr|re\.kr|korea\.kr|gov)$/i

/** 공고·모집글·기사 제목에만 나타나는 어휘 — 상호에는 사실상 등장하지 않는다.
 *  (예: "…수행기관 모집", "2026년 … 지원사업 공고", "보도자료", "채용공고") */
const NOTICE_WORD = /(모집|공고|공지사항|접수\s*안내|신청\s*안내|지원사업|보조사업|위탁사업|수행기관|선정\s*결과|결과\s*발표|보도자료|채용|구인|입찰|낙찰|공모전|공모\s*안내|설명회|간담회|기자회견|알림마당|열린마당|새소식)/
/** 문장형 제목(업체명이 아님) — 종결어미/안내문투. */
const SENTENCE_WORD = /(합니다|습니다|하세요|드립니다|바랍니다|입니다\b)/
/** 기관·비영리 접미 — 차단하진 않고 lead_type=org 로 분류(지역조직 파트너 가치 있음). */
const ORG_WORD = /(구청|시청|도청|군청|읍사무소|면사무소|주민센터|행정복지센터|공단|공사|진흥원|진흥공단|재단|협회|연합회|조합|상인회|위원회|의회|교육청|보건소|센터장|정부|부처|청사)/

export type LeadType = 'partner' | 'store' | 'org' | 'unknown'
/** registry = 정부 등록부의 공식 업종(최고 신뢰) · evidence = 리드 텍스트 근거 · keyword = 검색어 추정 · none */
export type ClassifyConfidence = 'registry' | 'evidence' | 'keyword' | 'none'

/** 카테고리 권위 소스 — 이 소스들의 category 는 **정부 등록부의 공식 업종**(상가정보 업종코드·통신판매
 *  신고업태·공정위 가맹·나라장터 업종)이라 텍스트 정규식(BIZ_RULES)이 덮어쓰면 안 된다(권위 역전 금지).
 *  판별(공고/정부페이지 차단)과 lead_type 부여는 이 소스들에도 그대로 적용. */
export const REGISTRY_CATEGORY_SOURCES = new Set(['storeinfo', 'commerce', 'franchise', 'nara', 'registry'])

export interface ClassifyInput {
  company_name?: string | null
  description?: string | null
  website?: string | null
  /** 검색 키워드로 추정했던 값(폴백) */
  category?: string | null
  subcategory?: string | null
  tier?: number | null
  source?: string | null
  /** 수집 검색어 — "키워드 메아리"(이름이 검색어 그대로인 가짜 상호) 판별용(2026-07-27 대표 신고 '상권분석' 행) */
  source_keyword?: string | null
}
export interface ClassifyResult {
  /** false 면 리드가 아님 — 저장하지 않는다. */
  ok: boolean
  reason?: string
  category: string | null
  subcategory: string | null
  tier: number | null
  lead_type: LeadType
  confidence: ClassifyConfidence
}

/** 업종 근거 규칙 — 리드 자신의 텍스트(상호+설명+네이버 업종)에서 매칭. 위에서부터 먼저 맞는 것 채택.
 *  category/subcategory 는 COMPANY_CATEGORIES(company-discovery) 어휘와 정합. */
const BIZ_RULES: Array<{ re: RegExp; category: string; subcategory: string; tier: number; type: LeadType }> = [
  // 대행사(최우선 — 매장을 통째로 데려올 수 있는 접점)
  { re: /(광고\s*대행|마케팅\s*대행|퍼포먼스\s*마케팅|바이럴|검색광고|SNS\s*마케팅|온라인\s*마케팅|디지털\s*마케팅|미디어\s*렙|애드\b|ADS?\b)/i, category: '대행사', subcategory: '마케팅대행', tier: 1, type: 'partner' },
  { re: /(병원\s*마케팅|의료\s*마케팅|뷰티\s*마케팅|성형\s*마케팅)/, category: '대행사', subcategory: '병원·뷰티마케팅', tier: 1, type: 'partner' },
  { re: /(체험단|플레이스\s*마케팅|블로그\s*마케팅|리뷰\s*마케팅)/, category: '대행사', subcategory: '체험단·플레이스', tier: 1, type: 'partner' },
  // 창업
  { re: /(창업\s*컨설팅|창업\s*지원|점포\s*개발|프랜차이즈\s*컨설팅)/, category: '창업', subcategory: '창업컨설팅', tier: 1, type: 'partner' },
  { re: /(상권\s*분석|입지\s*분석)/, category: '창업', subcategory: '상권분석', tier: 1, type: 'partner' },
  // 식자재·납품(매장에 매주 들어가는 접점)
  { re: /(주류\s*도매|주류도매|주류\s*유통)/, category: '식자재·납품', subcategory: '주류도매', tier: 2, type: 'partner' },
  { re: /(식자재|식재료\s*유통|업소용|농수산물\s*유통)/, category: '식자재·납품', subcategory: '식자재유통', tier: 2, type: 'partner' },
  { re: /(원두|커피\s*납품|로스터리\s*납품)/, category: '식자재·납품', subcategory: '원두납품', tier: 2, type: 'partner' },
  { re: /(배달\s*대행|배달대행)/, category: '식자재·납품', subcategory: '배달대행', tier: 2, type: 'partner' },
  // POS·단말기
  { re: /(포스\b|POS\b|카드\s*단말기|카드단말기|VAN\s*대리점|밴\s*대리점)/i, category: 'POS·단말기', subcategory: 'POS·카드단말기', tier: 4, type: 'partner' },
  { re: /(키오스크)/, category: 'POS·단말기', subcategory: '키오스크', tier: 4, type: 'partner' },
  { re: /(테이블\s*오더|테이블오더)/, category: 'POS·단말기', subcategory: '테이블오더', tier: 4, type: 'partner' },
  { re: /(CCTV|씨씨티비|보안\s*시스템)/i, category: 'POS·단말기', subcategory: 'CCTV·보안', tier: 4, type: 'partner' },
  // 간판 / 인테리어(대표 v3 — 독립 카테고리)
  { re: /(간판|사인\s*제작|현수막|실사출력)/, category: '간판', subcategory: '간판·광고물 제작', tier: 3, type: 'partner' },
  { re: /(인테리어|리모델링|시공)/, category: '인테리어', subcategory: '인테리어·시공', tier: 3, type: 'partner' },
  { re: /(주방\s*설비|주방설비|주방\s*기구|업소용\s*주방)/, category: '인테리어', subcategory: '주방설비', tier: 3, type: 'partner' },
  // 전문 서비스(법률·세무·기장 등)
  { re: /(법무법인|변호사|법률\s*사무소)/, category: '전문서비스', subcategory: '법률', tier: 5, type: 'partner' },
  { re: /(세무사|세무\s*회계|기장)/, category: '전문서비스', subcategory: '세무·기장', tier: 5, type: 'partner' },
  { re: /(회계법인|공인회계사)/, category: '전문서비스', subcategory: '회계', tier: 5, type: 'partner' },
  { re: /(노무사|노무\s*법인)/, category: '전문서비스', subcategory: '노무', tier: 5, type: 'partner' },
  { re: /(정책\s*자금|정책자금)/, category: '전문서비스', subcategory: '정책자금컨설팅', tier: 5, type: 'partner' },
  // 부동산(독립 카테고리)
  { re: /(상가\s*전문|상가\s*임대|점포\s*부동산|공인중개사|부동산\s*중개)/, category: '부동산', subcategory: '상가부동산', tier: 3, type: 'partner' },
  // 지역조직(기관성 — 제휴 가치는 있으나 영업 대상 아님)
  { re: /(상인회|번영회|소상공인연합|협동조합|상권활성화|청년몰|새마을금고|신협)/, category: '지역조직', subcategory: '상인회', tier: 3, type: 'org' },
  // 미디어
  { re: /(지역\s*신문|매거진|타운\s*뉴스|아파트\s*게시판)/, category: '미디어', subcategory: '지역신문·매거진', tier: 3, type: 'partner' },
  // 매장 자체(파트너가 아니라 입점 대상) — 오분류 방지용 라벨
  { re: /(음식점|맛집|식당|카페\b|커피숍|베이커리|미용실|헤어샵|네일|피부관리|필라테스|헬스장|노래연습장|펜션|모텔|호텔)\s*$/i, category: '', subcategory: '', tier: 5, type: 'store' },
]

const squash = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** 리드 판별 + 분류. 저장 전에 반드시 통과시킨다(company-discovery.saveCompanyLeads 가 호출). */
export function classifyLead(input: ClassifyInput): ClassifyResult {
  const name = squash(input.company_name)
  const desc = squash(input.description)
  const reject = (reason: string): ClassifyResult =>
    ({ ok: false, reason, category: null, subcategory: null, tier: null, lead_type: 'unknown', confidence: 'none' })

  if (name.length < 2) return reject('NAME_TOO_SHORT')

  // ① 정부·학교 도메인에서 온 페이지는 업체가 아님(webkr 발굴의 주된 오염원).
  const site = squash(input.website)
  if (site) {
    try {
      const host = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname
      if (NON_BUSINESS_HOST.test(host)) return reject('NON_BUSINESS_HOST')
    } catch { /* 파싱 실패는 통과 — 뒤 어휘 검사로 걸러짐 */ }
  }

  // ② 공고/모집/기사 제목 → 업체명이 아님. ("…수행기관 모집" 사례)
  if (NOTICE_WORD.test(name)) return reject('NOTICE_TITLE')
  if (SENTENCE_WORD.test(name)) return reject('SENTENCE_TITLE')
  // ②-b 뉴스 헤드라인 문형(2026-07-27 대표 신고 — "'이대 상권 살리기'에 진심인 서대문구…" 기사제목 수집).
  //   상호에는 없는 신호들: 인용부호("" '' ") · 「쉼표+공백」 제목체 · 어절 5개+ 장문 · 서술 종결(…다/높여).
  if (/["“”‘’']/.test(name)) return reject('HEADLINE_TITLE')
  if (/,\s/.test(name) && name.length >= 12) return reject('HEADLINE_TITLE')
  if (name.length >= 18 && name.split(/\s+/).length >= 5) return reject('HEADLINE_TITLE')
  if (/(?:된다|한다|않는다|안된다|났다|높여|커져|줄어|늘어)$/.test(name)) return reject('HEADLINE_TITLE')
  // ②-c 블로그 SEO 의문문 제목(2차 신고 — "…마케팅위드는 무엇이 다를까요?") + 키워드 메아리("상권분석").
  if (/[?？]|(?:무엇이|어떻게|왜)\s|까요\b|나요\b|인가요/.test(name)) return reject('HEADLINE_TITLE')
  if (input.source_keyword) {
    const kwTok = new Set(String(input.source_keyword).toLowerCase().split(/\s+/).map(t => t.replace(/\s+/g, '')).filter(Boolean))
    const nameTok = name.toLowerCase().split(/\s+/).filter(Boolean)
    // 이름의 모든 어절이 검색어 어절 안에 있으면 = 검색어를 그대로 이름으로 오인한 것(실상호는 검색어에 없는 토큰을 가짐)
    if (nameTok.length > 0 && nameTok.every(t => kwTok.has(t))) return reject('KEYWORD_ECHO')
  }
  // 문장형: 아주 긴 제목 + 쉼표/연도 — 상호는 이런 모양이 아니다.
  if (name.length > 34 && /[,·]/.test(name) && /\d{4}년|\d{4}\s*년도/.test(name)) return reject('SENTENCE_TITLE')
  if (!/[가-힣A-Za-z0-9]/.test(name)) return reject('NAME_NOT_TEXT')

  // ③ 업종 분류 — 리드 자신의 텍스트가 1순위 근거, 키워드는 폴백.
  const hay = `${name} ${desc}`
  for (const r of BIZ_RULES) {
    if (!r.re.test(hay)) continue
    if (r.type === 'store') {
      // 매장 자체 — 업종 라벨은 키워드 폴백을 유지하되 접촉 가치 축만 store 로.
      return { ok: true, category: input.category ?? null, subcategory: input.subcategory ?? null, tier: input.tier ?? r.tier, lead_type: 'store', confidence: 'evidence' }
    }
    return { ok: true, category: r.category, subcategory: r.subcategory, tier: input.tier ?? r.tier, lead_type: r.type, confidence: 'evidence' }
  }
  // 기관 어휘(구청·공단·협회…)가 상호에 있으면 기관으로 — 영업 파이프라인에서 분리.
  if (ORG_WORD.test(name)) {
    return { ok: true, category: input.category ?? '지역조직', subcategory: input.subcategory ?? null, tier: input.tier ?? 3, lead_type: 'org', confidence: 'evidence' }
  }

  // ④ 근거 없음 — 검색 키워드 기반 값을 그대로 두되 confidence 로 표시(어드민이 확인 가능).
  const hasKeyword = !!(input.category || input.subcategory)
  return {
    ok: true,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    tier: input.tier ?? null,
    lead_type: 'unknown',
    confidence: hasKeyword ? 'keyword' : 'none',
  }
}

/** 이름이 상호로 의심스러운가(헤드라인/키워드 메아리) — 크롤 시 사이트 자기이름(og:site_name)으로 치유할지 판정.
 *  classifyLead 와 동일 신호 재사용: ok=false(전면 거부)까진 아니어도 이름만 수상한 webkr 행의 리라벨 트리거. */
export function suspectCompanyName(name: string, sourceKeyword?: string | null): boolean {
  const n = String(name || '').replace(/\s+/g, ' ').trim()
  if (n.length < 2) return true
  if (/["“”‘’',?？]/.test(n)) return true
  if (n.length >= 18 && n.split(/\s+/).length >= 5) return true
  if (/(?:된다|한다|않는다|안된다|났다|높여|커져|줄어|늘어)$/.test(n)) return true
  if (/[?？]|(?:무엇이|어떻게|왜)\s|까요\b|나요\b|인가요/.test(n)) return true
  if (sourceKeyword) {
    const kwTok = new Set(String(sourceKeyword).toLowerCase().split(/\s+/).filter(Boolean))
    const nameTok = n.toLowerCase().split(/\s+/).filter(Boolean)
    if (nameTok.length > 0 && nameTok.every(t => kwTok.has(t))) return true
  }
  return false
}

/** 접촉 가치 축 라벨(어드민 표시 SSOT). */
export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  partner: '파트너 후보',
  store: '매장(입점 대상)',
  org: '기관·단체',
  unknown: '분류 확인 필요',
}
export const LEAD_TYPES: LeadType[] = ['partner', 'store', 'org', 'unknown']
