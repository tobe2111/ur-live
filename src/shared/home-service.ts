/**
 * 🏠 생활 견적(숨고식) — 화면·서버가 함께 쓰는 규칙 한 곳 (2026-10-24 대표 확정)
 *
 * 결재: `docs/decisions/2026-10-24-home-service-quotes.md`.
 * 손님이 카테고리별 요청서를 올리면 → 그 카테고리·지역을 고른 사장님에게 알림톡 →
 * 사장님은 **참여권 1장**으로 견적을 보낸다(금액 선택) → 손님이 고르면 서로 연락처가 공개된다.
 *
 * 🔑 왜 한 곳인가: 요청서 칸·묶음 가격·선착순 인원이 화면과 서버에 두 벌이면, 화면이 받은 값을
 *   서버가 거절하거나(에러) 서버가 받은 값을 화면이 못 그리는(조용한 결함) 날이 온다.
 *
 * ⚠️ 생활 **이용권**(정찰가, `home_voucher`)과는 다른 흐름이다 — 이 모듈은 견적 쪽만 다룬다.
 *   한 사장님이 둘 다 한다(이용권은 수수료, 견적은 참여권).
 */

export type HomeServiceCategory =
  | 'store_pest' | 'kitchen_hood' | 'store_repair' | 'lodging_clean'
  | 'move' | 'move_in_clean' | 'aircon_clean'

/** 누구의 일인가 — 생활 페이지가 사장님(가게 관리)을 먼저, 집을 아래에 보여 준다(2026-10-25 대표). */
export type HomeServiceAudience = 'biz' | 'home'

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
  {
    key: 'store_pest',
    audience: 'biz',
    label: '방역·소독',
    blurb: '가게 크기와 원하는 주기만 알려 주면 근처 방역 업체가 견적을 보내 드려요',
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
    audience: 'biz',
    label: '주방 후드·덕트 청소',
    blurb: '후드 개수만 알려 주면 근처 청소 업체가 견적을 보내 드려요',
    voucherKeywords: ['후드', '덕트'],
    regionFields: ['address'],
    dateField: 'date',
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
    audience: 'biz',
    label: '가게 시설 수리',
    blurb: '고장 난 곳을 고르면 근처 수리 업체가 견적을 보내 드려요',
    voucherKeywords: ['수리', '간판', '설비'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '가게 주소', type: 'region', required: true, placeholder: STORE_HINT },
      { key: 'biz', label: '업종', type: 'select', required: true, options: BIZ_TYPES },
      { key: 'kind', label: '수리할 곳', type: 'select', required: true, options: ['전기', '배관·누수', '간판', '냉장·냉동 설비', '에어컨', '문·유리', '기타'] },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'time', label: '작업 시간', type: 'select', required: true, options: WORK_TIMES, optionHints: WORK_TIME_HINTS },
      { key: 'memo', label: '증상', type: 'textarea', required: false, placeholder: '어디가 어떻게 고장 났는지 적어 주세요' },
    ],
  },
  {
    key: 'lodging_clean',
    audience: 'biz',
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
] as const

export function categoryDef(key: unknown): CategoryDef | undefined {
  return HOME_SERVICE_CATEGORIES.find((c) => c.key === key)
}

/** 요청 하나에 견적을 보낼 수 있는 사장님 수(선착순). */
export const MAX_QUOTES_PER_REQUEST = 5
/** 사장님이 처음 등록하면 주는 무료 참여권. */
export const SIGNUP_FREE_CREDITS = 3
/** 손님이 이 시간 동안 견적을 한 번도 안 열어 보면 참여권을 돌려준다. */
export const UNVIEWED_REFUND_HOURS = 48
/** 한 요청에 알림을 보낼 사장님 상한(알림톡 비용). */
export const MAX_DISPATCH_PER_REQUEST = 30
/** 손님 한 명이 동시에 열어 둘 수 있는 요청 수(허위 요청 방지). */
export const MAX_OPEN_REQUESTS_PER_USER = 3

export interface CreditPackage { key: string; credits: number; price: number; label: string }

/** 기본 묶음(대표 확정). 어드민 `platform_settings.home_service_packages`(JSON 배열)로 덮어쓴다. */
export const DEFAULT_CREDIT_PACKAGES: readonly CreditPackage[] = [
  { key: 'p5', credits: 5, price: 5000, label: '5장' },
  { key: 'p10', credits: 10, price: 9000, label: '10장' },
  { key: 'p30', credits: 30, price: 24000, label: '30장' },
]

/** 어드민 값 파싱 — 형식이 틀리면 기본 묶음(조용히 0개가 되면 충전이 통째로 막힌다). */
export function parseCreditPackages(raw: unknown): CreditPackage[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(arr)) return [...DEFAULT_CREDIT_PACKAGES]
    const out: CreditPackage[] = []
    for (const p of arr) {
      const key = String(p?.key ?? '')
      const credits = Number(p?.credits)
      const price = Number(p?.price)
      if (!/^[a-z0-9]{1,10}$/.test(key)) continue
      if (!Number.isInteger(credits) || credits < 1 || credits > 1000) continue
      if (!Number.isInteger(price) || price < 100 || price > 1_000_000) continue
      out.push({ key, credits, price, label: String(p?.label || `${credits}장`).slice(0, 20) })
    }
    return out.length ? out : [...DEFAULT_CREDIT_PACKAGES]
  } catch {
    return [...DEFAULT_CREDIT_PACKAGES]
  }
}

/** 지역 칸 하나 — `region-slugs` 파서와 같은 규칙(시/도 + 시군구 필수). */
export interface ParsedRegion { sido: string; sigungu: string; text: string }

export interface ValidatedRequest {
  category: HomeServiceCategory
  details: Record<string, string>
  /** 🔒 고른 업체에만 보이는 값(상세 주소). 키는 지역 칸 키. */
  privateDetails: Record<string, string>
  regions: ParsedRegion[]
  desiredDate: string
}

/**
 * 요청서 검증. 지역 칸은 시/도와 시군구까지 읽혀야 한다(그래야 사장님을 찾는다).
 * `parseRegion` 은 호출부가 넘긴다 — 이 모듈이 지역 파서를 import 하면 화면 번들이 커진다.
 */
export function validateRequest(
  categoryKey: unknown,
  input: Record<string, unknown>,
  parseRegion: (s: string) => { sido: string; sigungu?: string } | null,
  todayYmd: string,
): { ok: true; value: ValidatedRequest } | { ok: false; error: string } {
  const def = categoryDef(categoryKey)
  if (!def) return { ok: false, error: '카테고리를 골라 주세요' }
  const details: Record<string, string> = {}
  const privateDetails: Record<string, string> = {}
  const regions: ParsedRegion[] = []
  for (const f of def.fields) {
    const raw = input?.[f.key]
    const v = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim()
    if (!v) {
      if (f.required) return { ok: false, error: `${f.label}을(를) 입력해 주세요` }
      continue
    }
    if (v.length > (f.type === 'textarea' ? 500 : 60)) return { ok: false, error: `${f.label}이(가) 너무 깁니다` }
    if (f.type === 'select' && f.options && !f.options.includes(v)) return { ok: false, error: `${f.label}을(를) 다시 골라 주세요` }
    if (f.type === 'multi') {
      const picked = [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean))]
      if (f.options && picked.some((x) => !f.options!.includes(x))) return { ok: false, error: `${f.label}을(를) 다시 골라 주세요` }
      if (picked.length) details[f.key] = picked.join(', ')
      continue
    }
    if (f.type === 'number') {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0 || n > 1000) return { ok: false, error: `${f.label}을(를) 숫자로 입력해 주세요` }
    }
    if (f.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `${f.label}을(를) 골라 주세요` }
      if (v < todayYmd) return { ok: false, error: `${f.label}은(는) 오늘 이후여야 합니다` }
    }
    if (f.type === 'region') {
      const r = parseRegion(v)
      if (!r || !r.sigungu) return { ok: false, error: `${f.label}을(를) "서울 강남구 역삼동" 처럼 시·구까지 적어 주세요` }
      // 🔒 동까지만 남긴다 — 사장님은 고르기 전엔 이 글만 본다(번지·호수가 섞여 와도 잘라 낸다).
      const short = v.split(/\s+/).slice(0, 3).join(' ')
      if (def.regionFields.includes(f.key)) regions.push({ sido: r.sido, sigungu: r.sigungu, text: short })
      details[f.key] = short
      const full = String(input?.[f.key + PRIVATE_ADDRESS_SUFFIX] ?? '').trim()
      if (full) {
        if (full.length > PRIVATE_ADDRESS_MAX) return { ok: false, error: `${f.label} 상세 주소가 너무 깁니다` }
        privateDetails[f.key] = full
      }
      continue
    }
    details[f.key] = v
  }
  const desiredDate = details[def.dateField]
  if (!desiredDate) return { ok: false, error: '날짜를 골라 주세요' }
  return { ok: true, value: { category: def.key, details, privateDetails, regions, desiredDate } }
}

/** 사장님이 보는 요청 요약 한 줄 — 연락처·상세 주소 없이. 알림톡 본문과 요청함이 같은 글을 쓴다. */
export function requestSummary(category: HomeServiceCategory, d: Record<string, string>): string {
  if (category === 'move') return `${d.from || '-'} → ${d.to || '-'} · ${d.size || '-'} · ${d.kind || '-'}`
  if (category === 'move_in_clean') return `${d.address || '-'} · ${d.pyeong || '-'}평 · ${d.kind || '-'}`
  if (category === 'aircon_clean') return `${d.address || '-'} · ${d.type || '-'} ${d.count || '-'}대`
  if (category === 'store_pest') return `${d.address || '-'} · ${d.biz || '-'} ${d.pyeong || '-'}평 · ${d.cycle || '-'}`
  if (category === 'kitchen_hood') return `${d.address || '-'} · ${d.biz || '-'} 후드 ${d.count || '-'}개 · ${d.scope || '-'}`
  if (category === 'store_repair') return `${d.address || '-'} · ${d.biz || '-'} · ${d.kind || '-'}`
  return `${d.address || '-'} · ${d.lodging || '-'} ${d.rooms || '-'}실 · ${d.service || '-'} · ${d.cycle || '-'}`
}

/**
 * 손 없는 날 — 음력 날짜가 9·10·19·20·29·30 인 날(이사 달력에 점으로 표시).
 * 음력은 브라우저 내장 달력(`dangi` = 한국 음력)으로 계산한다. 지원 안 하는 환경이면 표시만 안 한다.
 */
let _dangi: Intl.DateTimeFormat | null | undefined
export function isSonEomneunDay(ymd: string): boolean {
  if (_dangi === undefined) {
    try { _dangi = new Intl.DateTimeFormat('en-u-ca-dangi', { day: 'numeric', timeZone: 'Asia/Seoul' }) } catch { _dangi = null }
  }
  if (!_dangi || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  const part = _dangi.formatToParts(new Date(Date.UTC(y, m - 1, d, 3))).find((p) => p.type === 'day')
  const day = Number(part?.value)
  return [9, 10, 19, 20, 29, 30].includes(day)
}

// ── 알림톡 본문 (카카오에 등록한 본문과 글자 하나까지 같아야 나간다 — `docs/alimtalk-register-list.md`) ──
//   조건부 줄 금지(값이 없으면 '-'). 버튼은 `lib/alimtalk-buttons.ts` 표.

export const HOME_TPL = {
  requestNew: 'home_request_new',
  quoteArrived: 'home_quote_arrived',
  quoteChosen: 'home_quote_chosen',
} as const

export function msgRequestNew(categoryLabel: string, summary: string, date: string): string {
  const message = `[유어딜] 새 ${categoryLabel || '-'} 요청

${summary || '-'}
희망 날짜: ${date || '-'}

먼저 견적을 보낸 ${MAX_QUOTES_PER_REQUEST}명까지만 참여할 수 있습니다.
아래 [요청 보기]에서 확인해 주세요.`
  return message
}

export function msgQuoteArrived(proName: string, categoryLabel: string, priceText: string): string {
  const message = `[유어딜] ${proName || '-'}에서 견적을 보냈습니다

${categoryLabel || '-'} 요청 · ${priceText || '-'}

받은 견적을 비교하고 마음에 드는 곳을 골라 주세요.
고르기 전에는 연락처가 공개되지 않습니다.`
  return message
}

export function msgQuoteChosen(categoryLabel: string, summary: string, customerName: string, customerPhone: string): string {
  const message = `[유어딜] 손님이 견적을 선택했습니다

${categoryLabel || '-'} 요청 · ${summary || '-'}
손님: ${customerName || '-'} ${customerPhone || '-'}

손님에게 직접 연락해 일정과 금액을 확정해 주세요.`
  return message
}

/** 견적 금액 표시 — 비워 두면 방문 후 견적. */
export function quotePriceText(price: number | null | undefined): string {
  const n = Number(price)
  return Number.isFinite(n) && n > 0 ? `${Math.round(n).toLocaleString('ko-KR')}원` : '방문 후 견적'
}
