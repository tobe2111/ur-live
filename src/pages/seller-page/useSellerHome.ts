/**
 * 🏠 **셀러 홈 데이터** — M2 시안이 그리는 숫자 전부를 한 훅이 만든다 (2026-09-14).
 *   시안: `docs/design/seller-dashboard-mobile-first-2026-09.md` (홈 = M2 · PC = 그것을 2열로).
 *
 * 무엇을 어디서 가져오나(전부 기존 엔드포인트 — 서버 추가 0):
 *   - 오늘 매출·주문 · 최근 30일 일별 매출  ← `GET /api/seller/dashboard/stats` (`today_revenue`·`today_orders`·`daily_revenue`)
 *   - 처리 대기 주문                       ← `GET /api/seller/orders` 결제됐는데 아직 확인 안 한 것(PAID/DONE)
 *   - 정산 가능                            ← `GET /api/seller/deal-balance` `withdrawable`(정산 화면의 환급 가능 잔액과 같은 값)
 *   - 내 이용권                            ← `GET /api/seller/products` 중 이용권 카테고리
 *
 * 🩸 **종전 홈이 읽던 필드는 서버에 없었다.** 옛 `SellerPage` 는 `d.summary.total_sales`·`d.daily`·`d.topProducts` 를
 *   읽었는데 `/dashboard/stats` 는 `today_revenue`·`daily_revenue` 를 준다(2026-04-28 TD-006 분할 때 갈렸다).
 *   그래서 숫자 네 장이 **언제나 0** 이었고 차트는 한 번도 안 그려졌다 — 에러가 없어 아무도 몰랐다.
 *   이 훅은 서버가 실제로 주는 이름만 읽고, 없는 값은 만들지 않는다.
 *
 * 작은 훅 셋(`useSellerStats`·`useSellerWithdrawable`·`useSellerVouchers`)은 이용권 탭(M4)도 같이 쓴다 —
 *   같은 캐시 키라 홈 → 이용권 탭 이동이 0 RTT 다.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getSellerToken, isSellerAuthenticated } from '@/lib/seller-auth'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'
import { parseUTCDate } from '@/utils/date'
import type { Order } from './types'

export interface HomeVoucher {
  id: number
  name: string
  price: number
  original_price?: number | null
  image_url?: string | null
  is_active: boolean
  /** `ACTIVE` · `HIDDEN` · `DELETED` …. 삭제분은 `useSellerVouchers` 가 걸러 내고 `useSellerDeletedVouchers` 만 준다. */
  status?: string | null
  group_buy_status?: string | null
  /** 판매 수(참여 수). 서버 `group_buy_current`. */
  sold: number
  restaurant_name?: string | null
  restaurant_phone?: string | null
  store_owner_token?: string | null
  category?: string | null
}

/** 결제는 끝났고 셀러가 아직 "주문 확인"(→ 준비 중)을 안 누른 상태. `seller-orders/statusHelpers.nextStatusOf` 와 같은 집합. */
export const AWAITING_CONFIRM = new Set(['PAID', 'DONE', 'PAY_COMPLETE'])

export function kstKey(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 10)
}
/** 이번 주(월요일 시작, KST)의 구간과 지난주 같은 구간. */
function weekRanges(now = Date.now()) {
  const k = new Date(now + 9 * 3600_000)
  const dow = (k.getUTCDay() + 6) % 7 // 월=0
  const start = now - dow * 86400_000
  return {
    thisFrom: kstKey(start), thisTo: kstKey(now),
    lastFrom: kstKey(start - 7 * 86400_000), lastTo: kstKey(start - 7 * 86400_000 + dow * 86400_000),
  }
}
/** 이번 달(KST) 매출 합 — 일별 매출에서 이번 달 키만 더한다. */
export function monthRevenue(daily: { date: string; revenue: number }[], now = Date.now()): number {
  const ym = kstKey(now).slice(0, 7)
  return daily.filter((d) => d.date.startsWith(ym)).reduce((s, d) => s + (Number(d.revenue) || 0), 0)
}

const H = () => ({ Authorization: `Bearer ${getSellerToken()}` })

/** 오늘·최근 30일 매출 — `/dashboard/stats`. 홈 티켓과 이용권 탭 헤더가 같은 값을 본다. */
export function useSellerStats() {
  return useQuery({
    queryKey: ['seller', 'home', 'stats'],
    queryFn: async () => {
      const r = await api.get('/api/seller/dashboard/stats', { headers: H() })
      const d = (r.data?.success ? r.data.data : {}) as { today_revenue?: number; today_orders?: number; daily_revenue?: { date: string; revenue: number }[] }
      return { todayRevenue: Number(d.today_revenue) || 0, todayOrders: Number(d.today_orders) || 0, daily: d.daily_revenue ?? [] }
    },
    enabled: isSellerAuthenticated(), staleTime: 60_000, refetchOnWindowFocus: false,
  })
}

/** 정산 가능(환급 가능) 잔액 — 정산 화면의 `DealBalanceCard` 와 같은 엔드포인트·같은 필드. */
export function useSellerWithdrawable() {
  return useQuery({
    queryKey: ['seller', 'home', 'deal-balance'],
    queryFn: async () => {
      const r = await api.get('/api/seller/deal-balance', { headers: H() })
      return Number((r.data?.success ? r.data.data?.withdrawable : 0) || 0)
    },
    enabled: isSellerAuthenticated(), staleTime: 60_000, refetchOnWindowFocus: false,
  })
}

/** 내 이용권 목록 — `/api/seller/products` 중 이용권 카테고리. 홈 레일과 이용권 탭이 같은 캐시를 쓴다. */
/**
 * 내 이용권 — **삭제분까지** 한 번에 받아 온다(`include_deleted=1`).
 *
 * 🗑️ 2026-09-15 (대표가 삭제를 눌러 보고 드러난 구멍): 삭제한 이용권은 어느 화면에도 안 나와서
 *   **되돌릴 방법이 0** 이었다(어드민 PATCH 는 `status` 를 아예 안 받는다). 그래서 목록은 삭제분까지
 *   받고, **나누는 일은 select 가 한다** — 요청은 여전히 하나이고 캐시도 한 벌이다.
 */
function vouchersQuery() {
  return {
    queryKey: ['seller', 'home', 'vouchers'] as const,
    queryFn: async (): Promise<HomeVoucher[]> => {
      const r = await api.get('/api/seller/products', { headers: H(), params: { include_deleted: 1 } })
      const list = (r.data?.success ? (r.data.data || []) : []) as Array<Record<string, unknown>>
      return list
        .filter((p) => isVoucherCategory(p.category as string))
        .map((p) => ({
          id: Number(p.id), name: String(p.name ?? ''), price: Number(p.price) || 0,
          original_price: p.original_price == null ? null : Number(p.original_price),
          image_url: (p.image_url as string) || null,
          is_active: p.is_active === undefined ? true : !!Number(p.is_active),
          status: (p.status as string) || null,
          group_buy_status: (p.group_buy_status as string) || null,
          sold: Number(p.group_buy_current) || 0,
          restaurant_name: (p.restaurant_name as string) || null,
          restaurant_phone: (p.restaurant_phone as string) || null,
          store_owner_token: (p.store_owner_token as string) || null,
          category: (p.category as string) || null,
        }))
    },
    enabled: isSellerAuthenticated(), staleTime: 60_000, refetchOnWindowFocus: false,
  }
}

/** 살아 있는 이용권만 — 홈(M2)·이용권 탭의 세 세그먼트가 쓰는 목록(종전과 같은 내용). */
export function useSellerVouchers() {
  return useQuery({ ...vouchersQuery(), select: (l: HomeVoucher[]) => l.filter((v) => v.status !== 'DELETED') })
}

/** 삭제된 이용권만 — '삭제됨' 세그먼트. 같은 queryKey 라 **요청이 늘지 않는다**. */
export function useSellerDeletedVouchers() {
  return useQuery({ ...vouchersQuery(), select: (l: HomeVoucher[]) => l.filter((v) => v.status === 'DELETED') })
}

export function useSellerHome() {
  const statsQ = useSellerStats()
  const balanceQ = useSellerWithdrawable()
  const vouchersQ = useSellerVouchers()

  // 🔔 10초 폴링 — 새 주문 감지(useNewOrderAlert)가 이 목록의 최대 id 변화를 본다.
  const ordersQ = useQuery<Order[]>({
    queryKey: ['seller', 'home', 'orders'],
    queryFn: async () => {
      const r = await api.get('/api/seller/orders?limit=50&sort=desc', { headers: H() })
      return (r.data?.success ? (r.data.data || []) : []) as Order[]
    },
    enabled: isSellerAuthenticated(), staleTime: 5_000, refetchInterval: 10_000, refetchIntervalInBackground: false, refetchOnWindowFocus: true,
  })

  const orders = ordersQ.data ?? []
  const pendingOrders = orders.filter((o) => AWAITING_CONFIRM.has(o.status)).length

  const daily = statsQ.data?.daily ?? []
  const w = weekRanges()
  const sum = (from: string, to: string) => daily.filter((d) => d.date >= from && d.date <= to).reduce((s, d) => s + (Number(d.revenue) || 0), 0)
  const weekRevenue = sum(w.thisFrom, w.thisTo)
  const lastWeekRevenue = sum(w.lastFrom, w.lastTo)
  const weekDelta = lastWeekRevenue > 0 ? Math.round(((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : (weekRevenue > 0 ? 100 : 0)
  const weekOrders = orders.filter((o) => {
    const t = parseUTCDate(o.created_at).getTime()
    return !Number.isNaN(t) && kstKey(t) >= w.thisFrom
  }).length
  /** 최근 7일 일별 — PC 차트용. 빈 날은 0 으로 채운다(선이 끊기지 않게). */
  const week7 = Array.from({ length: 7 }, (_, i) => {
    const key = kstKey(Date.now() - (6 - i) * 86400_000)
    const found = daily.find((d) => d.date === key)
    return { date: key.slice(5), sales: found ? Number(found.revenue) || 0 : 0, orders: 0 }
  })

  const vouchers = [...(vouchersQ.data ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.sold - a.sold)

  return {
    loading: statsQ.isLoading && !statsQ.data,
    todayRevenue: statsQ.data?.todayRevenue ?? 0,
    todayOrders: statsQ.data?.todayOrders ?? 0,
    pendingOrders,
    orders,
    withdrawable: balanceQ.data ?? 0,
    vouchers,
    vouchersLoaded: vouchersQ.isFetched,
    weekRevenue, weekOrders, weekDelta, week7, hasDaily: daily.length > 0,
  }
}
