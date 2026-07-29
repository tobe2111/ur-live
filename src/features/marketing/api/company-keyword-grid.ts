/**
 * 🗺️ 파트너 수집 키워드 그리드 — 지역 × 업종 (2026-07-28 대표 "전국 시군구 전면").
 *
 *   **왜 전국으로 넓히나**: 대행사 이메일 수율이 낮았던 건 한국 대행사의 성질이 아니라 *우리가 캐는 방식*의
 *   성질이었다. 라이브 실측(2026-07-28) — 같은 '대행사' 카테고리인데 소스별로 극과 극:
 *     · `local`(카카오/네이버 **지도**)  480행 중 사이트 27(5.6%) · 이메일 10(**2.1%**)
 *     · `webkr`(네이버 **웹문서**)        20행 중 사이트 20(100%) · 이메일 15(**75%**)
 *   지도 레인은 설계상 place_url 을 website 로 저장하지 않아(크롤 불가) 구조적으로 이메일이 안 나온다.
 *   그런데 커버 지역이 **서울 25구 + 6광역시 = 31곳**뿐이라, 대행사가 밀집한 경기(인구 1,360만)를 비롯한
 *   전국이 통째로 미수집이었다. → 지역을 전국 시군구로 넓히는 것이 이메일 보유 대행사를 늘리는 본 레버.
 *
 *   ⚠️ 이름 충돌 주의: '중구·동구·서구·남구·북구·강서' 등은 여러 시에 있다. 검색어로 쓰이므로 광역시 구는
 *   **'부산 해운대'처럼 시명을 접두**해 모호성을 없앤다(서울 25구는 기존 시드와 호환 위해 bare 유지).
 *   '광주'(광역시 vs 경기), '고성'(강원 vs 경남)도 접두로 분리.
 */

export type Trade = { kw: string; category: string; subcategory: string; tier: number }

/** 1단계 — 대표 플레이북 실전 지역(방배 시드). tier 2~5 업종. */
export const S1_REGIONS = ['서초', '방배', '강남', '동작']
export const S1_TRADES: Trade[] = [
  { kw: '주류 도매', category: '식자재·납품', subcategory: '주류 도매', tier: 2 },
  { kw: '주류도매상', category: '식자재·납품', subcategory: '주류도매상', tier: 2 },
  { kw: '식자재 유통', category: '식자재·납품', subcategory: '식자재 유통', tier: 2 },
  { kw: '업소용 식자재', category: '식자재·납품', subcategory: '업소용 식자재', tier: 2 },
  { kw: '식자재 마트', category: '식자재·납품', subcategory: '식자재 마트', tier: 2 },
  { kw: '커피 원두 납품', category: '식자재·납품', subcategory: '커피 원두 납품', tier: 2 },
  { kw: '상가 전문 부동산', category: '부동산', subcategory: '상가부동산', tier: 3 },
  { kw: '상가 임대', category: '부동산', subcategory: '상가부동산', tier: 3 },
  { kw: '간판 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 3 },
  { kw: '상업 인테리어', category: '인테리어', subcategory: '인테리어·시공', tier: 3 },
  { kw: '주방설비', category: '인테리어', subcategory: '주방설비', tier: 3 },
  { kw: '포스 대리점', category: 'POS·단말기', subcategory: '포스 대리점', tier: 4 },
  { kw: '카드단말기', category: 'POS·단말기', subcategory: '카드단말기', tier: 4 },
  { kw: 'VAN 대리점', category: 'POS·단말기', subcategory: 'VAN 대리점', tier: 4 },
  { kw: '키오스크 설치', category: 'POS·단말기', subcategory: '키오스크 설치', tier: 4 },
  { kw: '테이블오더', category: 'POS·단말기', subcategory: '테이블오더', tier: 4 },
  { kw: '세무사무소', category: '전문서비스', subcategory: '세무사무소', tier: 5 },
  { kw: '기장 세무사', category: '전문서비스', subcategory: '기장 세무사', tier: 5 },
  { kw: '노무사 사무소', category: '전문서비스', subcategory: '노무사 사무소', tier: 5 },
]

// ── 2단계 지역: 전국 시군구(229) ────────────────────────────────────────────────
/** 서울 25구 — 기존 시드와 동일한 bare 표기 유지(재시드 시 INSERT OR IGNORE 로 중복 0). */
const SEOUL = ['강남', '서초', '송파', '강동', '마포', '용산', '성동', '광진', '영등포', '동작', '관악', '강서',
  '양천', '구로', '금천', '종로', '중구', '성북', '동대문', '중랑', '노원', '도봉', '강북', '은평', '서대문']
/** 광역시 구·군 — 구명이 여러 시에 중복이라 **시명 접두** 필수. */
const METRO_DISTRICTS = [
  '부산 중구', '부산 서구', '부산 동구', '부산 영도', '부산 진구', '부산 동래', '부산 남구', '부산 북구',
  '부산 해운대', '부산 사하', '부산 금정', '부산 강서', '부산 연제', '부산 수영', '부산 사상', '부산 기장',
  '대구 중구', '대구 동구', '대구 서구', '대구 남구', '대구 북구', '대구 수성', '대구 달서', '대구 달성', '대구 군위',
  '인천 중구', '인천 동구', '인천 미추홀', '인천 연수', '인천 남동', '인천 부평', '인천 계양', '인천 서구', '인천 강화', '인천 옹진',
  '광주 동구', '광주 서구', '광주 남구', '광주 북구', '광주 광산',
  '대전 동구', '대전 중구', '대전 서구', '대전 유성', '대전 대덕',
  '울산 중구', '울산 남구', '울산 동구', '울산 북구', '울산 울주',
  '세종',
]
/** 광역시 전체 단위(기존 시드 호환 — 구 단위와 별개로 광역 검색어도 유효). */
const METRO_WIDE = ['부산', '대구', '인천', '광주', '대전', '울산']
/** 경기 31 — '광주시(경기)'는 광주광역시와 충돌해 접두. */
const GYEONGGI = ['수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부',
  '시흥', '파주', '광명', '김포', '군포', '경기 광주', '이천', '양주', '오산', '구리', '안성', '포천', '의왕',
  '하남', '여주', '동두천', '과천', '가평', '양평', '연천']
/** 강원 18 — '고성군'은 경남과 충돌해 접두. */
const GANGWON = ['춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선',
  '철원', '화천', '양구', '인제', '강원 고성', '양양']
const CHUNGBUK = ['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양']
const CHUNGNAM = ['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양',
  '홍성', '예산', '태안']
const JEONBUK = ['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창',
  '고창', '부안']
const JEONNAM = ['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥',
  '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안']
const GYEONGBUK = ['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '의성', '청송',
  '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉']
const GYEONGNAM = ['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕',
  '경남 고성', '남해', '하동', '산청', '함양', '거창', '합천']
const JEJU = ['제주', '서귀포']

/** 2단계 전국 그리드 — 대행사(tier1) 이메일 수율이 가장 높은 웹 레인이 붙는 지역 축. */
export const S2_REGIONS: string[] = [
  ...SEOUL, ...METRO_DISTRICTS, ...METRO_WIDE, ...GYEONGGI, ...GANGWON,
  ...CHUNGBUK, ...CHUNGNAM, ...JEONBUK, ...JEONNAM, ...GYEONGBUK, ...GYEONGNAM, ...JEJU,
]

export const S2_TRADES: Trade[] = [
  { kw: '마케팅 대행사', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '퍼포먼스 마케팅 대행사', category: '대행사', subcategory: '퍼포먼스 마케팅 대행사', tier: 1 },
  { kw: '바이럴 마케팅 대행사', category: '대행사', subcategory: '바이럴 마케팅 대행사', tier: 1 },
  { kw: '소상공인 마케팅', category: '대행사', subcategory: '소상공인 마케팅', tier: 1 },
  { kw: '창업 컨설팅', category: '창업', subcategory: '창업 컨설팅', tier: 1 },
  { kw: '상권분석', category: '창업', subcategory: '상권분석', tier: 1 },
  // 🎯 2026-07-27 대표 "아인종합기획과 유사한 업체" — 지역 **종합광고기획사** 어휘(광고기획·판촉·인쇄·행사).
  { kw: '종합광고기획', category: '대행사', subcategory: '종합광고기획', tier: 1 },
  { kw: '광고기획사', category: '대행사', subcategory: '종합광고기획', tier: 1 },
  { kw: '광고대행사', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '이벤트 대행사', category: '대행사', subcategory: '행사·이벤트', tier: 1 },
  { kw: '행사 대행', category: '대행사', subcategory: '행사·이벤트', tier: 1 },
  { kw: '판촉물 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '옥외광고', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '인쇄기획', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '간판 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '현수막 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
]

export type KeywordSeedRow = { keyword: string; category: string; subcategory: string; region: string; tier: number }

/** 시드 행 전체(1단계 → 2단계 순). 같은 keyword 는 UNIQUE + INSERT OR IGNORE 로 자동 dedup. */
export function buildKeywordRows(): KeywordSeedRow[] {
  return [
    ...S1_REGIONS.flatMap(r => S1_TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    ...S2_REGIONS.flatMap(r => S2_TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
  ]
}

/**
 * 🔁 커서 회전 창(순수 함수) — 전체 `total` 개 중 `cursor` 부터 `batch` 개를 가리키는 SQL 창(들).
 *   끝을 넘어가면 앞으로 감기므로 최대 2구간. 전국 확장으로 키워드가 수천 개가 되면 매 실행마다 전량을
 *   메모리에 올리는 건 낭비라, OFFSET 창으로만 읽기 위해 분리했다(정렬이 **안정적**이어야 건너뜀이 없다).
 */
export function rotationWindow(total: number, cursor: number, batch: number): Array<{ offset: number; limit: number }> {
  if (!Number.isFinite(total) || total <= 0) return []
  if (!Number.isFinite(batch) || batch <= 0) return []
  const size = Math.min(Math.floor(batch), total)
  let start = Math.floor(Number.isFinite(cursor) ? cursor : 0) % total
  if (start < 0) start += total
  const first = Math.min(size, total - start)
  const out = [{ offset: start, limit: first }]
  if (first < size) out.push({ offset: 0, limit: size - first })
  return out
}
