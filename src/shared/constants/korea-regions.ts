/**
 * 🛡️ 2026-05-17: 공구권 지역 세분화 데이터 (당근/배민 스타일).
 *
 * 구조:
 *   - 17개 시/도 (sidebar)
 *   - 각 시/도 별 동/역 그룹 (right panel)
 *   - 각 그룹은 keywords[] 보유 → 상품 restaurant_address 매칭에 사용
 *
 * 필터 매칭:
 *   상품의 restaurant_address 에 그룹 keywords 중 하나라도 포함되면 매칭.
 *   예: address = "서울특별시 강남구 역삼동 123-45"
 *       group { keywords: ['강남', '역삼', '삼성', '논현'] } → 매칭
 *
 * 데이터 출처:
 *   서울: 2026-05-17 사용자 시안 (22그룹).
 *   다른 시/도: 후속 시안 받는 대로 채울 예정.
 */

export interface DistrictGroup {
  /** URL 안전 key — '강남/역삼/삼성/논현' → 'gangnam' */
  key: string
  /** 화면 표시 — '강남/역삼/삼성/논현' */
  label: string
  /** restaurant_address 매칭에 사용할 동/역명 */
  keywords: string[]
}

export interface Region {
  /** 한글 키 — '서울', '경기' 등 (URL ?region=서울) */
  key: string
  /** 화면 표시 */
  label: string
  /** 동/역 그룹 (당근 스타일). 빈 배열이면 시/도 단위만. */
  districtGroups: DistrictGroup[]
}

// 🛡️ 서울 22 그룹 — 사용자 시안 (2026-05-17) 그대로
const SEOUL_GROUPS: DistrictGroup[] = [
  { key: 'gangnam',      label: '강남/역삼/삼성/논현',         keywords: ['강남', '역삼', '삼성', '논현'] },
  { key: 'seocho',       label: '서초/신사/방배',              keywords: ['서초', '신사', '방배'] },
  { key: 'jamsil',       label: '잠실/방이',                   keywords: ['잠실', '방이'] },
  { key: 'jamsilsaenae', label: '잠실새내/신천/종합운동장',     keywords: ['잠실새내', '신천', '종합운동장'] },
  { key: 'yeouido',      label: '영등포/여의도',               keywords: ['영등포', '여의도'] },
  { key: 'sillim',       label: '신림/서울대/사당/동작',        keywords: ['신림', '서울대', '사당', '동작'] },
  { key: 'cheonho',      label: '천호/길동/둔촌',              keywords: ['천호', '길동', '둔촌'] },
  { key: 'mokdong',      label: '화곡/까치산/양천/목동',        keywords: ['화곡', '까치산', '양천', '목동'] },
  { key: 'guro',         label: '구로/금천/오류/신도림',        keywords: ['구로', '금천', '오류', '신도림'] },
  { key: 'sinchon',      label: '신촌/홍대/합정',              keywords: ['신촌', '홍대', '합정', '서교'] },
  { key: 'yeonsinnae',   label: '연신내/불광/응암',            keywords: ['연신내', '불광', '응암'] },
  { key: 'jongno',       label: '종로/대학로/동묘앞역',         keywords: ['종로', '대학로', '동묘앞', '동묘'] },
  { key: 'seongbuk',     label: '성신여대/성북/월곡',           keywords: ['성신여대', '성북', '월곡'] },
  { key: 'itaewon',      label: '이태원/용산/서울역/명동/회현',  keywords: ['이태원', '용산', '서울역', '명동', '회현'] },
  { key: 'dongdaemun',   label: '동대문/을지로/충무로/신당/약수', keywords: ['동대문', '을지로', '충무로', '신당', '약수'] },
  { key: 'hoegi',        label: '회기/고려대/청량리/신설동',     keywords: ['회기', '고려대', '청량리', '신설동'] },
  { key: 'jangan',       label: '장안동/답십리',               keywords: ['장안동', '장안', '답십리'] },
  { key: 'konkuk',       label: '건대/군자/구의',              keywords: ['건대', '군자', '구의'] },
  { key: 'wangsimni',    label: '왕십리/성수/금호',            keywords: ['왕십리', '성수', '금호'] },
  { key: 'suyu',         label: '수유/미아',                   keywords: ['수유', '미아'] },
  { key: 'sangbong',     label: '상봉/중랑/면목',              keywords: ['상봉', '중랑', '면목'] },
  { key: 'taereung',     label: '태릉/노원/도봉/창동',          keywords: ['태릉', '노원', '도봉', '창동'] },
]

// 🛡️ 경기 28 그룹 — 사용자 시안 (2026-05-17)
//   주의: 일부 그룹명은 다른 시/도 와 단어 충돌 가능 (예: '광주' → 광주광역시 vs 경기 광주).
//   keywords 는 지역 고유 동/역명 위주로 구성해 오매칭 최소화.
const GYEONGGI_GROUPS: DistrictGroup[] = [
  { key: 'suwon_ingye',      label: '수원 인계동/나혜석거리',           keywords: ['인계동', '나혜석거리', '나혜석', '수원 인계'] },
  { key: 'suwon_yeok',       label: '수원역/구운/평동/장안구',          keywords: ['수원역', '구운동', '구운', '평동', '장안구'] },
  { key: 'suwon_city',       label: '수원시청/권선/영통/세류',          keywords: ['수원시청', '권선', '영통', '세류'] },
  { key: 'anyang',           label: '안양/평촌/인덕원/과천',            keywords: ['안양', '평촌', '인덕원', '과천'] },
  { key: 'seongnam',         label: '성남/분당/위례',                   keywords: ['성남', '분당', '위례'] },
  { key: 'yongin',           label: '용인',                             keywords: ['용인'] },
  { key: 'dongtan',          label: '동탄/화성/오산/병점',              keywords: ['동탄', '화성', '오산', '병점'] },
  { key: 'hanam',            label: '하남/광주(곤지암)',                keywords: ['하남', '곤지암', '경기 광주', '경기도 광주'] },
  { key: 'yeoju',            label: '여주/이천',                        keywords: ['여주', '이천'] },
  { key: 'ansan_jung',       label: '안산 중앙역',                      keywords: ['안산 중앙역', '안산중앙역'] },
  { key: 'ansan_gojan',      label: '안산 고잔/상록수/선부동/월피동',   keywords: ['고잔', '상록수', '선부동', '월피동'] },
  { key: 'gunpo',            label: '군포/의왕/금정/산본',              keywords: ['군포', '의왕', '금정', '산본'] },
  { key: 'siheung',          label: '시흥(월곶/정왕/오이도/거북섬)',    keywords: ['시흥', '월곶', '월곳', '정왕', '오이도', '거북섬'] },
  { key: 'gwangmyeong',      label: '광명',                             keywords: ['광명'] },
  { key: 'pyeongtaek',       label: '평택/송탄/안성',                   keywords: ['평택', '송탄', '안성'] },
  { key: 'bucheon',          label: '부천',                             keywords: ['부천'] },
  { key: 'ilsan',            label: '일산/고양',                        keywords: ['일산', '고양'] },
  { key: 'paju',             label: '파주',                             keywords: ['파주'] },
  { key: 'gimpo',            label: '김포',                             keywords: ['김포'] },
  { key: 'uijeongbu',        label: '의정부',                           keywords: ['의정부'] },
  { key: 'guri',             label: '구리',                             keywords: ['구리'] },
  { key: 'namyangju_dasan',  label: '남양주(다산/별내/와부/호평)',      keywords: ['다산', '별내', '와부', '호평', '남양주'] },
  { key: 'namyangju_onam',   label: '남양주(오남/조안/화도/진접)',      keywords: ['오남', '조안', '화도', '진접'] },
  { key: 'pocheon',          label: '포천',                             keywords: ['포천'] },
  { key: 'yangju',           label: '양주/동두천/연천',                 keywords: ['양주', '동두천', '연천'] },
  { key: 'yangpyeong',       label: '양평',                             keywords: ['양평'] },
  { key: 'gapyeong',         label: '가평/청평',                        keywords: ['가평', '청평'] },
  { key: 'jebudo',           label: '제부도/대부도',                    keywords: ['제부도', '대부도'] },
]

// 🛡️ 인천 10 그룹 — 사용자 시안 (2026-05-17)
const INCHEON_GROUPS: DistrictGroup[] = [
  { key: 'bupyeong',  label: '부평',                                  keywords: ['부평'] },
  { key: 'guwol',     label: '구월/소래포구/호구포',                   keywords: ['구월', '소래포구', '소래', '호구포'] },
  { key: 'seogu',     label: '서구(석남/서구청/검단)',                 keywords: ['석남', '서구청', '검단', '인천 서구', '인천서구'] },
  { key: 'gyeyang',   label: '계양(작전/경인교대)',                    keywords: ['계양', '작전동', '작전', '경인교대'] },
  { key: 'juan',      label: '주안',                                   keywords: ['주안'] },
  { key: 'songdo',    label: '송도/연수',                              keywords: ['송도', '연수'] },
  { key: 'airport',   label: '인천공항/을왕리/영종도',                 keywords: ['인천공항', '을왕리', '영종도', '영종'] },
  { key: 'dongam',    label: '동암/간석',                              keywords: ['동암', '간석'] },
  { key: 'yonghyeon', label: '용현/숭의/월미도/신포/동인천/연안부두',  keywords: ['용현', '숭의', '월미도', '월미', '신포', '동인천', '연안부두'] },
  { key: 'ganghwa',   label: '강화/옹진',                              keywords: ['강화', '옹진'] },
]

// 🛡️ 강원 11 그룹 — 사용자 시안 (2026-05-17)
//   '영월/성선' 은 일반적으로 '영월/정선' 으로 표기되므로 keyword 에 둘 다 포함.
const GANGWON_GROUPS: DistrictGroup[] = [
  { key: 'chuncheon',   label: '춘천/강촌',                  keywords: ['춘천', '강촌'] },
  { key: 'wonju',       label: '원주',                       keywords: ['원주'] },
  { key: 'gyeongpo',    label: '경포대/사천/주문진/정동진',  keywords: ['경포대', '경포', '사천', '주문진', '정동진'] },
  { key: 'gangneung',   label: '강릉역/교동/옥계',           keywords: ['강릉역', '강릉', '교동', '옥계'] },
  { key: 'yeongwol',    label: '영월/정선',                  keywords: ['영월', '정선', '성선'] },
  { key: 'sokcho',      label: '속초/고성',                  keywords: ['속초', '고성'] },
  { key: 'yangyang',    label: '양양(서피비치/낙산)',        keywords: ['양양', '서피비치', '낙산'] },
  { key: 'donghae',     label: '동해/삼척/태백',             keywords: ['동해', '삼척', '태백'] },
  { key: 'pyeongchang', label: '평창',                       keywords: ['평창'] },
  { key: 'hongcheon',   label: '홍천/횡성',                  keywords: ['홍천', '횡성'] },
  { key: 'hwacheon',    label: '화천/철원/인제/양구',        keywords: ['화천', '철원', '인제', '양구'] },
]

// 🛡️ 제주 6 그룹 — 사용자 시안 (2026-05-17)
const JEJU_GROUPS: DistrictGroup[] = [
  { key: 'airport_w',  label: '제주공항 서부(용담/도두/연동/노형동)',     keywords: ['용담', '도두', '연동', '노형'] },
  { key: 'airport_e',  label: '제주공항 동부(제주시청/탑동/건입동)/추자도', keywords: ['제주시청', '탑동', '건입동', '추자도'] },
  { key: 'seogwipo',   label: '서귀포시/중문/모슬포',                     keywords: ['서귀포', '중문', '모슬포'] },
  { key: 'iho',        label: '이호테우/하귀/애월/한림/협재',             keywords: ['이호테우', '이호', '하귀', '애월', '한림', '협재'] },
  { key: 'hamdeok',    label: '함덕/김녕/세화',                          keywords: ['함덕', '김녕', '세화'] },
  { key: 'namwon',     label: '남원/표선/성산',                          keywords: ['남원', '표선', '성산'] },
]

// 🛡️ 대전 5 그룹 — 사용자 시안 (2026-05-17)
const DAEJEON_GROUPS: DistrictGroup[] = [
  { key: 'yuseong', label: '유성구',                       keywords: ['유성구', '유성'] },
  { key: 'junggu',  label: '중구(은행/대흥/선화/유천)',    keywords: ['은행동', '대흥동', '선화동', '유천동', '대전 중구', '대전중구'] },
  { key: 'donggu',  label: '동구(용전/복합터미널)',        keywords: ['용전동', '용전', '복합터미널', '대전 동구', '대전동구'] },
  { key: 'seogu_dj', label: '서구(둔산/용문/월평)',         keywords: ['둔산', '용문동', '월평', '대전 서구', '대전서구'] },
  { key: 'daedeok', label: '대덕구(중리/신탄진)',          keywords: ['대덕구', '대덕', '중리', '신탄진'] },
]

// 🛡️ 충북 6 그룹 — 사용자 시안 (2026-05-17)
const CHUNGBUK_GROUPS: DistrictGroup[] = [
  { key: 'cheongju_w', label: '청주 흥덕구/서원구(청주 터미널)',     keywords: ['흥덕구', '서원구', '청주 터미널', '청주터미널'] },
  { key: 'cheongju_e', label: '청주 상당구/청원구(청주국제공항)',    keywords: ['상당구', '청원구', '청주국제공항', '청주공항'] },
  { key: 'chungju',    label: '충주/수안보',                         keywords: ['충주', '수안보'] },
  { key: 'jecheon',    label: '제천/단양',                           keywords: ['제천', '단양'] },
  { key: 'jincheon',   label: '진천/음성',                           keywords: ['진천', '음성'] },
  { key: 'boeun',      label: '보은/옥천/괴산/증평/영동',            keywords: ['보은', '옥천', '괴산', '증평', '영동'] },
]

// 🛡️ 충남세종 11 그룹 — 사용자 시안 (2026-05-17)
const CHUNGNAM_SEJONG_GROUPS: DistrictGroup[] = [
  { key: 'cheonan_w',  label: '천안 서북구',           keywords: ['천안 서북구', '천안서북구', '서북구'] },
  { key: 'cheonan_e',  label: '천안 동남구',           keywords: ['천안 동남구', '천안동남구', '동남구'] },
  { key: 'asan',       label: '아산',                  keywords: ['아산'] },
  { key: 'gongju',     label: '공주/동학사/세종',      keywords: ['공주', '동학사', '세종'] },
  { key: 'gyeryong',   label: '계룡/금산/논산/청양',   keywords: ['계룡', '금산', '논산', '청양'] },
  { key: 'yesan',      label: '예산/홍성',             keywords: ['예산', '홍성'] },
  { key: 'taean',      label: '태안/안면도',           keywords: ['태안', '안면도', '안면'] },
  { key: 'seosan',     label: '서산',                  keywords: ['서산'] },
  { key: 'dangjin',    label: '당진',                  keywords: ['당진'] },
  { key: 'boryeong',   label: '보령/대천해수욕장',     keywords: ['보령', '대천해수욕장', '대천해수욕'] },
  { key: 'seocheon',   label: '서천/부여',             keywords: ['서천', '부여'] },
]

export const KOREA_REGIONS: Region[] = [
  { key: '서울',       label: '서울',       districtGroups: SEOUL_GROUPS },
  { key: '경기',       label: '경기',       districtGroups: GYEONGGI_GROUPS },
  { key: '인천',       label: '인천',       districtGroups: INCHEON_GROUPS },
  { key: '강원',       label: '강원',       districtGroups: GANGWON_GROUPS },
  { key: '제주',       label: '제주',       districtGroups: JEJU_GROUPS },
  { key: '대전',       label: '대전',       districtGroups: DAEJEON_GROUPS },
  { key: '충북',       label: '충북',       districtGroups: CHUNGBUK_GROUPS },
  { key: '충남세종',   label: '충남\n세종', districtGroups: CHUNGNAM_SEJONG_GROUPS },
  { key: '부산',       label: '부산',       districtGroups: [] },
  { key: '울산',       label: '울산',       districtGroups: [] },
  { key: '경남',       label: '경남',       districtGroups: [] },
  { key: '대구',       label: '대구',       districtGroups: [] },
  { key: '경북',       label: '경북',       districtGroups: [] },
  { key: '광주',       label: '광주',       districtGroups: [] },
  { key: '전남',       label: '전남',       districtGroups: [] },
  { key: '전북',       label: '전북',       districtGroups: [] },
]

/** 시/도 키로 Region 찾기 */
export function findRegionByKey(key: string | null | undefined): Region | undefined {
  if (!key) return undefined
  return KOREA_REGIONS.find(r => r.key === key)
}

/** Region + districtGroup key 조합으로 DistrictGroup 찾기 */
export function findDistrictGroup(regionKey: string | null | undefined, districtKey: string | null | undefined): DistrictGroup | undefined {
  if (!regionKey || !districtKey) return undefined
  const region = findRegionByKey(regionKey)
  if (!region) return undefined
  return region.districtGroups.find(g => g.key === districtKey)
}

/**
 * 주소가 region 또는 districtGroup 에 매칭되는지 확인.
 *   - region 지정 + district 지정: 두 조건 모두 매칭
 *   - region 만 지정: 주소에 region label 포함 또는 region 의 그룹 키워드 중 하나라도 매칭
 *   - 둘 다 빈 값: 항상 true (필터 없음)
 */
export function matchAddress(
  address: string | undefined | null,
  regionKey: string | null | undefined,
  districtKey: string | null | undefined,
): boolean {
  if (!regionKey) return true
  const region = findRegionByKey(regionKey)
  if (!region) return true
  const addr = (address || '').trim()
  if (!addr) return false

  // district 지정 시: 해당 그룹 keywords 매칭
  if (districtKey) {
    const dg = region.districtGroups.find(g => g.key === districtKey)
    if (dg) {
      return dg.keywords.some(k => addr.includes(k))
    }
  }

  // district 미지정 (region 전체):
  //   1) 주소에 region label 포함 (예: "서울특별시", "서울시", "서울")
  //   2) 또는 해당 region 의 그룹 키워드 중 하나라도 매칭
  if (addr.includes(region.key)) return true
  return region.districtGroups.some(dg => dg.keywords.some(k => addr.includes(k)))
}
