/**
 * 🧾 주문 — 마이 안에서 전부 (2026-09-26, 설계 §21 주문 묶음)
 *   대표: *"일단 마이에서 대부분 끝내야 해"*
 *
 * ## 왜 이게 첫 묶음인가
 * 사장님이 하루에 가장 많이 여는 곳인데, 마이에는 **확인 대기만** 있었다(`PendingOrders`).
 * 어제 주문 하나를 찾으려면 반드시 셀러 대시보드로 나가야 했다 — 가장 잦은 일에 가장 먼 길이다.
 *
 * ## 서버는 그대로다
 * `GET /api/seller/orders` 는 이미 `status`·`limit`·`offset`·`sort` 를 받고 품목까지 붙여 준다
 * (`enrichSellerOrderRows`). **새 엔드포인트 0** — 화면만 생긴다.
 *
 * ## 🪑 좌석
 * 이 엔드포인트는 좌석 토큰의 `seller_id` 로 스코프된다. 좌석이 어긋나면 **부르지 않는다** —
 * 부르면 조용히 남의 가게 주문을 그린다(에러가 안 난다).
 * 확인(쓰기)은 `useSellerWork.confirmOrder` 가 `assertSeat` 을 이미 들고 있으므로 그것을 쓴다 —
 * 여기서 상태 전이를 다시 구현하면 두 벌이 되고, 두 벌은 반드시 갈린다.
 *
 * ## 환불은 **여기서 시작하되 여기서 하지 않는다**
 * 사유를 적어야 하고 되돌릴 수 없어 전용 시트(`RefundSheet`)가 맡는다. 다만 사장님이 환불을
 * 떠올리는 자리는 **주문 목록**이므로 길은 여기 둔다(`onRefund`) — 닫으면 이 목록으로 돌아온다.
 * ⚠️ 그래서 이 파일에는 환불 **엔드포인트가 없다**(테스트가 그 부재를 고정한다). 문은 여기, 일은 거기.
 *
 * ## 송장 입력도 없다
 * 이용권은 배송이 없고, 배송 상품은 표가 필요하다(시트 폭에서 표는 가로로 잘린다).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import { currentSeatId } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'
import { AWAITING_CONFIRM, type SellerWorkState } from './useSellerWork'

const PAGE = 30

/** 서버 `status` 파라미터 값 그대로 — `STATUS_MAP` 이 DB 값으로 옮긴다. */
const TABS = [
  { key: '', label: '전체' },
  { key: 'PAY_COMPLETE', label: '확인 대기' },
  { key: 'PREPARING', label: '준비 중' },
  { key: 'CANCELLED', label: '취소·환불' },
] as const

/** 배지 문구 — 색은 쓰지 않는다(이 화면에서 브랜드색은 '확인' 버튼 한 자리다). */
const STATUS_LABEL: Record<string, string> = {
  PAID: '확인 대기', DONE: '확인 대기', PAY_COMPLETE: '확인 대기',
  PREPARING: '준비 중', SHIPPING: '발송', DELIVERED: '완료',
  CANCELLED: '취소', REFUNDED: '환불', FAILED: '실패', PENDING: '결제 전',
  AWAITING_PAYMENT: '입금 대기',
}

interface Row {
  id: number
  orderNumber: string
  title: string
  buyer: string
  phone: string
  amount: number
  at: string
  status: string
  items: string[]
}

type Raw = Record<string, unknown>

function rowOf(o: Raw): Row {
  const items = Array.isArray(o.items) ? (o.items as Raw[]) : []
  const names = items.map((i) => String(i.product_name ?? '')).filter(Boolean)
  return {
    id: Number(o.id),
    orderNumber: String(o.order_number ?? ''),
    title: names[0] || '주문',
    buyer: String(o.shipping_name || o.user_name || '고객'),
    phone: String(o.shipping_phone || ''),
    amount: Number(o.total_amount) || 0,
    at: formatKSTShort(typeof o.created_at === 'string' ? o.created_at : null),
    status: String(o.status ?? ''),
    items: names,
  }
}

export default function OrdersSheet({ sellerId, work, onClose, onDone, onRefund }: {
  sellerId: number
  /** 확인(상태 전이)은 여기 것을 쓴다 — 전이 규칙이 두 벌이 되지 않게. */
  work: SellerWorkState
  onClose: () => void
  onDone?: () => void
  /** 환불 시트를 연다 — 사유·되돌릴 수 없음 때문에 일은 거기서 한다(닫으면 이 목록으로 돌아온다). */
  onRefund: () => void
}) {
  const [tab, setTab] = useState<string>('')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback((offset: number, status: string) => {
    // 🪑 좌석이 안 맞으면 부르지 않는다 — 부르면 남의 가게 주문이 뜬다.
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    setLoading(true)
    const q = `limit=${PAGE}&offset=${offset}&sort=desc${status ? `&status=${encodeURIComponent(status)}` : ''}`
    import('@/lib/api').then(({ default: api }) => api.get(`/api/seller/orders?${q}`))
      .then((r) => {
        if (!alive.current) return
        if (!r.data?.success) { setFailed(true); return }
        const list = ((r.data.data || []) as Raw[]).map(rowOf)
        setRows((prev) => (offset === 0 ? list : [...prev, ...list]))
        setTotal(Number(r.data.pagination?.total) || 0)
        setFailed(false)
      })
      .catch(() => { if (alive.current) setFailed(true) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [sellerId])

  useEffect(() => { setRows([]); setOpen(null); load(0, tab) }, [tab, load])

  async function confirm(r: Row) {
    const ok = await work.confirmOrder({
      id: r.id, orderNumber: r.orderNumber, title: r.title,
      buyer: r.buyer, amount: r.amount, at: r.at, status: r.status,
    })
    if (!ok) { toast.error('주문을 확인하지 못했습니다'); return }
    if (alive.current) setRows((list) => list.map((x) => (x.orderNumber === r.orderNumber ? { ...x, status: 'PREPARING' } : x)))
    onDone?.()
  }

  return (
    <Sheet
      title="주문"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onRefund}
          className="w-full h-12 rounded-xl bg-wash text-[14.5px] font-bold text-gray-900 dark:text-white active:opacity-70"
        >
          환불하기
        </button>
      }
    >
      <div className="sticky top-0 z-10 bg-surface px-4 pt-3 pb-2.5 border-b border-rule">
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-bold transition-colors ${
                tab === t.key
                  ? 'bg-brand text-white'
                  : 'bg-wash text-gray-500 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {failed && (
        <p className="px-4 py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          지금은 불러올 수 없어요. 잠시 후 다시 열어 주세요.
        </p>
      )}

      {!failed && rows.length === 0 && !loading && (
        <p className="px-4 py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          {tab ? '이 상태의 주문이 없어요.' : '아직 주문이 없어요.'}
        </p>
      )}

      <div className="px-4 py-3">
        {rows.length > 0 && (
          <p className="px-1 pb-2 text-[12px] text-gray-500 dark:text-gray-400 tabular-nums">
            {formatNumber(total)}건
          </p>
        )}
        <div className="rounded-xl bg-surface shadow-lift overflow-hidden">
          {rows.map((r) => {
            const expanded = open === r.orderNumber
            const awaiting = AWAITING_CONFIRM.has(r.status)
            return (
              <div key={r.orderNumber} className="border-b border-rule last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : r.orderNumber)}
                  aria-expanded={expanded}
                  className="w-full flex items-start gap-3 px-3.5 py-3 text-left active:opacity-70"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-gray-900 dark:text-white truncate">
                      {r.title}{r.items.length > 1 ? ` 외 ${r.items.length - 1}` : ''}
                    </span>
                    <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {r.buyer} · {r.at} · {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatNumber(r.amount)}원
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 mt-0.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {expanded && (
                  <div className="px-3.5 pb-3.5 -mt-0.5">
                    <dl className="rounded-lg bg-wash px-3 py-2.5 text-[12.5px] leading-[1.7]">
                      <div className="flex gap-2">
                        <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">주문번호</dt>
                        <dd className="min-w-0 font-medium text-gray-900 dark:text-white tabular-nums break-all">{r.orderNumber}</dd>
                      </div>
                      {r.phone && (
                        <div className="flex gap-2">
                          <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">연락처</dt>
                          <dd className="min-w-0 font-medium text-gray-900 dark:text-white tabular-nums">{r.phone}</dd>
                        </div>
                      )}
                      {r.items.length > 0 && (
                        <div className="flex gap-2">
                          <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">품목</dt>
                          <dd className="min-w-0 font-medium text-gray-900 dark:text-white">{r.items.join(' · ')}</dd>
                        </div>
                      )}
                    </dl>
                    {awaiting && (
                      <button
                        type="button"
                        disabled={work.busyOrder !== null}
                        onClick={() => confirm(r)}
                        className="mt-2.5 w-full h-11 rounded-xl bg-brand text-white text-[14px] font-bold active:opacity-80 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {work.busyOrder === r.orderNumber && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        주문 확인
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
          </div>
        )}

        {!loading && rows.length > 0 && rows.length < total && (
          <button
            type="button"
            onClick={() => load(rows.length, tab)}
            className="mt-3 w-full h-11 rounded-xl bg-surface shadow-lift text-[13.5px] font-bold text-gray-900 dark:text-white active:opacity-70"
          >
            더 보기
          </button>
        )}
      </div>
    </Sheet>
  )
}
