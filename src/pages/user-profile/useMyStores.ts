/**
 * 🪑 마이 판매 섹션의 데이터 한 줄 — 좌석 + 오늘 숫자 (2026-09-25, 설계 §14 단계 1)
 *
 * ## 왜 `/my-stores/summary` 인가 (§15-2)
 * 좌석을 판정하는 길이 둘이었다:
 *   - `POST /switch-to-seller` — `sellers.linked_user_id = 내 user_id` **한 행만**. 그 컬럼은 UNIQUE(1인 1행).
 *   - `GET /my-stores[/summary]` — `canOperateStore` = 소유(link) **∪** 위임(`seller_operators`).
 * 그런데 `POST /store/new` 는 설계상 `linked_user_id` 를 **비우고** 권한을 `seller_operators` 로만 준다.
 * ⇒ 앞의 길은 그렇게 만들어진 좌석을 **한 개도 못 본다**(라이브에 9개 있다).
 *   **새 판매 화면의 좌석 출처는 이 훅 하나다.** `switch-to-seller` 는 옛 단일 좌석 호환 경로로만 남긴다.
 *
 * ## 세대(generation)를 구독한다 (§15-3)
 * 가게를 바꾸면 토큰이 통째로 바뀐다. 그 순간 이 훅이 들고 있던 숫자는 **옛 가게 것**이므로 다시 부른다.
 *
 * ⚠️ 소비자 세션만으로 200 이 온다(서버 `resolveActorUserId` 가 쿠키를 먼저 읽는다).
 *   좌석이 없으면 빈 목록이지 에러가 아니다 — 그래서 셀러가 아닌 사람에게는 조용히 아무것도 안 그린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { onSeatChange, seatGeneration } from '@/lib/seller-seat'

export interface StoreSummaryRow {
  seller_id: number
  name: string
  role: 'owner' | 'operator'
  /** 'active' | 'approved' | 'pending' | 'rejected' — 당근 모델 배너가 읽는다 */
  status: string | null
  today_revenue: number
  today_orders: number
  pending: number
}

export interface MyStoresState {
  stores: StoreSummaryRow[]
  totals: { today_revenue: number; today_orders: number; pending: number }
  /** 지금 토큰이 앉아 있는 좌석(서버가 Authorization 으로 판정한 값). 없으면 null */
  currentSellerId: number | null
  loading: boolean
  /** 불러오기 실패 — 0 으로 위장하지 않는다(빈 화면 ≠ 실패) */
  failed: boolean
  /** 이 데이터가 실려 온 좌석 세대. 지금 세대와 다르면 옛 가게 것이다 */
  generation: number
  refetch: () => void
}

const EMPTY_TOTALS = { today_revenue: 0, today_orders: 0, pending: 0 }

export function useMyStores(): MyStoresState {
  const [stores, setStores] = useState<StoreSummaryRow[]>([])
  const [totals, setTotals] = useState(EMPTY_TOTALS)
  const [currentSellerId, setCurrentSellerId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [generation, setGeneration] = useState(() => seatGeneration())
  const alive = useRef(true)

  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(() => {
    const gen = seatGeneration()
    setLoading(true)
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/my-stores/summary'))
      .then((r) => {
        if (!alive.current) return
        const d = r.data?.data
        if (!r.data?.success || !d) { setFailed(true); return }
        setStores(Array.isArray(d.stores) ? d.stores : [])
        setTotals(d.totals || EMPTY_TOTALS)
        const cur = Number(d.current_seller_id)
        setCurrentSellerId(Number.isFinite(cur) && cur > 0 ? cur : null)
        setFailed(false)
        setGeneration(gen)
      })
      .catch(() => { if (alive.current) setFailed(true) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  // 🪑 좌석이 바뀌면 지금 들고 있는 숫자는 옛 가게 것이다 — 버리고 다시 부른다.
  useEffect(() => onSeatChange(() => load()), [load])

  return { stores, totals, currentSellerId, loading, failed, generation, refetch: load }
}
