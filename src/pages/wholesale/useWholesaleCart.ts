// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통스타트 도매몰 — 다품목 장바구니 (localStorage 스토어).
//   주문 API(/api/wholesale/orders)가 items[] 배열을 받으므로 카트→단일 주문으로 매핑.
//   유통사별 분리 키(seller_token 해시 불필요 — origin+token 로컬이라 단순 키 사용).
// ──────────────────────────────────────────────────────────────
import { useSyncExternalStore, useCallback } from 'react'

export interface WCartItem {
  id: number
  qty: number
  // 표시용 스냅샷 (담을 때 저장 — 카트 페이지가 추가 fetch 없이 렌더)
  name?: string
  image_url?: string | null
  price?: number // 담을 당시 등급 공급가
  moq?: number   // 최소 주문 수량 (스텝퍼 단위/하한)
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

/** 비훅 컨텍스트(이벤트 핸들러 등)에서 담기. */
export function addToWholesaleCart(item: WCartItem) {
  const cur = read()
  const ex = cur.find((x) => x.id === item.id)
  const qty = Math.max(1, Math.floor(item.qty || 1))
  if (ex) write(cur.map((x) => (x.id === item.id ? { ...x, ...item, qty: x.qty + qty } : x)))
  else write([...cur, { ...item, qty }])
}
