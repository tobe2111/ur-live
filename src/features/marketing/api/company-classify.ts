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
/**
 * 🏛 비영리 전용 도메인 — **차단이 아니라 org 라벨**(위 주석이 약속한 동작인데 코드가 없었다).
 *
 *   `or.kr` 은 등록 요건상 비영리기관·단체만 받는다 → 이름을 안 봐도 확정이다. 이게 필요한 이유는
 *   **이름이 늘 믿을 수 있는 게 아니기 때문**이다: 라이브 실측에서 상공회의소가 `「2025년 제1회 부산진구`
 *   라는 잘린 제목으로 들어와 `대행사 tier1`(콜드 접촉 풀) 최상단에 앉아 있었다. 이름 어휘 검사
 *   (ORG_WORD)는 이름이 남아 있을 때만 통한다 — 호스트는 잘리지 않는다.
 */
export const NONPROFIT_HOST = /(?:^|\.)or\.kr$/i
/**
 * ✂️ **잘린 제목 판별** — 여는 괄호가 안 닫혔거나 그 반대.
 *
 *   ⚠️ **`webkr` 에만 쓴다.** 라이브 실측에서 이 패턴을 전 소스에 걸면 `주)다산케인엔케이통상`
 *   같은 **정부 등록부의 실제 업체 56건**을 지운다(등록부가 앞 `(` 를 흘린 표기라 우리 잘못이 아니다).
 *   webkr 은 우리가 제목을 구분자로 직접 자르므로 파편이 우리 책임이고, 그때만 이 신호가 유효하다.
 */
const BRACKETS: Array<[string, string]> = [['[', ']'], ['(', ')'], ['「', '」'], ['【', '】'], ['《', '》'], ['〈', '〉']]
export const unbalancedBracket = (s: string): boolean =>
  BRACKETS.some(([o, c]) => (s.split(o).length - 1) !== (s.split(c).length - 1))
/**
 * 🏷️ **업종어만으로 이루어진 이름은 상호가 아니라 설명이다** (2026-08-10 대표 신고 "파트너들 이름이 왜이래").
 *
 *   라이브 실측으로 나온 이름: `마케팅 대행`. 이건 검색어가 그대로 상호가 된 것인데,
 *   하필 **BIZ_RULES 의 `마케팅\s*대행` 에 이름으로 맞아** `대행사 · tier1 · evidence` 가 됐다.
 *   `evidence` 는 이름 치유의 제외 조건이라 **그 이름이 영구히 굳는다** — 가장 나쁜 조합이다.
 *
 *   ## 무엇으로 가르나
 *   진짜 상호에는 업종어 말고 **자기만의 토큰**이 있다(`남부`종합광고기획 · `애드업`).
 *   업종어와 법인격 표기를 걷어내고 **남는 게 없으면** 그건 이름이 아니라 업종 설명이다.
 *   ⇒ 그런 이름은 근거로 인정하지 않고 `keyword`(=모른다)로 떨어뜨려 **치유 대상**이 되게 한다.
 *     사이트가 스스로 선언한 이름(og:site_name)을 받아오면 그때 제대로 분류된다.
 *
 *   ⚠️ **버리지 않는다.** 실제로 `마케팅대행`이 상호인 업체가 있을 수 있고, 그 경우 치유가
 *     사이트 이름을 확인해 같은 값이면 그대로 둔다. 판단이 안 서면 사람에게 보인다(분류 확인 카드).
 */
const GENERIC_NAME_TOKENS = /(마케팅|대행|광고|홍보|기획|컨설팅|디자인|미디어|콘텐츠|브랜딩|프로모션|이벤트|행사|바이럴|퍼포먼스|온라인|디지털|종합|전문|서비스|센터|스튜디오|에이전시|플랫폼|솔루션|시스템|그룹|코리아|소상공인|상권|창업|지원|사업|업체|회사|주식회사|유한회사|영업|판매|유통|납품|제작|시공|설치)/g
const CORP_MARKER = /[（(]?\s*(?:주|유|재|사|합|㈜|㈐)\s*[)）]?|주식회사|유한회사|합자회사|사단법인|재단법인/g
export const isGenericPhrase = (name: string): boolean => {
  const rest = String(name || '')
    .replace(CORP_MARKER, '')
    .replace(GENERIC_NAME_TOKENS, '')
    .replace(/[\s·,.\-–—_/&()[\]]/g, '')
  return rest.length < 2 // 자기만의 토큰이 사실상 남지 않았다
}

/** 설명(description)이 **페이지 본문**이라 업종 근거로 못 쓰는 소스 — 근거는 `classifyLead` ③ 주석. */
const DESC_IS_PAGE_BODY = new Set(['webkr'])

/** 공고·모집글·기사 제목에만 나타나는 어휘 — 상호에는 사실상 등장하지 않는다.
 *  (예: "…수행기관 모집", "2026년 … 지원사업 공고", "보도자료", "채용공고") */
const NOTICE_WORD = /(모집|공고|공지사항|접수\s*안내|신청\s*안내|지원사업|보조사업|위탁사업|수행기관|선정\s*결과|결과\s*발표|보도자료|채용|구인|입찰|낙찰|공모전|공모\s*안내|설명회|간담회|기자회견|알림마당|열린마당|새소식|특강|세미나|워크숍|워크샵|교육\s*과정|아카데미\s*모집|위치\s*안내|이용\s*안내|오시는\s*길|지정\s*게시대)/
/** 문장형 제목(업체명이 아님) — 종결어미/안내문투. */
const SENTENCE_WORD = /(합니다|습니다|하세요|드립니다|바랍니다|입니다\b)/
/** 기관·비영리 접미 — 차단하진 않고 lead_type=org 로 분류(지역조직 파트너 가치 있음). */
const ORG_WORD = /(구청|시청|도청|군청|읍사무소|면사무소|주민센터|행정복지센터|공단|공사|진흥원|진흥공단|재단|협회|연합회|조합|상인회|위원회|의회|교육청|보건소|센터장|정부|부처|청사)/
/**
 * 🏛 **명백한** 기관 어휘 — 업종 규칙보다 **먼저** 본다.
 *
 *   실사고(2026-07-28 실측): BIZ_RULES 를 먼저 돌려서, **행사를 하는 재단·협회가 '대행사 tier1'**
 *   (우리가 실제로 영업할 풀)로 들어갔다. 예: `동대문문화재단`(구청 축제 대행 공고) ·
 *   `서울옥외광고협회 중랑구지부`. 기관은 무엇을 하든 기관이다 — 하는 일로 신분이 바뀌지 않는다.
 *   ⚠️ 모호한 어휘(`공사`·`공단`·`조합`·`센터장`)는 **일부러 뺐다** — `○○전기공사` 같은 정상 업체를
 *   기관으로 오분류하기 때문. 그것들은 아래 기존 ORG_WORD 후처리가 계속 담당한다.
 */
const ORG_WORD_STRICT = /(구청|시청|도청|군청|읍사무소|면사무소|주민센터|행정복지센터|진흥원|재단|협회|연합회|교육청|보건소|의회|청사)/

export type LeadType = 'partner' | 'store' | 'org' | 'unknown'
/** registry = 정부 등록부의 공식 업종(최고 신뢰) · evidence = 리드 텍스트 근거 · keyword = 검색어 추정 · none */
export type ClassifyConfidence = 'registry' | 'evidence' | 'keyword' | 'none'

/** 🔢 분류 규칙 버전 (2026-07-27 대표 "이런 것들 어떻게 정리할거냐" — 소급 재검사 가능 구조).
 *  각 행은 `classified_v` 에 "어느 버전 규칙으로 검사받았나"를 기록하고, 소급 정리는
 *  `classified_v < CLASSIFY_RULES_VERSION` 행만 훑는다. **판별/분류 규칙(NOTICE/SENTENCE/헤드라인/
 *  BIZ_RULES/lead_type)을 바꾸면 반드시 이 값을 +1** — 그래야 옛 규칙으로 통과했던 전체 풀이
 *  자동으로 재검사 대상이 된다(안 올리면 이미 스탬프된 잘못된 행이 영구 방치 — 이 사고의 원인).
 *  v3 (2026-07-27): 안내-페이지 제목 어휘(위치안내/이용안내/오시는길/지정 게시대 — 대표 신고
 *  "지정 게시대 위치안내" 업체명) NOTICE_WORD 추가. */
export const CLASSIFY_RULES_VERSION = 8 // 2026-08-10: 업종어뿐인 이름은 근거 불인정(대표 '이름이 왜이래')
// v7 // 2026-08-08: or.kr=org · 잘린제목 거부 · 본문근거 불인정(대표 신고 진흥원)
//  ⚠️ **6 이 아니라 7 인 이유** — 같은 신고를 두 세션이 각각 잡아 **둘 다 6 을 선점**했고(#1099 가 먼저
//    머지돼 배포됨), 그쪽 규칙으로 이미 `classified_v=6` 이 찍히기 시작했다. 6 으로 합치면 이 파일의
//    새 규칙(or.kr·본문근거)은 그 행들을 **영영 다시 안 본다** — 재검사 조건이 `< VERSION` 이라서다.
//    상수를 '내 변경분'이 아니라 **'풀이 마지막으로 검사받은 시점'** 으로 읽어야 이 실수를 안 한다.
//  ⚠️ 이 bump 의 소급 대상은 **사실상 0** 이다(아직 source='market' 행이 없다). 그런데도 올린 이유:
//    이 상수의 실패 모드는 비대칭이다 — 불필요하게 올리면 **한 번 더 훑는 비용**이지만, 안 올리면
//    **영구히 옛 판정에 갇힌다**(재검사 쿼리에 시간 폴백이 없다). 애매하면 올리는 쪽이 맞다.
//  v4 (2026-07-29): 공동구매 규칙 추가 — 기존 171k 행도 소급 재분류돼야 새 카테고리에 잡힌다.

/** 카테고리 권위 소스 — 이 소스들의 category 는 **정부 등록부의 공식 업종**(상가정보 업종코드·통신판매
 *  신고업태·공정위 가맹·나라장터 업종)이라 텍스트 정규식(BIZ_RULES)이 덮어쓰면 안 된다(권위 역전 금지).
 *  판별(공고/정부페이지 차단)과 lead_type 부여는 이 소스들에도 그대로 적용. */
// 🏪 'market'(전통시장 표준데이터) — 시장 이름("사기막골도자기시장")은 아래 `상인회|번영회|…` 규칙에
//   **안 걸린다.** 원부가 이미 "전통시장"이라고 말해 주는데 이름만 보고 다시 추측하면 카테고리가 비거나
//   엉뚱해진다 → 이 소스의 category/subcategory 는 권위값으로 둔다.
export const REGISTRY_CATEGORY_SOURCES = new Set(['storeinfo', 'commerce', 'franchise', 'nara', 'registry', 'market'])

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
  // 아인종합기획형 — 지역 종합광고기획사(2026-07-27 대표 타겟 지정). '기획' 단독은 과광범위라 광고/종합 결합만.
  { re: /(종합\s*광고|종합\s*기획|광고\s*기획|광고\s*대행|홍보\s*기획|홍보\s*대행)/, category: '대행사', subcategory: '종합광고기획', tier: 1, type: 'partner' },
  { re: /(이벤트\s*(?:기획|대행)|행사\s*(?:기획|대행)|프로모션\s*대행)/, category: '대행사', subcategory: '행사·이벤트', tier: 1, type: 'partner' },
  { re: /(판촉물|홍보물\s*제작|전단지?\s*제작|옥외\s*광고|인쇄\s*기획|기념품\s*제작)/, category: '간판', subcategory: '간판·광고물 제작', tier: 2, type: 'partner' },
  // 🛒 공동구매(2026-07-29) — 대행사 규칙 **다음**에 둔다: '공동구매 마케팅 대행'은 대행사가 맞다.
  //   ⚠️ '공구' 단독은 **연장/공구상가**를 뜻하므로 절대 매칭하지 않는다(공구상가 오수집이 이 규칙의 주된 위험).
  { re: /(공동\s*구매|공구\s*(?:총판|벤더|대행|딜)|창고형\s*(?:매장|할인|마트|공동))/, category: '공동구매', subcategory: '공동구매 총판·벤더', tier: 1, type: 'partner' },
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
  let orgByHost = false
  if (site) {
    try {
      const host = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname
      if (NON_BUSINESS_HOST.test(host)) return reject('NON_BUSINESS_HOST')
      orgByHost = NONPROFIT_HOST.test(host) // 차단 X — 아래 ③ 에서 org 로 라벨만(제휴 가치는 있다)
    } catch { /* 파싱 실패는 통과 — 뒤 어휘 검사로 걸러짐 */ }
  }
  // ①-b 우리가 자른 제목의 파편은 상호가 아니다("[광주 - 동구] …" → "[광주"). webkr 한정 — 근거는 상수 주석.
  if (DESC_IS_PAGE_BODY.has(input.source || '') && unbalancedBracket(name)) return reject('TRUNCATED_TITLE')

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
    const kwSquash = String(input.source_keyword).toLowerCase().replace(/\s+/g, '')
    // 띄어쓰기 무시 완전 일치("상권 분석" 검색 → 이름 "상권분석") — 어절 비교가 못 잡는 변형.
    if (kwSquash && name.toLowerCase().replace(/\s+/g, '') === kwSquash) return reject('KEYWORD_ECHO')
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
  /**
   * 🩸 **설명 본문은 근거가 아니다** (2026-08-08 대표 신고 — 전남중소기업일자리경제진흥원이 '대행사 tier1').
   *
   *   webkr 의 `description` 은 **검색결과 페이지의 본문 조각**이다. 진흥원이 소상공인 지원 보도자료에
   *   "온라인 마케팅 활성화" 라고 쓰면 `hay` 가 대행사 규칙에 걸려 **기관이 콜드 접촉 풀 최상단**에 앉았다.
   *   게다가 그렇게 붙은 `evidence` 는 이름 치유(Phase 3, `classify_confidence='none'` 대상)에서 제외돼
   *   **잘린 이름까지 영구히 굳는다** — 조용히 틀린 채 남는 이 레포의 단골 실패 모양.
   *   ⇒ 이 소스는 **이름에서 맞은 규칙만** 근거로 인정하고, 본문에서만 맞으면 ④ 키워드 폴백으로 떨어뜨린다
   *     (버리지 않는다 — 카테고리는 남고 `unknown` 이라 '분류 확인 카드'로 사람 눈에 올라간다).
   *   ⚠️ `local`(지도)의 description 은 지도 API 의 업종 문자열이라 **진짜 근거다** — 여기 포함하지 말 것.
   */
  const bodyUntrusted = DESC_IS_PAGE_BODY.has(input.source || '')
  // 🏷️ 이름이 업종어뿐이면 그 이름을 근거로 쓰지 않는다 — 근거는 `isGenericPhrase` 주석.
  //   ⚠️ 페이지 제목을 상호로 삼는 소스에만 적용한다(등록부 상호는 원부가 준 값이라 건드리지 않는다).
  const nameIsGeneric = bodyUntrusted && isGenericPhrase(name)
  // 🏛 기관 선판정 — 업종 규칙보다 먼저. 재단·협회가 '행사 대행' 을 한다고 영업 대상(파트너)이 되지 않는다.
  if (orgByHost || ORG_WORD_STRICT.test(name)) {
    return { ok: true, category: input.category ?? '지역조직', subcategory: input.subcategory ?? null, tier: input.tier ?? 3, lead_type: 'org', confidence: 'evidence' }
  }
  for (const r of BIZ_RULES) {
    if (!r.re.test(hay)) continue
    if (bodyUntrusted && !r.re.test(name)) continue // 본문에서만 맞음 — 다음 규칙이 이름에서 맞을 기회를 준다
    if (nameIsGeneric) continue                     // 이름이 업종어뿐 — 그건 상호가 아니라 설명이다
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
  // 🔴 2026-08-08 (대표 신고 — 공공기관 담당자 혼입): 실제로 들어와 있던 건 회사명이 아니라 **파편**이었다.
  //   `[광주` — "[광주] …" 같은 공고 제목을 파싱하다 대괄호 앞부분만 남은 것(실측 id 401793,
  //   전라남도중소기업일자리경제진흥원 담당자). `(주케이디알앤케이` 도 같은 형태(id 305893).
  //   여는 괄호만 있고 닫는 괄호가 없으면 **상호가 아니라 잘린 문자열**이다 — 정체를 알 수 없다.
  //   ⚠️ 닫는 괄호가 있는 정상 상호(`(주)케이디알`·`○○(강남점)`)는 통과시킨다.
  //   🔀 판정은 `unbalancedBracket`(SSOT) 하나로 — 같은 신고를 두 세션이 각각 잡아 `includes` 쌍과
  //     개수-비교가 나란히 들어왔다. 후자가 상위집합이라(개수를 세고 「」【】《》〈〉 도 본다) 그쪽으로 합쳤다.
  //     둘을 남겨 두면 다음에 한쪽만 고쳐 놓고 고쳤다고 믿게 된다.
  if (unbalancedBracket(n)) return true
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(n)) return true // 도메인 그대로인 placeholder(미디어 레인 등) — 실명 치유 대상
  if (/["“”‘’',?？]/.test(n)) return true
  /**
   * 🔴 **breadcrumb 구분자 = 상호가 아니라 페이지 제목** (2026-08-13 대표 *"이 불일치 문제는 심각해"*).
   *
   *   실측(전부 `classify_confidence='evidence'` 라 기존 치유 경로에서 제외돼 있었다):
   *   ```
   *     현장교육 &gt; 현장교육조회               edu.sbiz.or.kr
   *     기관소개&gt;유관기관현황&gt;광고회사현황   ← breadcrumb 통째로
   *     성장대로｜인천소상공인종합지원포털        icsp.or.kr   (`｜` 는 title 태그 구분자)
   *   ```
   *   업종어(`교육`·`상권`)가 이름에 있어 분류기는 **근거 있음(evidence)** 으로 봤지만 회사 이름이 아니다.
   *
   *   🩸 **초안은 `&[a-z]{2,6};` 로 엔티티 전체를 잡았다가 라이브에서 오탐을 확인하고 좁혔다.**
   *     `&amp;` 는 그냥 `&` 이고 **앰퍼샌드는 진짜 상호에 흔하다** — 실측으로 걸린 것들:
   *     `SM C&C 성수`(대형 광고대행사) · `S&K세무회계컨설팅` · `H&L 컴퍼니` · `한결 A&C` · `B & J 창업컨설팅`.
   *     52건 중 14건이 그런 정상 상호였다. **넓은 규칙이 정확한 규칙보다 나쁘다** — 여기서 오탐이 나면
   *     멀쩡한 업체가 이름을 덮어쓰인다.
   *   ⚠️ 하이픈·점·괄호·앰퍼샌드는 **절대 넣지 말 것**(`SK-매직`·`(주)A.B`·`SM C&C`).
   */
  if (/&(?:gt|lt|quot);|[|｜＞>《》＜<]/.test(n)) return true
  if (n.length >= 18 && n.split(/\s+/).length >= 5) return true
  if (/(?:된다|한다|않는다|안된다|났다|높여|커져|줄어|늘어)$/.test(n)) return true
  if (/[?？]|(?:무엇이|어떻게|왜)\s|까요\b|나요\b|인가요/.test(n)) return true
  if (sourceKeyword) {
    const kwSquash = String(sourceKeyword).toLowerCase().replace(/\s+/g, '')
    if (kwSquash && n.toLowerCase().replace(/\s+/g, '') === kwSquash) return true
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
