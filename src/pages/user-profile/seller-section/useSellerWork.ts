/**
 * 🧰 마이 안 판매 작업 — 데이터 + 쓰기 (2026-09-25, 설계 §14 단계 2)
 *
 * ## 좌석이 맞을 때만 부른다
 * 이 훅이 쓰는 엔드포인트는 전부 **좌석 토큰의 `seller_id` 로 자동 스코프**된다. 그래서 화면이
 * 고른 가게와 토큰이 다르면 **부르지도 보내지도 않는다** — 그 상태에서 부르면 조용히 남의 가게
 * 숫자를 그리게 된다(에러가 안 난다. 이 레포가 반복해 당한 클래스다).
 *
 * ## 🔴 모든 쓰기 앞에 `assertSeat` (설계 §15-3 규칙 ②)
 * 가게 전환은 토큰을 통째로 바꾼다. 목록을 펼쳐 둔 채 가게를 바꾸면 화면에는 **옛 가게의 행**이
 * 남아 있다. 그 행의 버튼을 누르면 새 토큰으로 옛 주문 번호를 보내게 되므로, 보내기 직전에
 * "내가 들고 있던 가게 == 지금 토큰의 가게" 를 확인하고 **다르면 보내지 않고 다시 부른다.**
 *
 * ## 낙관적 갱신을 하지 않는다
 * 확인·토글은 서버가 **상태 기계**(`statusesThatCanReach`)로 거절할 수 있다. 미리 지워 놓으면
 * 거절된 주문이 화면에서 사라진 채로 남는다 — 사장님은 처리했다고 믿는다. 응답을 받고 바꾼다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { assertSeat, currentSeatId, onSeatChange, SeatMismatchError } from '@/lib/seller-seat'
import { parseUTCDate } from '@/utils/date'

/** 결제는 끝났고 사장님이 아직 "확인" 을 안 누른 상태. `seller-orders/statusHelpers.nextStatusOf` 와 같은 집합. */
export const AWAITING_CONFIRM = new Set(['PAID', 'DONE', 'PAY_COMPLETE'])

export interface WorkOrder {
  id: number
  orderNumber: string
  /** 상품 한 줄 요약 — 라인이 여럿이면 "첫 상품 외 N" */
  title: string
  buyer: string
  amount: number
  /** KST "09:12" */
  at: string
  status: string
}

export interface WorkProduct {
  id: number
  name: string
  price: number
  isActive: boolean
  /** 판매 수(참여 수) */
  sold: number
}

interface Raw { [k: string]: unknown }

function hhmmKST(iso: unknown): string {
  const d = parseUTCDate(typeof iso === 'string' ? iso : null)
  if (Number.isNaN(d.getTime())) return ''
  const k = new Date(d.getTime() + 9 * 3600_000)
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`
}

function titleOf(o: Raw): string {
  const items = Array.isArray(o.items) ? (o.items as Raw[]) : []
  const first = items[0]
  const name = first && typeof first.product_name === 'string' ? first.product_name : ''
  if (!name) return '주문'
  return items.length > 1 ? `${name} 외 ${items.length - 1}` : name
}

export interface SellerWorkState {
  orders: WorkOrder[]
  products: WorkProduct[]
  loading: boolean
  failed: boolean
  /** 지금 처리 중인 주문번호 · 상품 id (버튼 잠금용) */
  busyOrder: string | null
  busyProduct: number | null
  confirmOrder: (o: WorkOrder) => Promise<boolean>
  toggleProduct: (p: WorkProduct) => Promise<boolean>
  refetch: () => void
}

/**
 * @param sellerId 화면이 고른 가게. **이 값이 지금 토큰의 좌석과 같을 때만** 일한다.
 * @param enabled  사람이 펼쳤는가. 접혀 있으면 요청 0.
 * @param onSeatLost 좌석이 어긋나 요청을 보내지 않았을 때 — 화면이 안내하고 다시 불러야 한다.
 */
export function useSellerWork(sellerId: number, enabled: boolean, onSeatLost?: () => void): SellerWorkState {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [products, setProducts] = useState<WorkProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busyOrder, setBusyOrder] = useState<string | null>(null)
  const [busyProduct, setBusyProduct] = useState<number | null>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(() => {
    // 🪑 좌석이 안 맞으면 **부르지 않는다** — 부르면 남의 가게 숫자를 그린다.
    if (!enabled || currentSeatId() !== sellerId) { setOrders([]); setProducts([]); return }
    setLoading(true)
    import('@/lib/api').then(async ({ default: api }) => {
      const [oRes, pRes] = await Promise.all([
        api.get('/api/seller/orders?limit=50&sort=desc').catch(() => null),
        api.get('/api/seller/products').catch(() => null),
      ])
      if (!alive.current) return
      if (!oRes?.data?.success && !pRes?.data?.success) { setFailed(true); return }
      const oList = (oRes?.data?.success ? oRes.data.data || [] : []) as Raw[]
      setOrders(oList
        .filter((o) => AWAITING_CONFIRM.has(String(o.status)))
        .map((o) => ({
          id: Number(o.id),
          orderNumber: String(o.order_number ?? ''),
          title: titleOf(o),
          buyer: String(o.shipping_name || o.user_name || '고객'),
          amount: Number(o.total_amount) || 0,
          at: hhmmKST(o.created_at),
          status: String(o.status),
        })))
      const pList = (pRes?.data?.success ? pRes.data.data || [] : []) as Raw[]
      setProducts(pList
        .filter((p) => String(p.status ?? '') !== 'DELETED')
        .map((p) => ({
          id: Number(p.id),
          name: String(p.name ?? ''),
          price: Number(p.price) || 0,
          isActive: p.is_active === undefined ? true : !!Number(p.is_active),
          sold: Number(p.group_buy_current) || 0,
        }))
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.sold - a.sold))
      setFailed(false)
    }).catch(() => { if (alive.current) setFailed(true) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [sellerId, enabled])

  useEffect(() => { load() }, [load])
  // 🪑 가게가 바뀌면 지금 목록은 옛 가게 것이다 — 버리고 다시 판단한다(좌석이 안 맞으면 비운다).
  useEffect(() => onSeatChange(() => load()), [load])

  /** 쓰기 공통 — 보내기 직전 좌석 확인, 어긋나면 **보내지 않고** 다시 부른다. */
  const guarded = useCallback(async (run: () => Promise<boolean>): Promise<boolean> => {
    try {
      assertSeat(sellerId)
    } catch (e) {
      if (e instanceof SeatMismatchError) { onSeatLost?.(); load(); return false }
      throw e
    }
    return run()
  }, [sellerId, load, onSeatLost])

  const confirmOrder = useCallback(async (o: WorkOrder) => guarded(async () => {
    setBusyOrder(o.orderNumber)
    try {
      const { default: api } = await import('@/lib/api')
      const r = await api.put(`/api/seller/orders/${encodeURIComponent(o.orderNumber)}/status`, { status: 'PREPARING' })
      if (!r.data?.success) return false
      if (alive.current) setOrders((list) => list.filter((x) => x.orderNumber !== o.orderNumber))
      return true
    } catch { return false } finally { if (alive.current) setBusyOrder(null) }
  }), [guarded])

  const toggleProduct = useCallback(async (p: WorkProduct) => guarded(async () => {
    setBusyProduct(p.id)
    const next = !p.isActive
    try {
      const { default: api } = await import('@/lib/api')
      const r = await api.put(`/api/seller/products/${p.id}`, { is_active: next, status: next ? 'ACTIVE' : 'HIDDEN' })
      if (!r.data?.success) return false
      if (alive.current) setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, isActive: next } : x)))
      return true
    } catch { return false } finally { if (alive.current) setBusyProduct(null) }
  }), [guarded])

  return { orders, products, loading, failed, busyOrder, busyProduct, confirmOrder, toggleProduct, refetch: load }
}
