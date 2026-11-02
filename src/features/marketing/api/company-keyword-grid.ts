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

/**
 * 🗺️ 권역 묶음 — 화면에서 "서울·경기만 집중" 을 표현하려면 이 그룹이 필요하다 (2026-08-02).
 *   지역 배열은 평평해서(`강남` · `부산 해운대` · `수원`) 접두사로는 서울을 못 고른다.
 *   ⚠️ 값은 위 상수를 **그대로 참조**한다 — 복제하면 지역을 추가할 때 한쪽만 늘어난다.
 */
export const REGION_GROUPS: Record<string, string[]> = {
  서울: SEOUL, 광역시: [...METRO_DISTRICTS, ...METRO_WIDE], 경기: GYEONGGI, 강원: GANGWON,
  충북: CHUNGBUK, 충남: CHUNGNAM, 전북: JEONBUK, 전남: JEONNAM,
  경북: GYEONGBUK, 경남: GYEONGNAM, 제주: JEJU,
}

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

// ── 3단계: 공동구매 생태계 (2026-07-29 대표 "창고형 공동구매, 공동구매 관련 키워드 업체들") ──────
//
//   왜 tier 1 인가: 이들은 **유어딜과 같은 언어를 쓴다**. 공동구매가 무엇인지, 왜 모아야 싼지,
//   정산이 어떻게 도는지를 설명할 필요가 없다 — 파트너 전환에서 가장 비싼 단계가 통째로 빠진다.
//
//   ⚠️ 서비스 분리: 여기는 **유어딜 파트너 풀**(`ad_company_leads`)이다. B2B 도매 공급자(제조사) 발굴은
//      `supply-maker-collect` 의 별개 레인이며 서로의 테이블·키워드를 건드리지 않는다(CLAUDE.md 분리 룰).

/** 오프라인 축 — 창고형은 **지역성이 크다**(대형 부지·차량 접근). 지역 그리드에 얹는다. */
export const S3_TRADES_LOCAL: Trade[] = [
  { kw: '창고형 공동구매', category: '공동구매', subcategory: '창고형 공동구매', tier: 1 },
  { kw: '창고형 할인매장', category: '공동구매', subcategory: '창고형 공동구매', tier: 2 },
  { kw: '창고형 마트', category: '공동구매', subcategory: '창고형 공동구매', tier: 2 },
]

/**
 * 온라인 축 — 총판·벤더·대행은 **지역이 의미 없다**(전국 상대 영업). 지역을 접두하면 오히려 리콜이 죽는다.
 *   그래서 지역 그리드에 곱하지 않고 **키워드 1개씩만** 넣는다(235배 폭증 없이 커버).
 */
export const S3_TRADES_NATIONWIDE: Trade[] = [
  { kw: '공동구매 총판', category: '공동구매', subcategory: '공동구매 총판·벤더', tier: 1 },
  { kw: '공동구매 벤더', category: '공동구매', subcategory: '공동구매 총판·벤더', tier: 1 },
  { kw: '공동구매 대행', category: '공동구매', subcategory: '공동구매 대행', tier: 1 },
  { kw: '공동구매 플랫폼', category: '공동구매', subcategory: '공동구매 플랫폼', tier: 1 },
  { kw: '공동구매 진행업체', category: '공동구매', subcategory: '공동구매 대행', tier: 1 },
  { kw: '인플루언서 공동구매', category: '공동구매', subcategory: '공동구매 대행', tier: 1 },
  { kw: '식품 공동구매', category: '공동구매', subcategory: '공동구매 총판·벤더', tier: 2 },
  { kw: '생활용품 공동구매', category: '공동구매', subcategory: '공동구매 총판·벤더', tier: 2 },
  // 🧪 **체험단 축**(2026-08-17 대표 지시 "체험단 키워드로도 b2b db 수집 필요해").
  //   ⚠️ 분류기는 이미 준비돼 있었다 — `company-classify.ts` 의
  //   `/(체험단|플레이스\s*마케팅|블로그\s*마케팅|리뷰\s*마케팅)/` → 대행사/체험단·플레이스/tier 1.
  //   **없던 것은 수집 키워드뿐**이라 분류 규칙은 손대지 않는다(두 벌이 되면 갈라진다).
  //   🔑 왜 유어딜에 맞는 축인가: 체험단 대행사는 **이미 매장을 모아 인플루언서에게 붙이는 일**을 한다 —
  //   유어딜이 하려는 것과 같은 동작이라 전환 설명 비용이 가장 낮다(공동구매 축과 같은 논리).
  //   ⚠️ **배열 끝에 붙인다** — `seedPrefixHash` 가 앞부분 불변을 확인해 이어받으므로, 중간에 끼우면
  //   지문이 어긋나 4,500행을 처음부터 다시 훑는다(반나절 지연). 지역 확장은 후속으로.
  { kw: '체험단 대행사', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '체험단 마케팅', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '체험단 모집 대행', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '블로그 체험단', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '맛집 체험단', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '뷰티 체험단', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '플레이스 마케팅', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '리뷰 마케팅 대행', category: '대행사', subcategory: '체험단·플레이스', tier: 1 },
  { kw: '체험단 플랫폼', category: '대행사', subcategory: '체험단·플레이스', tier: 2 },
]

// ── 4단계: 고수율 광맥 심화 (2026-08-23 — 대표 "모두 다 하자") ──────────────────────────────
//
//   🔑 **총계가 아니라 "발송 가능 리드"로 골랐다.** webkr 출처 실측(2026-08-23, `ad_company_leads`)에서
//   **신규 행 비율과 이메일 수율이 갈렸다** — 이게 이 단계의 전부다:
//   ```
//     창업 컨설팅        356행 · 이메일 124 (34.8%)   ← 가장 높다
//     마케팅 대행사      400행 · 이메일 130 (32.5%)
//     퍼포먼스 마케팅    207행 · 이메일  66 (31.9%)
//     바이럴 마케팅      148행 · 이메일  45 (30.4%)
//     행사·이벤트        466행 · 이메일 120 (25.8%)
//     종합광고기획       385행 · 이메일  91 (23.6%)
//     간판·광고물 제작    64행 · 이메일   6 ( 9.4%)   ← 신규 행 비율은 99.6%인데 이메일은 최하위
//   ```
//   ⚠️ **"새 행이 많이 나온다"에 속지 말 것.** 간판은 행을 가장 잘 만들지만 발송 가능 리드는 거의 못 만든다.
//   같은 이유로 **매장 생태계 업종(주류 도매·식자재·주방설비·POS·인테리어)은 전국으로 넓히지 않았다** —
//   실측 이메일 수율이 0~10%이고 사이트 보유율 자체가 낮아, 사이트를 전제로 도는 이 레인엔 맞지 않는다
//   (인테리어 2,876행 중 이메일 14건 = 0.5%). 넓히면 회전 주기만 길어지고 발송 대상은 안 는다.
//
//   ⚠️ **배열 끝 · 곱셈 순서 끝** — `seedPrefixHash` 가 앞부분 불변으로 이어받으므로, 이 단계는
//   `buildKeywordRows()` 의 **마지막**에 붙는다. 중간에 끼우면 4,555행을 처음부터 다시 훑는다.
export const S4_TRADES_LOCAL: Trade[] = [
  { kw: 'SNS 마케팅 대행', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '온라인 마케팅 대행', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '홍보대행사', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '블로그 마케팅 대행', category: '대행사', subcategory: '바이럴 마케팅 대행사', tier: 1 },
  { kw: '프랜차이즈 창업 컨설팅', category: '창업', subcategory: '창업 컨설팅', tier: 1 },
  { kw: '외식업 컨설팅', category: '창업', subcategory: '창업 컨설팅', tier: 1 },
]

// ── 5단계: 생활 업종 + 전문직 (2026-11-02 — 대표 *"응 모아줘. 필요해. 전문직종과 생활 카테고리 모두 각자 넣어줘야지"*) ──
//
//   🔎 **왜 지금까지 없었나(라이브 실측 2026-11-02)**: 파트너 풀 54만 행 중 상호에 '이사' 가 든 업체 250 ·
//   '청소' 225 · '방역' 20 — 그나마 대부분 `통신판매`·`대행사` 칸에 잘못 들어가 있었다. 분류가 틀린 게 아니라
//   **검색어가 없어서 애초에 안 모였다.** 법무사도 35건(상가정보 업종코드가 세무사와 섞여 들어온 것뿐).
//
//   🏠 생활 4종은 유어딜 생활 칩(이사·청소·방역·소독·수리·설치)에 딜을 올릴 **입점 후보**다. 이메일보다
//   **전화**로 닿는 업종이라(지도 등록 위주) 카카오 로컬 레인(키워드당 45건 + 전화)이 주력이다 — 그래서
//   4단계의 "이메일 수율로 고른다" 기준을 여기엔 적용하지 않는다. 대신 검색어를 **업종당 한두 개**로 좁혀
//   회전 주기가 늘어나는 비용을 줄였다(5종 × 235 지역).
//   🧭 전문직은 국가자격 단위로 따로 넣는다. 세무사·회계사·노무사는 상가정보 업종코드가 이미 통째로 받으므로
//   **없는 자격만** 넣는다: 흔한 셋(법무사·변호사·행정사)은 전국, 드문 넷(변리사·감정평가사·관세사·손해사정사)은
//   사무소가 몰려 있는 서울·광역시·경기에만(시골 군 단위에 곱하면 빈 검색만 늘어난다).
//
//   ⚠️ **배열 끝 · 곱셈 순서 끝** — `buildKeywordRows()` 맨 뒤에 붙인다(앞 인덱스가 밀리면 시드 이어받기가 0).
export const S5_TRADES_LIFE: Trade[] = [
  { kw: '포장이사', category: '이사', subcategory: '포장이사', tier: 3 },
  { kw: '입주청소', category: '청소', subcategory: '입주·이사청소', tier: 3 },
  { kw: '에어컨 청소', category: '청소', subcategory: '에어컨·가전청소', tier: 3 },
  { kw: '방역 소독', category: '방역·소독', subcategory: '방역·소독', tier: 3 },
  { kw: '누수 설비', category: '수리·설치', subcategory: '설비·배관', tier: 3 },
]
export const S5_TRADES_PROFESSION: Trade[] = [
  { kw: '법무사', category: '전문서비스', subcategory: '법무사', tier: 5 },
  { kw: '변호사 사무소', category: '전문서비스', subcategory: '변호사', tier: 5 },
  { kw: '행정사', category: '전문서비스', subcategory: '행정사', tier: 5 },
]
export const S5_TRADES_PROFESSION_CITY: Trade[] = [
  { kw: '변리사', category: '전문서비스', subcategory: '변리사', tier: 5 },
  { kw: '감정평가사', category: '전문서비스', subcategory: '감정평가사', tier: 5 },
  { kw: '관세사', category: '전문서비스', subcategory: '관세사', tier: 5 },
  { kw: '손해사정사', category: '전문서비스', subcategory: '손해사정사', tier: 5 },
]
/** 드문 전문직을 곱할 지역 — 서울 25구 · 광역시 6 · 경기 31. 값은 위 상수를 그대로 참조한다(복제 금지). */
export const CITY_REGIONS: string[] = [...SEOUL, ...METRO_WIDE, ...GYEONGGI]

export type KeywordSeedRow = { keyword: string; category: string; subcategory: string; region: string; tier: number }

/** 시드 행 전체(1 → 2 → 3단계 순). 같은 keyword 는 UNIQUE + INSERT OR IGNORE 로 자동 dedup. */
export function buildKeywordRows(): KeywordSeedRow[] {
  return [
    ...S1_REGIONS.flatMap(r => S1_TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    ...S2_REGIONS.flatMap(r => S2_TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    ...S2_REGIONS.flatMap(r => S3_TRADES_LOCAL.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    // 전국 축은 지역 접두 없음 — region 은 빈 문자열(리드에 지역이 안 붙는다는 뜻, 거짓 지역 라벨 금지).
    ...S3_TRADES_NATIONWIDE.map(t => ({ keyword: t.kw, category: t.category, subcategory: t.subcategory, region: '', tier: t.tier })),
    // 4단계는 **맨 뒤**여야 한다 — 앞 인덱스가 하나라도 밀리면 시드 이어받기가 0 으로 떨어진다.
    ...S2_REGIONS.flatMap(r => S4_TRADES_LOCAL.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    // 5단계(2026-11-02) — 역시 **맨 뒤**. 생활 → 전문직(전국) → 전문직(도시) 순서를 바꾸지 말 것.
    ...S2_REGIONS.flatMap(r => S5_TRADES_LIFE.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    ...S2_REGIONS.flatMap(r => S5_TRADES_PROFESSION.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    ...CITY_REGIONS.flatMap(r => S5_TRADES_PROFESSION_CITY.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
  ]
}

/**
 * 🔢 시드 진행 이어받기 (2026-07-29) — **버전을 올렸다고 처음부터 다시 넣지 않는다.**
 *
 *   문제: 진행값이 `"<version>:<seeded>"` 라 버전이 바뀌면 `seeded` 를 버리고 0 부터 다시 넣었다.
 *   행이 4,500개고 회당 500행이면 **10회(≈10시간) 뒤에야 새 키워드가 들어간다** — 새 키워드는 배열 끝에
 *   덧붙기 때문이다. 즉 "지금 이 업종을 수집하고 싶다"는 요청이 반나절 늦게 반영된다(INSERT OR IGNORE 라
 *   앞의 3,600행은 아무것도 안 바뀌는데 그 자리를 다시 훑느라).
 *
 *   해법: 앞부분이 **정말 그대로인지**를 지문으로 확인하고, 그렇다면 이어받는다. 앞이 바뀌었으면(재정렬·삭제)
 *   지문이 어긋나 안전하게 0 으로 떨어진다 — "아마 덧붙이기겠지"라고 **가정하지 않는다**.
 */
export function seedPrefixHash(rows: KeywordSeedRow[], upto: number): string {
  let h = 0x811c9dc5 // FNV-1a 32bit — 암호용이 아니라 '앞부분이 그대로인가' 확인용(순수 CPU, D1 0)
  const end = Math.max(0, Math.min(upto, rows.length))
  for (let i = 0; i < end; i++) {
    const k = rows[i].keyword
    for (let j = 0; j < k.length; j++) { h ^= k.charCodeAt(j); h = Math.imul(h, 0x01000193) }
  }
  return (h >>> 0).toString(36)
}

/** 진행값 `"<ver>:<seeded>"` 또는 `"<ver>:<seeded>:<hash>"` → 이번 실행이 시작할 인덱스. */
export function resumeSeedIndex(raw: string | null | undefined, version: number, rows: KeywordSeedRow[]): number {
  const [ver, seededRaw, hash] = String(raw || '').split(':')
  const seeded = Math.max(0, parseInt(seededRaw || '0', 10) || 0)
  if (!seeded) return 0
  if (ver === String(version)) return Math.min(seeded, rows.length) // 같은 버전 — 평소의 이어받기
  // 버전이 올랐다: 앞부분이 그대로면(덧붙이기만 했다면) 거기서 이어받는다. 지문이 없거나 다르면 처음부터.
  if (!hash) return 0
  return hash === seedPrefixHash(rows, seeded) ? Math.min(seeded, rows.length) : 0
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
