// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통스타트 도매몰 — 다품목 장바구니 (localStorage 스토어).
//   주문 API(/api/wholesale/orders)가 items[] 배열을 받으므로 카트→단일 주문으로 매핑.
//   판매사별 분리 키(seller_token 해시 불필요 — origin+token 로컬이라 단순 키 사용).
// ──────────────────────────────────────────────────────────────
import { useSyncExternalStore, useCallback } from 'react'

// 🚚 제조사별 배송/주문 정책 스냅샷(비식별 — group key + 정책 숫자). 서버가 청구 시 재계산(SSOT) — 표시용.
export interface WCartSupplierPolicy {
  min_order_amount?: number    // 최소 주문 금액(0=제한 없음)
  shipping_fee?: number        // 배송비(0=무료/미설정)
  free_ship_threshold?: number // 무료배송 기준액(0=무료배송 없음)
}

export interface WCartItem {
  id: number
  qty: number
  // 표시용 스냅샷 (담을 때 저장 — 카트 페이지가 추가 fetch 없이 렌더)
  name?: string
  image_url?: string | null
  price?: number // 담을 당시 등급 공급가
  moq?: number   // 최소 주문 수량 (스텝퍼 단위/하한)
  order_multiple?: number // 🏭 2026-07-01 주문 배수(박스 단위) — 결제 시 서버 ORDER_MULTIPLE_VIOLATION 사전 차단용
  // 🚚 제조사별 그룹 표시용(비식별 group key s{id}) + 정책. 카트/체크아웃이 제조사별 최소주문금액/배송비 계산.
  supplier_group?: string | null
  supplier_policy?: WCartSupplierPolicy | null
}

const KEY = 'ut_wholesale_cart_v1'
const listeners = new Set<() => void>()
let cache: WCartItem[] | null = null

function read(): WCartItem[] {
  if (cache) return cache
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as WCartItem[]) : []
  } catch { cache = [] }
  return cache!
}

function write(next: WCartItem[]) {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota — ignore */ }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; cb() } }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => { listeners.delete(cb); if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage) }
}

const EMPTY: WCartItem[] = []
function getSnapshot(): WCartItem[] { return typeof window === 'undefined' ? EMPTY : read() }

/** 도매 장바구니 훅 — 전역 단일 스토어 구독. */
export function useWholesaleCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)

  const add = useCallback((item: WCartItem) => {
    const cur = read()
    const ex = cur.find((x) => x.id === item.id)
    const qty = Math.max(1, Math.floor(item.qty || 1))
    if (ex) write(cur.map((x) => (x.id === item.id ? { ...x, ...item, qty: x.qty + qty } : x)))
    else write([...cur, { ...item, qty }])
  }, [])

  const setQty = useCallback((id: number, qty: number) => {
    const q = Math.max(1, Math.floor(qty || 1))
    write(read().map((x) => (x.id === id ? { ...x, qty: q } : x)))
  }, [])

  const remove = useCallback((id: number) => write(read().filter((x) => x.id !== id)), [])
  const clear = useCallback(() => write([]), [])

  const count = items.length
  const totalQty = items.reduce((s, x) => s + x.qty, 0)
  const subtotal = items.reduce((s, x) => s + (x.price || 0) * x.qty, 0)

  return { items, add, setQty, remove, clear, count, totalQty, subtotal }
}

// ── 🚚 제조사별 그룹 계산 — 카트/체크아웃 공용(표시용. 서버가 청구 시 재계산 = SSOT) ──────
export interface WSupplierGroup {
  group: string                 // 비식별 group key (s{id} | 'none')
  items: WCartItem[]
  subtotal: number              // 이 제조사 라인 합
  minOrderAmount: number        // 최소 주문 금액(0=제한 없음)
  meetsMin: boolean             // 최소주문금액 충족 여부
  shortfall: number             // 부족액(미충족 시 양수)
  shipping: number              // 이 제조사 배송비(무료배송 적용 후)
  freeShipThreshold: number     // 무료배송 기준(0=없음)
  freeShipRemaining: number     // 무료배송까지 남은 금액(0=이미 무료 또는 무료배송 없음)
}

/** 카트 아이템 배열 → 제조사별 그룹 + 배송비 합계 + 최소주문 충족 여부. (NaN-safe) */
export function groupBySupplier(items: WCartItem[]): {
  groups: WSupplierGroup[]
  shippingTotal: number
  subtotal: number
  grandTotal: number
  allMinMet: boolean
} {
  const byKey = new Map<string, WCartItem[]>()
  for (const it of items) {
    const key = it.supplier_group || 'none'
    const arr = byKey.get(key) || []
    arr.push(it)
    byKey.set(key, arr)
  }
  const groups: WSupplierGroup[] = []
  let shippingTotal = 0
  let subtotal = 0
  let allMinMet = true
  for (const [group, arr] of byKey) {
    const sub = arr.reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 0), 0)
    const pol = arr.find((x) => x.supplier_policy)?.supplier_policy || {}
    const minOrderAmount = Math.max(0, Math.floor(Number(pol.min_order_amount) || 0))
    const shippingFee = Math.max(0, Math.floor(Number(pol.shipping_fee) || 0))
    const freeShipThreshold = Math.max(0, Math.floor(Number(pol.free_ship_threshold) || 0))
    const meetsMin = !(minOrderAmount > 0 && sub < minOrderAmount)
    const shortfall = meetsMin ? 0 : Math.max(0, minOrderAmount - sub)
    const shipping = (freeShipThreshold > 0 && sub >= freeShipThreshold) ? 0 : shippingFee
    const freeShipRemaining = (freeShipThreshold > 0 && sub < freeShipThreshold) ? Math.max(0, freeShipThreshold - sub) : 0
    subtotal += sub
    shippingTotal += shipping
    if (!meetsMin) allMinMet = false
    groups.push({ group, items: arr, subtotal: sub, minOrderAmount, meetsMin, shortfall, shipping, freeShipThreshold, freeShipRemaining })
  }
  return { groups, shippingTotal, subtotal, grandTotal: subtotal + shippingTotal, allMinMet }
}

/** 비훅 컨텍스트(이벤트 핸들러 등)에서 담기. */
export function addToWholesaleCart(item: WCartItem) {
  const cur = read()
  const ex = cur.find((x) => x.id === item.id)
  const qty = Math.max(1, Math.floor(item.qty || 1))
  if (ex) write(cur.map((x) => (x.id === item.id ? { ...x, ...item, qty: x.qty + qty } : x)))
  else write([...cur, { ...item, qty }])
}
