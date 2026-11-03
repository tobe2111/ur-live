import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Sheet from '../seller-section/Sheet'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { formatNumber, formatWon } from '@/utils/format'
import { orderStageOf, type OrderStage } from '@/shared/order-stage'
import { orderKindOf } from '@/shared/order-kind'
import { kstParts, todayKey, yesterdayKey } from '@/pages/seller-orders/MobileOrderList'
import { useOrderActions } from '@/pages/seller-orders/useOrderActions'
import type { Order } from '@/pages/seller-orders/types'
import { Card, PlateLoading } from './ui'

const OrderDetailModal = lazy(() => import('@/pages/seller-orders/OrderDetailModal'))

/**
 * 🧾 마이 — **주문** (시안 M3). 2026-11-03 대표 확정 *"좋다 다 해줘"*.
 *
 * 종전엔 셀러 주문 화면(`SellerOrdersPage`)을 시트에 그대로 띄웠다 — 흰 바탕 위 테두리 카드라 "붕 떠 보였다".
 * 같은 것을 쓴다: 목록은 **같은 요청·같은 캐시 키**(`['seller','orders']`, limit 200), 단계는 SSOT `orderStageOf`,
 *   한 건에 하는 일(주문 확인·취소·환불·운송장)은 `useOrderActions`(셀러 화면과 한 벌), 상세는 같은 `OrderDetailModal`.
 * ⇒ 이 파일이 새로 하는 것은 **모양**뿐이다(위 숫자 두 칸 · 탭 · 날짜별 흰 판).
 */
type Tab = 'waiting' | 'preparing' | 'unused' | 'done' | 'refunded' | 'all'
const DOW = ['일', '월', '화', '수', '목', '금', '토']

export default function MyOrdersSheet({ onClose }: { onClose: () => void }) {
  const q = useQuery<Order[]>({
    queryKey: ['seller', 'orders'],
    queryFn: async () => {
      const r = await api.get('/api/seller/orders', { params: { limit: 200 } })
      return r.data?.success ? ((r.data.data || r.data.orders || []) as Order[]) : []
    },
    staleTime: 2 * 60 * 1000,
    refetchOnMount: 'always',
  })
  const orders = useMemo(() => q.data ?? [], [q.data])
  const [selected, setSelected] = useState<Order | null>(null)
  const act = useOrderActions((n) => { if (selected?.order_number === n) setSelected(null) })
  const [picked, setPicked] = useState<Tab | null>(null)

  const stageOf = useMemo(() => new Map(orders.map((o) => [o.order_number, orderStageOf(o)] as const)), [orders])
  const st = (o: Order): OrderStage => stageOf.get(o.order_number) ?? 'other'
  const n = (x: OrderStage) => orders.filter((o) => st(o) === x).length
  const counts = { waiting: n('waiting'), preparing: n('preparing'), unused: n('unused'), done: n('done'), refunded: n('refunded') }
  const kinds = new Set(orders.map((o) => orderKindOf(o.order_kind)))
  const hasShipping = kinds.has('shipping')
  const hasVoucher = kinds.has('voucher') || orders.length === 0
  const auto: Tab = counts.waiting > 0 ? 'waiting' : hasVoucher && counts.unused > 0 ? 'unused' : 'all'
  const tab: Tab = picked ?? auto
  const monthKey = todayKey().slice(0, 7)
  const monthOrders = orders.filter((o) => kstParts(o.created_at)?.key.startsWith(monthKey)).length

  const groups = useMemo(() => {
    const rows = orders.filter((o) => tab === 'all' || st(o) === tab)
      .map((o) => ({ o, k: kstParts(o.created_at) }))
      .sort((a, b) => (b.k?.ms ?? 0) - (a.k?.ms ?? 0))
    const today = todayKey(), yesterday = yesterdayKey()
    const map = new Map<string, { label: string; rows: typeof rows }>()
    for (const r of rows) {
      const key = r.k?.key ?? '0000'
      const label = key === today ? '오늘' : key === yesterday ? '어제' : r.k ? `${r.k.month}월 ${r.k.day}일 (${DOW[r.k.dow]})` : '-'
      if (!map.has(key)) map.set(key, { label, rows: [] })
      map.get(key)!.rows.push(r)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tab, stageOf])

  const TABS: Array<{ id: Tab; label: string; n?: number; show: boolean }> = [
    { id: 'waiting', label: '처리 대기', n: counts.waiting, show: hasShipping || counts.waiting > 0 },
    { id: 'preparing', label: '준비 중', n: counts.preparing, show: hasShipping || counts.preparing > 0 },
    { id: 'unused', label: '사용 전', n: counts.unused, show: hasVoucher || counts.unused > 0 },
    { id: 'done', label: '완료', n: counts.done, show: true },
    { id: 'refunded', label: '취소·환불', n: counts.refunded, show: counts.refunded > 0 || tab === 'refunded' },
    { id: 'all', label: '전체', show: true },
  ]
  const waitingTotal = counts.waiting + counts.unused

  return (
    <Sheet title="주문" onClose={onClose} tall>
      <div className="pb-8" data-testid="my-orders-sheet">
        <Card className="px-5 py-4 grid grid-cols-2" testId="my-orders-summary">
          <div>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{hasShipping ? '처리할 주문' : '사용 대기'}</p>
            <p className={`mt-1 text-[20px] font-bold tabular-nums ${waitingTotal > 0 ? 'text-brand-text' : 'text-gray-900 dark:text-white'}`}>{q.isLoading ? '—' : `${formatNumber(waitingTotal)}건`}</p>
          </div>
          <div className="pl-5 border-l border-rule">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">이번 달 주문</p>
            <p className="mt-1 text-[20px] font-bold tabular-nums text-gray-900 dark:text-white">{q.isLoading ? '—' : `${formatNumber(monthOrders)}건`}</p>
          </div>
        </Card>
        <div className="mx-3 mt-3">
          <SegmentedTabs<Tab> value={tab} onChange={setPicked}
            items={TABS.filter((x) => x.show).map((x) => ({ id: x.id, label: x.label, count: x.n != null && x.n > 0 ? x.n : undefined }))} />
        </div>
        {act.error && <p className="mx-5 mt-3 text-[13px] text-tone-bad">{act.error}</p>}
        {q.isLoading ? <PlateLoading /> : groups.length === 0 ? (
          <Card className="px-5 py-8 text-center"><p className="text-[15px] text-gray-500 dark:text-gray-400">해당하는 주문이 없어요</p></Card>
        ) : groups.map(([key, g]) => (
          <section key={key}>
            <h3 className="px-5 pt-5 flex items-baseline justify-between text-[13px] font-medium text-gray-500 dark:text-gray-400">
              <span>{g.label}</span><span className="tabular-nums">{formatNumber(g.rows.length)}건</span>
            </h3>
            <Card className="mt-2 px-5 py-1">
              {g.rows.map(({ o, k }) => {
                const stage = st(o)
                const isVoucher = orderKindOf(o.order_kind) === 'voucher'
                const title = o.items && o.items.length > 0
                  ? o.items.map((it) => `${it.product_name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ')
                  : (o.shipping_name || o.user_name || '-')
                const badge = stage === 'waiting' ? '처리 대기' : stage === 'preparing' ? '준비 중' : stage === 'unused' ? '사용 전'
                  : stage === 'refunded' ? '취소·환불' : stage === 'done' ? (isVoucher ? '사용 완료' : '완료') : ''
                const hot = stage === 'waiting' || stage === 'unused'
                return (
                  <div key={o.order_number} className="py-3 border-b border-rule last:border-b-0">
                    <button type="button" onClick={() => { setSelected(o); act.setTrackingForm({ courier: o.courier ?? '', tracking_number: o.tracking_number ?? '' }) }}
                      className="w-full flex items-center gap-3 text-left active:opacity-70">
                      <span className="flex-1 min-w-0">
                        <span className={`block truncate text-[15px] font-medium ${stage === 'done' || stage === 'refunded' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{title}</span>
                        <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">
                          {k ? `${k.hh}:${k.mm}` : '-'} · {o.shipping_name || o.user_name || '-'} · {formatWon(o.total_amount)}
                        </span>
                      </span>
                      {badge && <span className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-medium ${hot ? 'bg-brand-tint text-brand-text' : 'bg-wash text-gray-500 dark:text-gray-400'}`}>{badge}</span>}
                    </button>
                    {stage === 'waiting' && (
                      <button type="button" disabled={act.updating} onClick={() => act.handleStatusChange(o.order_number, 'PREPARING')}
                        className="mt-2 h-9 px-4 rounded-xl bg-brand text-white text-[13px] font-medium disabled:opacity-60">주문 확인</button>
                    )}
                  </div>
                )
              })}
            </Card>
          </section>
        ))}
      </div>
      {selected && (
        <Suspense fallback={null}>
          <OrderDetailModal
            order={selected} updating={act.updating}
            trackingForm={act.trackingForm} onTrackingFormChange={act.setTrackingForm}
            onClose={() => setSelected(null)}
            onStatusChange={act.handleStatusChange}
            onRefund={act.handleRefund}
            onTrackingSubmit={act.handleTrackingSubmit}
          />
        </Suspense>
      )}
    </Sheet>
  )
}
