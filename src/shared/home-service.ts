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

export type HomeServiceCategory = 'move' | 'move_in_clean' | 'aircon_clean'

export type FieldType = 'region' | 'text' | 'date' | 'select' | 'number' | 'textarea'

export interface RequestField {
  key: string
  label: string
  type: FieldType
  required: boolean
  options?: readonly string[]
  placeholder?: string
  /** number 칸 단위(평·대) */
  unit?: string
}

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
}

const REGION_HINT = '예) 서울 강남구 역삼동 (동까지만)'

export const HOME_SERVICE_CATEGORIES: readonly CategoryDef[] = [
  {
    key: 'move',
    label: '이사',
    blurb: '출발지·도착지만 적으면 근처 이사 업체가 견적을 보내 드려요',
    voucherKeywords: ['이사'],
    regionFields: ['from', 'to'],
    dateField: 'date',
    fields: [
      { key: 'from', label: '출발지', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'to', label: '도착지', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'date', label: '이사 날짜', type: 'date', required: true },
      { key: 'size', label: '집 크기', type: 'select', required: true, options: ['원룸', '투룸', '쓰리룸 이상', '사무실'] },
      { key: 'kind', label: '이사 방식', type: 'select', required: true, options: ['포장이사', '반포장이사', '일반이사', '용달'] },
      { key: 'elevator', label: '엘리베이터', type: 'select', required: true, options: ['둘 다 있음', '출발지만 있음', '도착지만 있음', '둘 다 없음'] },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '큰 짐(피아노·냉장고 등), 주차 여부' },
    ],
  },
  {
    key: 'move_in_clean',
    label: '입주청소',
    blurb: '평수와 날짜만 적으면 근처 청소 업체가 견적을 보내 드려요',
    voucherKeywords: ['입주청소', '입주 청소', '이사청소'],
    regionFields: ['address'],
    dateField: 'date',
    fields: [
      { key: 'address', label: '청소할 곳', type: 'region', required: true, placeholder: REGION_HINT },
      { key: 'pyeong', label: '평수', type: 'number', required: true, unit: '평' },
      { key: 'date', label: '희망 날짜', type: 'date', required: true },
      { key: 'kind', label: '집 상태', type: 'select', required: true, options: ['신축 입주', '이사 나가는 집', '거주 중'] },
      { key: 'memo', label: '추가로 알릴 것', type: 'textarea', required: false, placeholder: '베란다 수, 특히 신경 쓸 곳' },
    ],
  },
  {
    key: 'aircon_clean',
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
      continue
    }
    details[f.key] = v
  }
  const desiredDate = details[def.dateField]
  if (!desiredDate) return { ok: false, error: '날짜를 골라 주세요' }
  return { ok: true, value: { category: def.key, details, regions, desiredDate } }
}

/** 사장님이 보는 요청 요약 한 줄 — 연락처·상세 주소 없이. 알림톡 본문과 요청함이 같은 글을 쓴다. */
export function requestSummary(category: HomeServiceCategory, d: Record<string, string>): string {
  if (category === 'move') return `${d.from || '-'} → ${d.to || '-'} · ${d.size || '-'} · ${d.kind || '-'}`
  if (category === 'move_in_clean') return `${d.address || '-'} · ${d.pyeong || '-'}평 · ${d.kind || '-'}`
  return `${d.address || '-'} · ${d.type || '-'} ${d.count || '-'}대`
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
