/**
 * 📦 **픽업 정보 모델** — 픽업일 · 장소 · **보관구분** (세션 ④-a)
 *
 * 픽업 공구는 배송이 없다. 소비자가 **정해진 날 매장에 와서 받는다.**
 * 그래서 상세 화면에 **언제·어디서·어떻게 보관되는지**가 있어야 하고, 없으면 문의가 운영자에게 쏟아진다.
 *
 * ## 🔴 `storage` 는 나중에 **돈을 가른다**
 * 미수령(안 찾아감) 처리가 보관구분에 따라 갈린다 — **냉장/냉동은 환불 불가**(상품이 상한다),
 * **실온은 일정 기간 후 부분환불**. 그 분기는 **세션 ④-b(머니 경로)** 이고 여기선 **값만 저장**한다.
 *
 * ⇒ 그래서 이 파일이 하는 일은 **값 집합을 지금 고정**하는 것이다. ④-b 가 이 값을 읽어 분기하므로,
 *   나중에 문자열이 늘거나 표기가 흔들리면 **환불 판정이 흔들린다.**
 *   `'cold' | 'room'` 두 가지로 좁히고, 모르는 값은 **`null`**(=분기 불가 → ④-b 가 보수적으로 처리)로 떨군다.
 *
 * ## 컬럼을 안 쓴다
 * `products` 는 **컬럼 예산제**(CLAUDE.md — D1 100컬럼 한도)라 `product_supply_meta` K-V 를 쓴다.
 * `gb_*`(공구 세션)와 **같은 패턴**이다.
 */

/** 보관구분. **이 두 개가 전부다** — 늘리면 ④-b 환불 분기를 함께 고쳐야 한다. */
export type StorageKind = 'cold' | 'room'

export const STORAGE_LABEL: Record<StorageKind, string> = {
  cold: '냉장·냉동',
  room: '실온',
}

/**
 * 보관구분별 소비자 고지.
 * ⚠️ **법무 확인 대기 문구**(체크리스트 X4c — 미수령 청약철회 고지). 지금은 **임시 표기**이고,
 *   법무 회신이 오면 이 상수만 교체한다(화면은 이 값을 그대로 렌더).
 */
export const STORAGE_NOTICE: Record<StorageKind, string> = {
  cold: '냉장·냉동 상품입니다. 픽업일에 찾아가지 않으면 환불이 어려울 수 있습니다.',
  room: '실온 보관 상품입니다. 픽업일에 찾아가지 않으면 보관 기간 이후 처리 기준이 적용됩니다.',
}

export interface PickupInfo {
  /** 픽업 날짜(ISO). 없으면 아직 안 정한 것. */
  date: string | null
  /** 받는 곳. 매장명·주소 한 줄. */
  place: string | null
  /** 보관구분. **모르면 null** — 추측하지 않는다(④-b 가 보수적으로 처리). */
  storage: StorageKind | null
}

export const PICKUP_META_KEYS = {
  date: 'pickup_date',
  place: 'pickup_place',
  storage: 'pickup_storage',
} as const

const EMPTY: PickupInfo = { date: null, place: null, storage: null }

/** 아무것도 안 정해졌는가. 화면이 **픽업 블록 자체를 안 그릴지** 판단할 때 쓴다(빈 껍데기 금지). */
export function isEmptyPickup(p: PickupInfo | null | undefined): boolean {
  return !p || (!p.date && !p.place && !p.storage)
}

function toStorage(v: unknown): StorageKind | null {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'cold' || s === 'room' ? s : null
}

function toText(v: unknown, max: number): string | null {
  const s = String(v ?? '').trim().slice(0, max)
  return s || null
}

/** `product_supply_meta` 레코드 → `PickupInfo`. 없거나 모르는 값은 `null`. */
export function parsePickup(rec: Record<string, string> | undefined | null): PickupInfo {
  if (!rec) return { ...EMPTY }
  return {
    date: toText(rec[PICKUP_META_KEYS.date], 40),
    place: toText(rec[PICKUP_META_KEYS.place], 200),
    storage: toStorage(rec[PICKUP_META_KEYS.storage]),
  }
}

/** `PickupInfo` → 저장할 K-V. **null 은 빈 문자열**로 내려 기존 값을 지운다(off 청소와 같은 방침). */
export function pickupToMeta(p: PickupInfo): Record<string, string> {
  return {
    [PICKUP_META_KEYS.date]: p.date ?? '',
    [PICKUP_META_KEYS.place]: p.place ?? '',
    [PICKUP_META_KEYS.storage]: p.storage ?? '',
  }
}

/**
 * 입력 검증. **저장 전에** 부른다.
 *
 * 🔴 **픽업일이 공구 마감보다 빠르면 안 된다** — 아직 안 끝난 공구를 받으러 오라는 말이 된다.
 *   그래서 마감을 인자로 받는다(없으면 그 검사만 건너뛴다).
 */
export function validatePickup(p: PickupInfo, deadlineIso?: string | null): { ok: true } | { ok: false; error: string } {
  if (p.date) {
    const d = Date.parse(p.date)
    if (Number.isNaN(d)) return { ok: false, error: '픽업일 형식이 올바르지 않습니다' }
    if (deadlineIso) {
      const dl = Date.parse(deadlineIso)
      // 같은 날은 허용한다(마감 당일 픽업은 실제로 흔하다). **앞서는 것만** 막는다.
      if (!Number.isNaN(dl) && d < dl - 86400_000) {
        return { ok: false, error: '픽업일은 공구 마감일 이후여야 합니다' }
      }
    }
  }
  if (p.place && p.place.length > 200) return { ok: false, error: '픽업 장소는 200자 이하여야 합니다' }
  return { ok: true }
}
