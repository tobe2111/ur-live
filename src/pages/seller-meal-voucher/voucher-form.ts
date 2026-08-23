/**
 * 🎟️ 이용권 등록 위저드 — 폼 타입 + 임시저장 SSOT (2026-08-23 대표 승인 리뉴얼)
 *   대표 요구 4가지: ①카카오맵 검색 자동입력 ②등록 매장 자동 상속 ③다매장 선택 ④임시저장.
 *
 * 임시저장은 localStorage 드래프트다 — 서버 왕복 없이 작성 중 이탈을 견딘다.
 *   키는 브라우저당 1개(매장 전환을 견뎌야 하므로 seller_id 로 나누지 않는다 — 매장 선택 자체가
 *   드래프트의 일부다). 제출 성공 시 삭제. 파싱 실패는 조용히 무시(드래프트가 페이지를 깨면 안 된다).
 */

export type VoucherCategory =
  | 'meal_voucher' | 'beauty_voucher' | 'health_voucher'
  | 'pet_voucher' | 'stay_voucher' | 'activity_voucher'

export interface VoucherForm {
  name: string
  description: string
  price: number
  original_price: number
  image_url: string
  category: VoucherCategory
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
  restaurant_lat: string
  restaurant_lng: string
  /** 🗓️ 2026-08-22 대표 정책: 미설정('') = 무기한(expires_at NULL). 프리셋 강제 금지. */
  voucher_expiry: string
  voucher_terms: string
  group_buy_deadline: string
  store_verify_pin: string
  stock: number
  max_per_person: number
  promo_pct: number
  kakao_place_url: string
  external_booking_url: string
  region_si: string
  region_gu: string
}

/** 판매 마감 기본값: 7일 후 (기존 UX 유지 — 2026-05-21). */
export function defaultDeadline(): string {
  return new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16)
}

export function emptyVoucherForm(): VoucherForm {
  return {
    name: '', description: '', price: 0, original_price: 0, image_url: '',
    category: 'meal_voucher',
    restaurant_name: '', restaurant_address: '', restaurant_phone: '',
    restaurant_lat: '', restaurant_lng: '',
    voucher_expiry: '', voucher_terms: '',
    group_buy_deadline: defaultDeadline(),
    store_verify_pin: '', stock: 100, max_per_person: 0, promo_pct: 0,
    kakao_place_url: '', external_booking_url: '', region_si: '', region_gu: '',
  }
}

/** 매장 프리필 서버 응답 (GET /api/seller/stores/context). */
export interface StoreContext {
  name: string; address: string; phone: string
  lat: string; lng: string
  kakao_place_url: string; verify_pin: string; category: string
}

/** 프리필 적용 — 매장 관련 필드만 덮어쓴다(작성 중인 이용권 내용은 보존). */
export function applyStoreContext(f: VoucherForm, s: StoreContext): VoucherForm {
  return {
    ...f,
    restaurant_name: s.name || f.restaurant_name,
    restaurant_address: s.address || f.restaurant_address,
    restaurant_phone: s.phone || f.restaurant_phone,
    restaurant_lat: s.lat || f.restaurant_lat,
    restaurant_lng: s.lng || f.restaurant_lng,
    kakao_place_url: s.kakao_place_url || f.kakao_place_url,
    store_verify_pin: s.verify_pin || f.store_verify_pin,
  }
}

// ── 임시저장 ──────────────────────────────────────────────────────────────
const DRAFT_KEY = 'ur_voucher_draft_v1'

export interface VoucherDraft { form: VoucherForm; savedAt: number; sellerId: number }

/** 저장할 가치가 있는 드래프트인가 — 빈 폼을 저장해 복원 배너로 소음 내지 않는다. */
export function isDraftWorthSaving(f: VoucherForm): boolean {
  return !!(f.name || f.restaurant_name || f.description || f.price > 0 || f.image_url)
}

export function loadVoucherDraft(): VoucherDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as VoucherDraft
    if (!d || typeof d !== 'object' || !d.form || typeof d.form !== 'object') return null
    // 스키마가 자란 뒤의 옛 드래프트도 안전하게 — 빈 폼 위에 얹는다.
    return { form: { ...emptyVoucherForm(), ...d.form }, savedAt: Number(d.savedAt) || 0, sellerId: Number(d.sellerId) || 0 }
  } catch { return null }
}

export function saveVoucherDraft(form: VoucherForm, sellerId: number): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, savedAt: Date.now(), sellerId } satisfies VoucherDraft))
  } catch { /* 저장 실패(용량 등)가 작성을 막으면 안 된다 */ }
}

export function clearVoucherDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
}

/**
 * 로컬(localStorage) vs 서버 드래프트 중 **더 최근 것**을 고른다 — 기기 간 이어쓰기의 심장.
 *   둘 다 있으면 저장 시각(ms) 비교, 한쪽만 있으면 그쪽. 저장할 가치 없는(빈) 드래프트는 무시.
 *   ⚠️ 서버 updated_ms 는 서버가 epoch(ms) 로 내려준다 — 클라에서 DB 문자열을 Date 파싱하지
 *   않기 위한 계약(check-utc-date-parse 클래스 차단).
 */
export function pickNewerDraft(local: VoucherDraft | null, server: VoucherDraft | null): VoucherDraft | null {
  const l = local && isDraftWorthSaving(local.form) ? local : null
  const s = server && isDraftWorthSaving(server.form) ? server : null
  if (!l) return s
  if (!s) return l
  return s.savedAt > l.savedAt ? s : l
}
