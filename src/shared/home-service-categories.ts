/**
 * 🏠 생활 견적 — 카테고리와 요청서 칸 정의(2026-10-25 분리 — `home-service.ts` 가 600줄을 넘어서).
 * 규칙·검증·알림 문구는 `home-service.ts`. 이 파일은 **무엇을 묻는가**만 담는다.
 */

export type HomeServiceCategory =
  | 'store_pest' | 'kitchen_hood' | 'store_repair' | 'store_fridge' | 'store_aircon' | 'store_clean'
  | 'store_drain' | 'signage' | 'store_interior'
  | 'lodging_clean' | 'lodging_pool'
  | 'move' | 'move_in_clean' | 'aircon_clean' | 'home_grout' | 'home_pest' | 'home_interior'

/**
 * 어디의 일인가 — 생활 페이지가 가게 → 숙소 → 집 순서로 보여 준다(2026-10-25 대표 "일단 다 하자").
 * 묶음은 업체 업종이 아니라 **사장님이 고르는 말**로 나눈다.
 */
export type HomeServiceAudience = 'store' | 'lodging' | 'home'

/** `multi` 는 여러 개를 고르는 칸(쉼표로 이어 저장). 비워 둬도 되는 칸에만 쓴다. */
export type FieldType = 'region' | 'text' | 'date' | 'select' | 'number' | 'textarea' | 'multi'

export interface RequestField {
  key: string
  label: string
  type: FieldType
  required: boolean
  options?: readonly string[]
  placeholder?: string
  /** number 칸 단위(평·대) */
  unit?: string
  /** 선택지 아래 한 줄 설명(오늘의집처럼 카드로 고르게 한다) */
  optionHints?: Readonly<Record<string, string>>
}

/**
 * 🔒 지역 칸의 **상세 주소**(도로명·동·호수)는 `<키>_full` 로 따로 받는다.
 * 사장님은 고르기 전엔 동까지만 보고, **손님이 고른 한 곳만** 이 값을 본다(연락처와 같은 규칙).
 */
export const PRIVATE_ADDRESS_SUFFIX = '_full'
export const PRIVATE_ADDRESS_MAX = 120

export interface CategoryDef {
  key: HomeServiceCategory
  label: string
  /** 한 줄 설명(생활 페이지 카드) */
  blurb: string
  /** 같은 일을 정찰가로 파는 이용권을 찾을 때 이름에 들어가는 낱말 */
  voucherKeywords: readonly string[]
  fields: readonly RequestField[]
  /**
   * 사장님에게 보낼 지역 칸. 이사는 출발지와 도착지 **둘 다** 본다
   * (출발지 사장님도 도착지 사장님도 그 일을 할 수 있다).
   */
  regionFields: readonly string[]
  /** 이 칸의 날짜가 지나면 요청이 만료된다 */
  dateField: string
  audience: HomeServiceAudience
  /** 달력에 손 없는 날을 표시(이사) */
  luckyDays?: boolean
  /** 신청을 마친 뒤 "같이 하실래요?" — carry 는 {다음 카테고리 칸: 이번 칸} */
  crossSell?: { to: HomeServiceCategory; title: string; carry: Readonly<Record<string, string>> }
}

const REGION_HINT = '예) 서울 강남구 역삼동 (동까지만)'

const BIZ_TYPES = ['식당', '카페', '숙소', '기타 매장'] as const
const WORK_TIMES = ['영업 전', '영업 끝난 뒤', '쉬는 날', '상관없음'] as const
const WORK_TIME_HINTS = { '영업 전': '오픈 전 아침', '영업 끝난 뒤': '마감 후 밤', '쉬는 날': '정기 휴무일', '상관없음': '업체와 맞춰 정해요' } as const
const STORE_HINT = '가게 주소를 검색해 주세요'

export const HOME_SERVICE_CATEGORIES: readonly CategoryDef[] = [
  // ── 사장님 가게 관리 (2026-10-25 대표 "식당, 숙소 등을 타겟으로") ──
  /**
   * 🪧 간판 — 2026-10-25 대표 "간판은 특히 잘 해야해. 이미 제휴사가 있거든".
   * 간판 견적은 **가게마다 값이 크게 달라** 업체가 첫 통화에서 묻는 것을 요청서가 미리 받는다
   * (일의 종류 · 간판 종류 · 크기 · 다는 곳 · 디자인 · 옥외광고물 신고 · 예산).
   * 제휴 업체는 어드민 `home_service_partners` 로 지정하고, 지역과 무관하게 이 요청을 받는다.
   */
  {
    key: 'signage',
    audience: 'store',
    label: '간판 제작·교체',
    blurb: '새로 달기·교체·수리·철거까지. 크기와 예산을 고르면 간판 업체가 견적을 보내 드려요',
    voucherKeywords: ['간판'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'work', label: '어떤 일인가요', type: 'select', required: true, options: ['새로 달기', '교체', '수리', '철거만'],
        optionHints: { '새로 달기': '새 가게·지금 간판 없음', '교체': '지금 간판을 떼고 새로', '수리': '불이 안 들어옴·글자가 떨어짐', '철거만': '폐업·이전으로 떼기만' } },
      { key: 'kind', label: '간판 종류', type: 'select', required: true,
        options: ['채널(입체 글자)', '갈바·플렉스(판 간판)', '돌출 간판', '어닝·천막', 'LED·네온', '실내 사인·메뉴판', '잘 모르겠어요'],
        optionHints: {
          '채널(입체 글자)': '글자 하나하나가 튀어나온 간판',
          '갈바·플렉스(판 간판)': '넓은 판에 글자를 넣은 간판',
          '돌출 간판': '벽에서 옆으로 튀어나온 작은 간판',
          '어닝·천막': '입구 위 차양',
          'LED·네온': '빛나는 글자·로고',
          '실내 사인·메뉴판': '가게 안 표지·메뉴판',
          '잘 모르겠어요': '업체가 보고 추천해요',
        } },
      { key: 'size', label: '간판 가로 길이', type: 'select', required: true, options: ['2m 이하', '2~5m', '5~10m', '10m 이상', '잘 모르겠어요'] },
      { key: 'spot', label: '다는 곳', type: 'select', required: true, options: ['1층 정면', '2층 이상 정면', '건물 옆면', '옥상', '가게 안'] },
      { key: 'design', label: '디자인', type: 'select', required: true, options: ['시안부터 필요해요', '파일이 있어요', '지금 간판과 같게'],
        optionHints: { '시안부터 필요해요': '로고·글꼴을 업체가 잡아 줘요', '파일이 있어요': '로고·디자인 파일 보유', '지금 간판과 같게': '수리·교체만' } },
      { key: 'permit', label: '옥외광고물 신고', type: 'select', required: true, options: ['대신 해 주세요', '직접 할게요', '잘 모르겠어요'],
        optionHints: { '대신 해 주세요': '구청 신고·허가를 업체가 대행', '직접 할게요': '서류는 내가 처리', '잘 모르겠어요': '필요한지 업체가 알려 줘요' } },
      { key: 'budget', label: '생각하는 예산', type: 'select', required: true,
        options: ['100만 원 이하', '100~300만 원', '300~500만 원', '500만 원 이상', '상담 후 정할게요'] },
      { key: 'date', label: '희망 설치 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '가게 이름, 원하는 느낌. 사진은 업체와 연결된 뒤 보내면 돼요' },
    ],
  },
  /**
   * 🏗️ 가게 인테리어 — 2026-10-25 대표 "인테리어도 일단 넣어줘".
   * 금액이 커서 분쟁이 나기 쉽다 → 업체가 첫 통화에서 묻는 것(일·평수·범위·도면·예산·착공일)을 미리 받고,
   * 새로 여는 가게는 간판을 함께 권한다.
   */
  {
    key: 'store_interior',
    audience: 'store',
    label: '가게 인테리어',
    blurb: '새로 여는 가게 공사부터 부분 리모델링·원상복구까지. 평수와 예산을 고르면 인테리어 업체가 견적을 보내 드려요',
    voucherKeywords: ['인테리어', '리모델링'],
    regionFields: ['address'],
    dateField: 'date',
    crossSell: { to: 'signage', title: '새 간판도 함께 받아 보시겠어요?', carry: { address: 'address', biz: 'biz', date: 'date' } },
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'work', label: '어떤 공사인가요', type: 'select', required: true, options: ['새로 여는 가게', '부분 리모델링', '철거·원상복구'],
        optionHints: { '새로 여는 가게': '빈 상가를 처음부터', '부분 리모델링': '영업 중인 가게 일부만', '철거·원상복구': '폐업·이전으로 비우기' } },
      { key: 'pyeong', label: '가게 평수', type: 'number', required: true, unit: '평' },
      { key: 'scope', label: '공사할 곳', type: 'multi', required: false, options: ['바닥', '벽·천장', '조명·전기', '주방 설비', '화장실', '카운터·가구', '외관·출입문'] },
      { key: 'design', label: '디자인', type: 'select', required: true, options: ['디자인부터 필요해요', '도면·시안이 있어요', '업체와 상의할게요'] },
      { key: 'budget', label: '생각하는 예산', type: 'select', required: true, options: ['1천만 원 이하', '1천~3천만 원', '3천~5천만 원', '5천만 원~1억', '1억 이상', '상담 후 정할게요'] },
      { key: 'date', label: '착공 희망일', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '오픈 목표일, 원하는 분위기. 사진·도면은 업체와 연결된 뒤 보내면 돼요' },
    ],
  },
  {
    key: 'store_pest',
    audience: 'store',
    label: '방역·소독',
    blurb: '식당·카페·숙소 크기와 원하는 주기만 알려 주면 근처 방역 업체가 견적을 보내 드려요',
    voucherKeywords: ['방역', '소독'],
    regionFields: ['address'],
    dateField: 'date',
    crossSell: { to: 'kitchen_hood', title: '주방 후드·덕트 청소도 함께 받아 보시겠어요?', carry: { address: 'address', biz: 'biz', date: 'date' } },
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'pyeong', label: '가게 평수', type: 'number', required: true, unit: '평' },
      { key: 'cycle', label: '주기', type: 'select', required: true, options: ['한 번만', '매월 정기', '분기 정기'],
        optionHints: { '한 번만': '지금 한 번 해결', '매월 정기': '한 달에 한 번 관리', '분기 정기': '석 달에 한 번 관리' } },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '본 벌레(바퀴·쥐·날파리), 보건증 서류 필요 여부' },
    ],
  },
  {
    key: 'kitchen_hood',
    audience: 'store',
    label: '주방 후드·덕트 청소',
    blurb: '후드 개수만 알려 주면 근처 청소 업체가 견적을 보내 드려요',
    voucherKeywords: ['후드', '덕트'],
    regionFields: ['address'],
    dateField: 'date',
    crossSell: { to: 'store_drain', title: '주방 배수구·그리스트랩 청소도 함께 받아 보시겠어요?', carry: { address: 'address', biz: 'biz', date: 'date' } },
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'count', label: '후드 개수', type: 'number', required: true, unit: '개' },
      { key: 'scope', label: '청소 범위', type: 'select', required: true, options: ['후드만', '후드 + 덕트', '잘 모르겠어요'],
        optionHints: { '후드만': '눈에 보이는 후드와 필터', '후드 + 덕트': '천장 속 배기 통로까지', '잘 모르겠어요': '업체가 보고 정해요' } },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '마지막 청소 시기, 기름 떨어짐 여부' },
    ],
  },
  {
    key: 'store_repair',
    audience: 'store',
    label: '가게 시설 수리',
    blurb: '고장 난 곳을 고르면 근처 수리 업체가 견적을 보내 드려요',
    voucherKeywords: ['수리', '설비'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'kind', label: '수리할 곳', type: 'select', required: true, options: ['전기', '배관·누수', '문·유리·셔터', '타일·바닥', '기타'] },
      // 간판·냉장 설비·에어컨은 따로 뺐다(2026-10-25) — 업체가 다르고, 섞이면 그 업체에게 요청이 안 간다.
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '증상', type: 'textarea', required: false, placeholder: '어디가 어떻게 고장 났는지 적어 주세요' },
    ],
  },
  {
    key: 'store_fridge',
    audience: 'store',
    label: '냉장·냉동 설비 수리',
    blurb: '고장 나면 그날 장사가 멈춰요. 설비와 증상을 고르면 근처 업체가 바로 견적을 보내 드려요',
    voucherKeywords: ['냉장', '냉동', '쇼케이스'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'equip', label: '고장 난 설비', type: 'select', required: true,
        options: ['업소용 냉장고', '쇼케이스', '냉동고', '제빙기', '저온 창고', '기타'] },
      { key: 'symptom', label: '증상', type: 'select', required: true,
        options: ['안 차가워요', '물이 새요', '소리가 커요', '전원이 안 들어와요', '기타'] },
      { key: 'urgency', label: '얼마나 급한가요', type: 'select', required: true, options: ['오늘 바로', '2~3일 안', '날짜 맞춰서'],
        optionHints: { '오늘 바로': '지금 장사에 지장이 있어요', '2~3일 안': '버틸 수는 있어요', '날짜 맞춰서': '점검·교체 상담' } },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '제조사·모델명, 언제부터 그랬는지' },
    ],
  },
  {
    key: 'store_aircon',
    audience: 'store',
    label: '가게 에어컨 청소·수리',
    blurb: '대수와 종류를 적으면 근처 업체가 견적을 보내 드려요. 천장형(시스템)도 돼요',
    voucherKeywords: ['에어컨'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'service', label: '맡길 일', type: 'select', required: true, options: ['청소', '수리', '설치·이전'],
        optionHints: { '청소': '냄새·곰팡이·필터', '수리': '안 시원함·물 샘·에러', '설치·이전': '새로 달기·옮겨 달기' } },
      { key: 'type', label: '종류', type: 'select', required: true, options: ['벽걸이', '스탠드', '시스템(천장형)', '섞여 있음'] },
      { key: 'count', label: '대수', type: 'number', required: true, unit: '대' },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '모델명, 에러 코드, 실외기 위치' },
    ],
  },
  {
    key: 'store_clean',
    audience: 'store',
    label: '매장 정기 청소',
    blurb: '평수와 주기만 알려 주면 근처 청소 업체가 견적을 보내 드려요',
    voucherKeywords: ['매장 청소', '정기 청소'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'pyeong', label: '가게 평수', type: 'number', required: true, unit: '평' },
      { key: 'cycle', label: '주기', type: 'select', required: true, options: ['한 번만', '매일', '매주', '매월'],
        optionHints: { '한 번만': '오픈·대청소', '매일': '마감 후 매일', '매주': '일주일에 한 번', '매월': '한 달에 한 번' } },
      { key: 'scope', label: '청소할 곳', type: 'multi', required: false, options: ['홀', '주방', '화장실', '유리창', '바닥 왁스'] },
      { key: 'date', label: '시작 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '열쇠 보관 방법, 특히 신경 쓸 곳' },
    ],
  },
  {
    key: 'store_drain',
    audience: 'store',
    label: '배수구·정화조 청소',
    blurb: '주방 배수구 막힘부터 그리스트랩·정화조까지 근처 업체가 견적을 보내 드려요',
    voucherKeywords: ['배수구', '정화조', '그리스트랩'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'kind', label: '맡길 일', type: 'select', required: true,
        options: ['주방 배수구 막힘', '그리스트랩 청소', '정화조 청소', '화장실 막힘'],
        optionHints: { '그리스트랩 청소': '주방 기름 걸러 내는 통', '정화조 청소': '건물 정화조 정기 청소' } },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '물이 빠지는 정도, 마지막 청소 시기' },
    ],
  },
  {
    key: 'lodging_clean',
    audience: 'lodging',
    label: '숙소 청소·침구',
    blurb: '객실 수와 주기만 알려 주면 근처 업체가 견적을 보내 드려요',
    voucherKeywords: ['객실', '린넨', '침구'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '숙소 주소', type: 'region', required: true, placeholder: '숙소 주소를 검색해 주세요' },
      { key: 'lodging', label: '숙소 종류', type: 'select', required: true, options: ['펜션', '게스트하우스', '모텔·호텔', '풀빌라', '기타'] },
      { key: 'rooms', label: '객실 수', type: 'number', required: true, unit: '실' },
      { key: 'service', label: '맡길 일', type: 'select', required: true, options: ['객실 청소', '침구·린넨 세탁', '둘 다'] },
      { key: 'cycle', label: '주기', type: 'select', required: true, options: ['한 번만', '매일', '매주', '매월'] },
      { key: 'date', label: '시작 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '체크아웃·체크인 시간, 세탁물 수거 여부' },
    ],
  },
  {
    key: 'lodging_pool',
    audience: 'lodging',
    label: '수영장·온수 설비 관리',
    blurb: '풀빌라·펜션 수영장 청소와 보일러·온수 점검을 근처 업체가 견적 내 드려요',
    voucherKeywords: ['수영장', '보일러', '스파'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '숙소 주소', type: 'region', required: true, placeholder: '숙소 주소를 검색해 주세요' },
      { key: 'lodging', label: '숙소 종류', type: 'select', required: true, options: ['펜션', '풀빌라', '모텔·호텔', '기타'] },
      { key: 'kind', label: '맡길 일', type: 'select', required: true, options: ['수영장 청소·수질 관리', '온수·보일러 점검', '스파·자쿠지 관리'] },
      { key: 'cycle', label: '주기', type: 'select', required: true, options: ['한 번만', '매주', '매월', '성수기 동안'] },
      { key: 'date', label: '시작 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '수영장 개수·크기, 실내·실외' },
    ],
  },
  // ── 집 ──
  {
    key: 'move',
    audience: 'home',
    label: '이사',
    blurb: '출발지·도착지만 적으면 근처 이사 업체가 견적을 보내 드려요',
    voucherKeywords: ['이사'],
    regionFields: ['from', 'to'],
    dateField: 'date',
    luckyDays: true,
    crossSell: { to: 'move_in_clean', title: '가시는 곳의 입주청소도 함께 받아 보시겠어요?', carry: { address: 'to', date: 'date' } },
    fields: [
      { key: 'date', label: '이사 날짜', type: 'date', required: true },
      { key: 'size', label: '집 크기', type: 'select', required: true, options: ['원룸', '투룸', '쓰리룸 이상', '사무실'],
        optionHints: { '원룸': '1인 가구·간단한 이사', '투룸': '2인 가구', '쓰리룸 이상': '가족 이사', '사무실': '책상·집기 이전' } },
      { key: 'kind', label: '이사 방식', type: 'select', required: true, options: ['포장이사', '반포장이사', '일반이사', '용달'],
        optionHints: { '포장이사': '짐 싸기부터 정리까지 모두 업체가', '반포장이사': '짐은 내가 싸고 운반·배치는 업체가', '일반이사': '운반만 업체가', '용달': '작은 짐 몇 개만' } },
      { key: 'from', label: '출발지', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'to', label: '도착지', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'elevator', label: '엘리베이터', type: 'select', required: true, options: ['둘 다 있음', '출발지만 있음', '도착지만 있음', '둘 다 없음'] },
      { key: 'items', label: '옮길 큰 짐', type: 'multi', required: false, placeholder: '예) 냉장고, 세탁기',
        options: ['냉장고', '김치냉장고', '세탁기', '건조기', 'TV', '에어컨', '침대', '소파', '장롱', '책상', '피아노', '안마의자'] },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '큰 짐(피아노·냉장고 등), 주차 여부' },
    ],
  },
  {
    key: 'move_in_clean',
    audience: 'home',
    label: '입주청소',
    blurb: '평수와 날짜만 적으면 근처 청소 업체가 견적을 보내 드려요',
    voucherKeywords: ['입주청소', '입주 청소', '이사청소'],
    regionFields: ['address'],
    dateField: 'date',
    crossSell: { to: 'home_grout', title: '욕실 줄눈·탄성 시공도 함께 받아 보시겠어요?', carry: { address: 'address', date: 'date' } },
    fields: [
      { key: 'address', label: '청소할 곳', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'pyeong', label: '평수', type: 'number', required: true, unit: '평' },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'kind', label: '집 상태', type: 'select', required: true, options: ['신축 입주', '이사 나가는 집', '거주 중'],
        optionHints: { '신축 입주': '새 아파트·공사 먼지', '이사 나가는 집': '짐 뺀 뒤 빈 집', '거주 중': '짐이 있는 채로' } },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '베란다 수, 특히 신경 쓸 곳' },
    ],
  },
  {
    key: 'aircon_clean',
    audience: 'home',
    label: '에어컨 청소',
    blurb: '대수와 종류를 적으면 근처 업체가 견적을 보내 드려요',
    voucherKeywords: ['에어컨'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '방문할 곳', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'count', label: '대수', type: 'number', required: true, unit: '대' },
      { key: 'type', label: '종류', type: 'select', required: true, options: ['벽걸이', '스탠드', '2in1', '시스템(천장형)'] },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '모델명, 고장 증상' },
    ],
  },
  {
    key: 'home_interior',
    audience: 'home',
    label: '집 인테리어·리모델링',
    blurb: '전체 리모델링부터 욕실·주방만까지. 평수와 범위를 고르면 인테리어 업체가 견적을 보내 드려요',
    voucherKeywords: ['인테리어', '리모델링'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '공사할 곳', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'housing', label: '집 종류', type: 'select', required: true, options: ['아파트', '빌라·주택', '오피스텔'] },
      { key: 'pyeong', label: '평수', type: 'number', required: true, unit: '평' },
      { key: 'scope', label: '범위', type: 'select', required: true, options: ['전체 리모델링', '욕실', '주방', '도배·바닥', '기타 부분'],
        optionHints: { '전체 리모델링': '집 전체를 새로', '도배·바닥': '벽지·장판·마루' } },
      { key: 'living', label: '공사 중 거주', type: 'select', required: true, options: ['빈 집이에요', '살면서 공사해요'] },
      { key: 'budget', label: '생각하는 예산', type: 'select', required: true, options: ['1천만 원 이하', '1천~3천만 원', '3천~5천만 원', '5천만 원~1억', '1억 이상', '상담 후 정할게요'] },
      { key: 'date', label: '착공 희망일', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '입주·이사 날짜, 원하는 분위기' },
    ],
  },
  {
    key: 'home_grout',
    audience: 'home',
    label: '줄눈·탄성 시공',
    blurb: '입주 전 욕실·현관 줄눈과 베란다 탄성 코트를 근처 업체가 견적 내 드려요',
    voucherKeywords: ['줄눈', '탄성'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '시공할 곳', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'kind', label: '맡길 일', type: 'select', required: true, options: ['줄눈', '탄성 코트', '둘 다'],
        optionHints: { '줄눈': '타일 사이 틈을 메워 곰팡이 방지', '탄성 코트': '베란다 벽·바닥 결로·곰팡이 방지' } },
      { key: 'scope', label: '범위', type: 'select', required: true, options: ['욕실만', '욕실 + 현관', '욕실·현관·베란다 전체'] },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '욕실 개수, 신축 여부' },
    ],
  },
  {
    key: 'home_pest',
    audience: 'home',
    label: '집 해충 방역',
    blurb: '바퀴·개미·쥐, 본 벌레를 고르면 근처 방역 업체가 견적을 보내 드려요',
    voucherKeywords: ['방역', '해충'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '방문할 곳', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'pest', label: '본 벌레', type: 'select', required: true, options: ['바퀴벌레', '개미', '쥐', '날파리·초파리', '기타'] },
      { key: 'housing', label: '집 종류', type: 'select', required: true, options: ['아파트', '빌라·주택', '원룸·오피스텔'] },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '평수, 반려동물·아이 여부' },
    ],
  },
] as const

export function categoryDef(key: unknown): CategoryDef | undefined {
  return HOME_SERVICE_CATEGORIES.find((c) => c.key === key)
}
