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

// 🛡️ 부산 12 그룹 — 사용자 시안 (2026-05-17)
const BUSAN_GROUPS: DistrictGroup[] = [
  { key: 'haeundae',     label: '해운대/센텀시티/재송',                       keywords: ['해운대', '센텀시티', '센텀', '재송'] },
  { key: 'songjeong',    label: '송정/기장/정관/오시리아 관광단지',           keywords: ['송정', '기장', '정관', '오시리아'] },
  { key: 'gwangalli',    label: '광안리/수영',                                keywords: ['광안리', '광안', '수영'] },
  { key: 'gyeongseong',  label: '경성대/대연/용호동/문현',                    keywords: ['경성대', '대연', '용호동', '용호', '문현'] },
  { key: 'seomyeon',     label: '서면/양정/초읍/부산시민공원',                keywords: ['서면', '양정', '초읍', '부산시민공원'] },
  { key: 'nampodong',    label: '남포동/중앙동/태종대/송도/영도',             keywords: ['남포동', '남포', '중앙동', '태종대', '부산 송도', '영도'] },
  { key: 'busan_yeok',   label: '부산역/범일동/부산진역',                     keywords: ['부산역', '범일동', '범일', '부산진역', '부산진'] },
  { key: 'yeonsan',      label: '연산/토곡',                                  keywords: ['연산동', '연산역', '토곡'] },
  { key: 'dongnae',      label: '동래/사직/미남/온천장/부산대/구서/서동',     keywords: ['동래', '사직', '미남', '온천장', '부산대', '구서', '서동'] },
  { key: 'sasang',       label: '사상(경전철)/엄궁/학장',                     keywords: ['사상', '엄궁', '학장'] },
  { key: 'deokcheon',    label: '덕천/화명/만덕/구포(구포역/KTX역)',          keywords: ['덕천', '화명', '만덕', '구포'] },
  { key: 'hadan',        label: '하단/명지/김해공항/다대포/강서/신호/괴정/지사', keywords: ['하단', '명지', '김해공항', '다대포', '강서', '신호', '괴정', '지사'] },
]

// 🛡️ 울산 2 그룹 — 사용자 시안 (2026-05-17)
const ULSAN_GROUPS: DistrictGroup[] = [
  { key: 'namgu',  label: '남구/중구(삼산/성남/무거/신정)',                  keywords: ['삼산', '성남동', '무거', '신정', '울산 남구', '울산 중구'] },
  { key: 'donggu', label: '동구/북구/울주군(일산/진장/진하/KTX역/영남알프스)', keywords: ['울산 일산', '진장', '진하', '울산 KTX', '영남알프스', '울산 동구', '울산 북구', '울주군'] },
]

// 🛡️ 경남 11 그룹 — 사용자 시안 (2026-05-17)
const GYEONGNAM_GROUPS: DistrictGroup[] = [
  { key: 'changwon_s',  label: '창원 상남동/용호동/중앙동/창원시청',                       keywords: ['창원 상남동', '상남동', '창원 용호동', '창원 중앙동', '창원시청'] },
  { key: 'changwon_w',  label: '창원 명서동/봉곡동/팔용동/북면온천/창원종합버스터미널',     keywords: ['명서동', '봉곡동', '팔용동', '북면온천', '창원종합', '창원터미널'] },
  { key: 'masan',       label: '마산',                                                    keywords: ['마산'] },
  { key: 'jinhae',      label: '진해',                                                    keywords: ['진해'] },
  { key: 'gimhae',      label: '김해/상유',                                               keywords: ['김해', '상유'] },
  { key: 'yangsan',     label: '양산/밀양',                                               keywords: ['양산', '밀양'] },
  { key: 'jinju',       label: '진주',                                                    keywords: ['진주'] },
  { key: 'geoje',       label: '거제/통영/고성',                                          keywords: ['거제', '통영', '경남 고성'] },
  { key: 'sacheon',     label: '사천/남해',                                               keywords: ['사천', '남해'] },
  { key: 'hadong',      label: '하동/산청/함양',                                          keywords: ['하동', '산청', '함양'] },
  { key: 'geochang',    label: '거창/함안/창녕/합천/의령',                                keywords: ['거창', '함안', '창녕', '합천', '의령'] },
]

// 🛡️ 대구 6 그룹 — 사용자 시안 (2026-05-17)
const DAEGU_GROUPS: DistrictGroup[] = [
  { key: 'dongseongno', label: '동성로/서문시장/대구역/경북대/엑스코',                                  keywords: ['동성로', '서문시장', '대구역', '경북대', '엑스코'] },
  { key: 'dongdaegu',   label: '동대구역/신천동/수성못/범어/라이온즈파크/알파시티/시지',                keywords: ['동대구역', '동대구', '신천동', '수성못', '수성', '범어', '라이온즈파크', '알파시티', '시지'] },
  { key: 'daegu_airp',  label: '대구공항/혁신도시/동촌유원지/팔공산/이시아폴리스/군위',                keywords: ['대구공항', '대구 혁신도시', '동촌유원지', '동촌', '팔공산', '이시아폴리스', '군위'] },
  { key: 'seodaegu',    label: '서대구역/북부정류장/평리/비산/칠곡지구/동천동/금호지구',               keywords: ['서대구역', '서대구', '북부정류장', '대구 평리', '대구 비산', '칠곡지구', '동천동', '금호지구'] },
  { key: 'duryu',       label: '두류/이월드/본리동/죽전동/서부정류장/앞산공원/안지랑/대명동/봉덕동',     keywords: ['두류', '이월드', '본리동', '죽전동', '서부정류장', '앞산공원', '앞산', '안지랑', '대명동', '봉덕동'] },
  { key: 'seongseo',    label: '성서/계명대/상인동/대곡/현풍/테크노폴리스/가창/달성군',                keywords: ['성서', '계명대', '대구 상인동', '대구 대곡', '현풍', '대구 테크노폴리스', '가창', '달성군'] },
]

// 🛡️ 경북 11 그룹 — 사용자 시안 (2026-05-17)
//   주의: 경산의 '대구대' 는 경북 경산시 소재 (대구광역시 아님) — keyword 충돌 가능성 있어 '경산 대구대' 로 wrap.
const GYEONGBUK_GROUPS: DistrictGroup[] = [
  { key: 'pohang_s',   label: '포항/남구(시청/시외버스터미널/구룡포/쌍사/문덕/오천/송도)', keywords: ['포항 남구', '포항시청', '포항 시외버스터미널', '구룡포', '포항 쌍사', '포항 문덕', '오천', '포항 송도'] },
  { key: 'pohang_n',   label: '포항/북구(영일대/죽도시장/여객터미널)',                       keywords: ['포항 북구', '영일대', '죽도시장', '포항 여객터미널'] },
  { key: 'gyeongju',   label: '경주(보문단지/황리단길/불국사/양남/감포/안강)',                keywords: ['경주', '보문단지', '황리단길', '불국사', '양남', '감포', '안강'] },
  { key: 'gumi',       label: '구미',                                                       keywords: ['구미'] },
  { key: 'gyeongsan',  label: '경산(영남대/대구대/갓바위/하양/진량/자인)',                   keywords: ['경산', '영남대', '경산 대구대', '갓바위', '하양', '진량', '자인'] },
  { key: 'andong',     label: '안동(경북도청/하회마을)',                                     keywords: ['안동', '경북도청', '하회마을'] },
  { key: 'yeongcheon', label: '영천/청도',                                                  keywords: ['영천', '청도'] },
  { key: 'gimcheon',   label: '김천/칠곡/성주',                                             keywords: ['김천', '칠곡', '성주'] },
  { key: 'mungyeong',  label: '문경/상주/영주/예천/의성/봉화',                              keywords: ['문경', '상주', '영주', '예천', '의성', '봉화'] },
  { key: 'uljin',      label: '울진/영덕/청송',                                             keywords: ['울진', '영덕', '청송'] },
  { key: 'ulleungdo',  label: '울릉도',                                                     keywords: ['울릉도', '울릉'] },
]

// 🛡️ 광주 5 그룹 — 사용자 시안 (2026-05-17)
const GWANGJU_GROUPS: DistrictGroup[] = [
  { key: 'sangmu',    label: '상무지구/금호지구/유스퀘어/서구',              keywords: ['상무지구', '광주 금호지구', '유스퀘어', '광주 서구'] },
  { key: 'chungjang', label: '충장로/대인시장/국립아시아문화전당/동구/남구',  keywords: ['충장로', '대인시장', '국립아시아문화전당', '아시아문화전당', '광주 동구', '광주 남구'] },
  { key: 'cheomdan',  label: '첨단지구/양산동',                              keywords: ['첨단지구', '광주 양산동'] },
  { key: 'hanam_g',   label: '하남/광주여대/송정역/광산구',                  keywords: ['광주 하남', '광주여대', '광주송정역', '광산구'] },
  { key: 'gwangjuyeok', label: '광주역/기아챔피언스필드/전대사거리/북구',     keywords: ['광주역', '기아챔피언스필드', '챔피언스필드', '전대사거리', '광주 북구'] },
]

// 🛡️ 전남 8 그룹 — 사용자 시안 (2026-05-17)
const JEONNAM_GROUPS: DistrictGroup[] = [
  { key: 'yeosu',      label: '여수',                                  keywords: ['여수'] },
  { key: 'suncheon',   label: '순천',                                  keywords: ['순천'] },
  { key: 'gwangyang',  label: '광양',                                  keywords: ['광양'] },
  { key: 'mokpo',      label: '목포',                                  keywords: ['목포'] },
  { key: 'muan',       label: '무안/영암/신안',                        keywords: ['무안', '영암', '신안'] },
  { key: 'naju',       label: '나주/함평/영광/장성',                   keywords: ['나주', '함평', '영광', '장성'] },
  { key: 'damyang',    label: '담양/곡성/화순/구례',                   keywords: ['담양', '곡성', '화순', '구례'] },
  { key: 'haenam',     label: '해남/완도/진도/강진/장흥/보성/고흥',     keywords: ['해남', '완도', '진도', '강진', '장흥', '보성', '고흥'] },
]

// 🛡️ 전북 6 그룹 — 사용자 시안 (2026-05-17)  (label: '전주/전북')
const JEONBUK_GROUPS: DistrictGroup[] = [
  { key: 'jeonju_dj', label: '전주 덕진구',                          keywords: ['전주 덕진구', '덕진구'] },
  { key: 'jeonju_ws', label: '전주 완산구/완주',                     keywords: ['전주 완산구', '완산구', '완주'] },
  { key: 'gunsan',    label: '군산',                                  keywords: ['군산'] },
  { key: 'iksan',     label: '익산',                                  keywords: ['익산'] },
  { key: 'namwon_jb', label: '남원/임실/순창/무주/진안/장수',         keywords: ['전북 남원', '임실', '순창', '무주', '진안', '전북 장수'] },
  { key: 'jeongeup',  label: '정읍/부안/김제/고창',                   keywords: ['정읍', '부안', '김제', '고창'] },
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
  { key: '부산',       label: '부산',       districtGroups: BUSAN_GROUPS },
  { key: '울산',       label: '울산',       districtGroups: ULSAN_GROUPS },
  { key: '경남',       label: '경남',       districtGroups: GYEONGNAM_GROUPS },
  { key: '대구',       label: '대구',       districtGroups: DAEGU_GROUPS },
  { key: '경북',       label: '경북',       districtGroups: GYEONGBUK_GROUPS },
  { key: '광주',       label: '광주',       districtGroups: GWANGJU_GROUPS },
  { key: '전남',       label: '전남',       districtGroups: JEONNAM_GROUPS },
  // 🛡️ 시안 우측 라벨 '전주/전북' 반영 (key 는 URL 안정성 위해 '전북' 유지)
  { key: '전북',       label: '전주/전북',  districtGroups: JEONBUK_GROUPS },
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
