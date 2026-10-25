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

export * from './home-service-categories'
import { MAX_REQUEST_PHOTOS, PRIVATE_ADDRESS_MAX, PRIVATE_ADDRESS_SUFFIX, categoryDef, type HomeServiceCategory } from './home-service-categories'

/** 요청 하나에 견적을 보낼 수 있는 사장님 수(선착순). */
export const MAX_QUOTES_PER_REQUEST = 5
/** 사장님이 처음 등록하면 주는 무료 참여권. */
export const SIGNUP_FREE_CREDITS = 3

/**
 * 🚪 견적을 받고 보낼 수 있는 매장 상태 — 2026-10-25 대표 *"1번은 해줘"*(심사 중인 업체도 견적).
 * 생활 업체는 **심사 중(pending)도 연다** — 업체 모집이 먼저다. 막는 것은 정지·반려뿐이다.
 * 대신 손님은 견적 카드에서 `사업자 인증` 표시로 심사를 마친 업체를 구분한다(`proVerified`).
 * 🔴 이용권 판매는 이 규칙과 무관하다 — 메인 노출은 여전히 승인된 매장만(`approvedSellerProductSql`).
 * 🔴 제휴 업체 지정은 여전히 판매 승인 매장만(어드민 라우트) — 무료로 자리를 주는 일이라 더 엄격하다.
 */
export const PRO_OPEN_STATUSES = ['pending', 'approved', 'active'] as const
export const PRO_OPEN_STATUS_SQL = `('pending', 'approved', 'active')`
export function proStatusOpen(status: unknown): boolean {
  return (PRO_OPEN_STATUSES as readonly string[]).includes(String(status))
}
/** 사업자 심사를 마친 업체 — 손님 견적 카드의 `사업자 인증` 표시. */
export function proVerified(status: unknown): boolean {
  return status === 'approved' || status === 'active'
}
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
    if (f.type === 'photos') {
      const urls = [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean))]
      if (urls.length > MAX_REQUEST_PHOTOS) return { ok: false, error: `사진은 ${MAX_REQUEST_PHOTOS}장까지 올릴 수 있어요` }
      if (urls.some((u) => !isRequestPhotoUrl(u))) return { ok: false, error: '사진을 다시 올려 주세요' }
      if (urls.length) details[f.key] = urls.join(',')
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

/**
 * 우리 업로드 주소인가 — `/api/upload/image` 가 돌려주는 두 모양(같은 출처 `/api/media/uploads/...` 또는
 * R2 공개 도메인 `https://.../uploads/...`)만. 남의 주소를 끼워 넣어 업체 화면에 띄우지 못하게 한다.
 * 누가 올렸는지는 서버 라우트가 `uploads/user/<본인>/` 으로 따로 본다.
 */
export function isRequestPhotoUrl(u: string): boolean {
  return /^(?:\/api\/media\/|https:\/\/[a-z0-9.-]+\/)uploads\/user\/\d+\/\d{4}-\d{2}\/[A-Za-z0-9_-]+\.(?:jpg|png|webp|gif)$/.test(u) && u.length <= 200
}

/** 사진이 전부 이 사람이 올린 것인가(`uploads/user/<id>/`). */
export function photosOwnedBy(details: Record<string, string>, userId: number): boolean {
  for (const [k, v] of Object.entries(details)) {
    if (k !== 'photos' || !v) continue
    if (v.split(',').some((u) => !u.includes(`/uploads/user/${userId}/`))) return false
  }
  return true
}

/**
 * 🎟️ 카테고리별 참여권 장수(2026-10-25 — 결재 `docs/decisions/2026-10-25-home-service-credit-cost.md`).
 * 기본은 모두 1장. 어드민이 `home_service_credit_cost`(JSON {카테고리: 장수})로 정한다 — **대표 결재 전엔 아무 값도 넣지 않는다**.
 */
export const CREDIT_COST_KEY = 'home_service_credit_cost'
export const MAX_CREDIT_COST = 20

export function parseCreditCosts(raw: unknown): Partial<Record<HomeServiceCategory, number>> {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    const out: Partial<Record<HomeServiceCategory, number>> = {}
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const n = Number(v)
      if (categoryDef(k) && Number.isInteger(n) && n >= 1 && n <= MAX_CREDIT_COST) out[k as HomeServiceCategory] = n
    }
    return out
  } catch { return {} }
}

export function creditCostFor(category: HomeServiceCategory, costs: Partial<Record<HomeServiceCategory, number>>): number {
  return costs[category] ?? 1
}

/** 사장님이 보는 요청 요약 한 줄 — 연락처·상세 주소 없이. 알림톡 본문과 요청함이 같은 글을 쓴다. */
export function requestSummary(category: HomeServiceCategory, d: Record<string, string>): string {
  const a = d.address || '-'
  switch (category) {
    case 'move': return `${d.from || '-'} → ${d.to || '-'} · ${d.size || '-'} · ${d.kind || '-'}`
    case 'move_in_clean': return `${a} · ${d.pyeong || '-'}평 · ${d.kind || '-'}`
    case 'aircon_clean': return `${a} · ${d.type || '-'} ${d.count || '-'}대`
    case 'store_pest': return `${a} · ${d.biz || '-'} ${d.pyeong || '-'}평 · ${d.cycle || '-'}`
    case 'kitchen_hood': return `${a} · ${d.biz || '-'} 후드 ${d.count || '-'}개 · ${d.scope || '-'}`
    case 'store_repair': return `${a} · ${d.biz || '-'} · ${d.kind || '-'}`
    case 'store_fridge': return `${a} · ${d.equip || '-'} · ${d.symptom || '-'} · ${d.urgency || '-'}`
    case 'store_aircon': return `${a} · ${d.type || '-'} ${d.count || '-'}대 · ${d.service || '-'}`
    case 'store_clean': return `${a} · ${d.biz || '-'} ${d.pyeong || '-'}평 · ${d.cycle || '-'}`
    case 'store_drain': return `${a} · ${d.biz || '-'} · ${d.kind || '-'}`
    case 'store_interior': return `${a} · ${d.biz || '-'} ${d.pyeong || '-'}평 · ${d.work || '-'} · 예산 ${d.budget || '-'}`
    case 'home_interior': return `${a} · ${d.housing || '-'} ${d.pyeong || '-'}평 · ${d.scope || '-'} · 예산 ${d.budget || '-'}`
    case 'signage': return `${a} · ${d.kind || '-'} ${d.work || '-'} · 가로 ${d.size || '-'} · 예산 ${d.budget || '-'}`
    case 'lodging_clean': return `${a} · ${d.lodging || '-'} ${d.rooms || '-'}실 · ${d.service || '-'} · ${d.cycle || '-'}`
    case 'lodging_pool': return `${a} · ${d.lodging || '-'} · ${d.kind || '-'} · ${d.cycle || '-'}`
    case 'home_grout': return `${a} · ${d.kind || '-'} · ${d.scope || '-'}`
    case 'home_pest': return `${a} · ${d.housing || '-'} · ${d.pest || '-'}`
  }
}

/**
 * 🤝 제휴 업체(2026-10-25 대표 — 간판 제휴사). 카테고리 → 매장 번호(`sellers.id`).
 * 제휴 업체는 그 카테고리 요청을 **지역과 무관하게** 받고, 견적을 낼 때 참여권을 쓰지 않는다
 * (2026-10-24 승인된 "유어딜 직영(또는 협력 업체)" 견적과 같은 규칙 — 손님 화면엔 "유어딜 제휴").
 */
export const HOME_PARTNERS_KEY = 'home_service_partners'

export function parsePartners(raw: unknown): Partial<Record<HomeServiceCategory, number>> {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    const out: Partial<Record<HomeServiceCategory, number>> = {}
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const n = Number(v)
      if (categoryDef(k) && Number.isInteger(n) && n > 0) out[k as HomeServiceCategory] = n
    }
    return out
  } catch { return {} }
}

/** 이 매장이 제휴 업체로 지정된 카테고리들(쉼표로 이어서 — SQL 의 `instr` 비교용). */
export function partnerCategoriesCsv(partners: Partial<Record<HomeServiceCategory, number>>, sellerId: number): string {
  return Object.entries(partners).filter(([, v]) => v === sellerId).map(([k]) => k).join(',')
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
