/**
 * 🎟️ 이용권 등록 위저드 — 폼 타입 + 임시저장 SSOT (2026-08-23 대표 승인 리뉴얼)
 *   대표 요구 4가지: ①카카오맵 검색 자동입력 ②등록 매장 자동 상속 ③다매장 선택 ④임시저장.
 *
 * 임시저장은 localStorage 드래프트다 — 서버 왕복 없이 작성 중 이탈을 견딘다.
 *   키는 브라우저당 1개(매장 전환을 견뎌야 하므로 seller_id 로 나누지 않는다 — 매장 선택 자체가
 *   드래프트의 일부다). 제출 성공 시 삭제. 파싱 실패는 조용히 무시(드래프트가 페이지를 깨면 안 된다).
 */

import { utcToKstInput } from '@/utils/date'
import type { VoucherCategory as PlatformVoucherCategory } from '@/shared/constants/voucher-categories'

/**
 * 🗂️ 이용권 카테고리 — **플랫폼 SSOT 를 그대로 쓴다**(`shared/constants/voucher-categories`).
 *
 * ⚠️ 2026-09-02 정정: 여기서 6종을 따로 선언하고 있었다(health/pet/activity 포함). 그 셋은
 *   2026-05-17 에 4종으로 통합되며 **레거시**가 됐고, 서버가 저장 직전 `canonicalCategory` 로
 *   접어 넣는다(health→미용 · pet/activity→기타). 즉 셀러가 "헬스 이용권" 을 고르면 화면은
 *   헬스라고 해 놓고 **실제로는 미용으로 등록**됐다 — 아무 에러 없이 고른 것과 다른 게 저장된다.
 *   (서버의 그 정규화 자체는 옳다. 2026-08-22 에 **피드에 아예 안 뜨던 것**을 그렇게 고쳤다.
 *    남은 문제는 화면이 없는 선택지를 계속 내밀고 있었다는 것이다.)
 * ⇒ 목록을 따로 갖지 않는다. SSOT 가 늘거나 줄면 여기가 자동으로 따라간다.
 */
export type VoucherCategory = PlatformVoucherCategory

export interface VoucherForm {
  name: string
  description: string
  price: number
  original_price: number
  image_url: string
  /**
   * 🖼️ 2026-09-03 (대표 *"이용권에 사진 여러 장 올릴 수 있어야하는데"*): 사진 전체 목록.
   * **`images[0]` 이 대표**이고 `image_url` 은 그것의 미러다 — 소비자 카드·검색·OG 가 그 컬럼을
   * 읽으므로 둘을 함께 쓴다(어긋나면 화면마다 다른 사진이 뜬다). 상한은 `PHOTO_MAX`.
   */
  images: string[]
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

/**
 * 판매 마감 기본값: 7일 후 (기존 UX 유지 — 2026-05-21).
 *
 * ⚠️ 2026-09-02 정정: `toISOString()` 은 **UTC** 라 `datetime-local` 칸에 그대로 넣으면 셀러에게
 *   9시간 이른 시각으로 보였다(같은 칸을 사람이 고치면 KST 벽시계가 들어와 **한 칸에 두 규약**이
 *   섞였다). 화면은 언제나 KST 벽시계 — 저장 직전 `kstInputToUTC` 가 한 번만 UTC 로 바꾼다.
 */
export function defaultDeadline(): string {
  return utcToKstInput(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString())
}

export function emptyVoucherForm(): VoucherForm {
  return {
    name: '', description: '', price: 0, original_price: 0, image_url: '', images: [],
    category: 'meal_voucher',
    restaurant_name: '', restaurant_address: '', restaurant_phone: '',
    restaurant_lat: '', restaurant_lng: '',
    voucher_expiry: '', voucher_terms: '',
    group_buy_deadline: defaultDeadline(),
    store_verify_pin: '', stock: 100, max_per_person: 0, promo_pct: 0,
    kakao_place_url: '', external_booking_url: '', region_si: '', region_gu: '',
  }
}

/**
 * 🖼️ **옛 데이터를 새 모델로 접어 넣는다** (2026-09-03 `images` 신설).
 *
 * `images` 가 생기기 전의 드래프트·기존 상품은 사진이 `image_url` **한 칸에만** 있다. 그대로 두면
 * 편집기가 "사진 0장"으로 보이고, 그 상태에서 한 번만 손대면 **원래 있던 대표 사진이 사라진다.**
 * 그래서 목록이 비어 있고 대표가 있으면 대표를 첫 장으로 세운다(반대 방향은 손대지 않는다).
 */
export function withPhotos<T extends { image_url: string; images: string[] }>(form: T): T {
  if (form.images?.length) return form
  return { ...form, images: form.image_url ? [form.image_url] : [] }
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
    return { form: withPhotos({ ...emptyVoucherForm(), ...d.form }), savedAt: Number(d.savedAt) || 0, sellerId: Number(d.sellerId) || 0 }
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
