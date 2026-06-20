import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Truck, ChevronRight, MessageCircle, Search, Ticket, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { safeDate } from '@/utils/safe-date'
import { toast } from '@/hooks/useToast'
import type { Order, OrderItem } from '@/types/order'
import { orderItemLineTotal } from '@/types/order'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { getOrderKind, type OrderKind } from '@/shared/order-type'

interface OrdersTabProps {
  orders: Order[]
  onCancelOrder: (orderId: number | string, orderNumber: string) => void
  onSelectOrder: (order: Order) => void
  onConfirmOrder?: (orderId: number | string, orderNumber: string) => void
  // 🏁 2026-06-12 (전수조사 🔴 G6): 배송완료 주문 반품 신청 입구 + 진행 상태 표시.
  onRequestReturn?: (orderId: number | string, orderNumber: string) => void
  returnsByOrder?: Record<string, string>   // order_id → 반품 status (rejected/cancelled 제외)
}

// ─── 택배사별 외부 추적 URL (OrderDetailModal 에서 import) ──────────────────────

export function getTrackingUrl(courier?: string, trackingNumber?: string): string {
  if (!courier || !trackingNumber) return ''
  const n = encodeURIComponent(trackingNumber)
  const urls: Record<string, string> = {
    'CJ대한통운':    `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvNo=${n}`,
    '우체국택배':     `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${n}`,
    '한진택배':      `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${n}`,
    '로젠택배':      `https://www.ilogen.com/web/personal/trace/${n}`,
    '롯데택배':      `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${n}`,
    'GS택배':       `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${n}`,
    '쿠팡로켓배송':   `https://www.coupang.com/my/orders/lookup?q=${n}`,
    '홈픽':         `https://www.homepick.com/parcel-tracking?trackingNo=${n}`,
  }
  return urls[courier] ?? `https://tracker.delivery/#/${courier}/${n}`
}

// ─── 종류 탭 / 상태 라벨 헬퍼 ──────────────────────────────────────────────────

type KindFilter = 'all' | OrderKind

// 🛡️ 2026-06-18: 상태를 큰 컬러 배지 → 은은한 컬러 텍스트(무신사 스타일). 종류별 라벨 분기.
function getStatusInfo(status: string, kind: OrderKind, t: TFunction): { label: string; cls: string } {
  const s = (status || '').toLowerCase()
  if (s === 'cancelled' || s === 'refunded') {
    return { label: t('ordersTab.statusCancelled', { defaultValue: '취소/환불' }), cls: 'text-rose-600 dark:text-rose-400' }
  }
  if (kind !== 'product') {
    // 교환권/공구: 배송 단계 없음 — 구매완료 단일 상태(취소 제외)
    return { label: t('ordersTab.statusIssued', { defaultValue: '구매완료' }), cls: 'text-emerald-600 dark:text-emerald-400' }
  }
  switch (s) {
    case 'shipping':
      return { label: t('ordersTab.statusShipping', { defaultValue: '배송중' }), cls: 'text-blue-600 dark:text-blue-400' }
    case 'delivered':
    case 'done':
      return { label: t('ordersTab.statusDelivered', { defaultValue: '배송완료' }), cls: 'text-emerald-600 dark:text-emerald-400' }
    case 'preparing':
      return { label: t('ordersTab.statusPreparing', { defaultValue: '상품준비중' }), cls: 'text-amber-600 dark:text-amber-500' }
    default:
      return { label: t('ordersTab.statusPaid', { defaultValue: '결제완료' }), cls: 'text-gray-600 dark:text-gray-300' }
  }
}

// 🛡️ 2026-06-18: YY.MM.DD(요일) 무신사 스타일 날짜 그룹 라벨.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
function dateGroupLabel(iso?: string): { key: string; label: string } {
  const d = safeDate(iso)
  if (!d) return { key: 'unknown', label: '-' }
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return { key: `${yy}.${mm}.${dd}`, label: `${yy}.${mm}.${dd}(${WEEKDAYS[d.getDay()]})` }
}

function optionText(item: OrderItem): string {
  if (item.option_value) return String(item.option_value)
  const o = (item as { options?: Record<string, unknown> }).options
  if (o && typeof o === 'object') {
    const vals = Object.values(o).filter(v => v != null && v !== '')
    if (vals.length) return vals.join(' / ')
  }
  return ''
}

// ─── 상품 썸네일 ───────────────────────────────────────────────────────────────

function ItemThumb({ item }: { item: OrderItem }) {
  const src = item.product_thumbnail || item.image_url
  if (!src) {
    return (
      <div className="w-16 h-16 shrink-0 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center">
        <Package className="w-6 h-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={cfImage(src, { width: 128, height: 128, fit: 'cover' })}
      alt=""
      width={64}
      height={64}
      loading="lazy"
      className="w-16 h-16 shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-[#1A1A1A]"
    />
  )
}

// ─── OrdersTab 메인 ───────────────────────────────────────────────────────────

export function OrdersTab({ orders, onCancelOrder, onSelectOrder, onConfirmOrder, onRequestReturn, returnsByOrder }: OrdersTabProps) {
  const { t } = useTranslation()
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [search, setSearch] = useState('')

  function handleSellerContact(order: Order) {
    const kakao = order.seller_kakao_chat_url as string | undefined
    const phone = order.seller_phone as string | undefined
    if (kakao) {
      window.open(kakao, '_blank', 'noopener,noreferrer')
    } else if (phone) {
      toast.info(t('ordersTab.sellerContact', { phone, defaultValue: `판매자 연락처: ${phone}` }))
    } else {
      toast.info(t('ordersTab.sellerNoContact', { defaultValue: '판매자 연락처가 등록되지 않았습니다' }))
    }
  }

  // 종류 1회 산출 + 카운트
  const annotated = useMemo(
    () => orders.map(o => ({ order: o, kind: getOrderKind(o as { items?: OrderItem[] }) })),
    [orders]
  )
  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = { all: annotated.length, product: 0, voucher: 0, groupbuy: 0 }
    for (const { kind } of annotated) c[kind]++
    return c
  }, [annotated])

  const KIND_TABS: { key: KindFilter; label: string }[] = [
    { key: 'all',      label: t('ordersTab.kindAll', { defaultValue: '전체' }) },
    { key: 'product',  label: t('ordersTab.kindProduct', { defaultValue: '상품' }) },
    { key: 'voucher',  label: t('ordersTab.kindVoucher', { defaultValue: '교환권' }) },
    { key: 'groupbuy', label: t('ordersTab.kindGroupbuy', { defaultValue: '공구' }) },
  ]

  // 검색 + 종류 필터
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => annotated.filter(({ order, kind }) => {
    if (kindFilter !== 'all' && kind !== kindFilter) return false
    if (q) {
      const hay = [
        order.order_number,
        order.seller_name,
        ...(Array.isArray(order.items) ? order.items.map(i => i.product_name) : []),
      ].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [annotated, kindFilter, q])

  // 날짜 그룹핑 (orders 는 created_at DESC 로 옴 → 순서 유지)
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: typeof filtered }>()
    for (const row of filtered) {
      const { key, label } = dateGroupLabel(row.order.created_at)
      if (!map.has(key)) map.set(key, { label, rows: [] })
      map.get(key)!.rows.push(row)
    }
    return Array.from(map.values())
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* 검색 — 무신사 스타일 상단 검색바 */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ordersTab.searchPlaceholder', { defaultValue: '상품명 / 브랜드명으로 검색하세요.' })}
          aria-label={t('ordersTab.searchAria', { defaultValue: '주문 검색' })}
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10"
        />
      </div>

      {/* 종류 탭 — 텍스트+밑줄 (무신사 스타일) */}
      <div className="flex gap-5 border-b border-gray-100 dark:border-[#1A1A1A] -mx-4 px-4 overflow-x-auto no-scrollbar">
        {KIND_TABS.map(tab => {
          const active = kindFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setKindFilter(tab.key)}
              className={`relative whitespace-nowrap pb-2.5 text-[15px] transition-colors ${
                active
                  ? 'font-extrabold text-gray-900 dark:text-white'
                  : 'font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1 text-[12px] ${active ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>
                  {counts[tab.key]}
                </span>
              )}
              {active && <span className="absolute left-0 -bottom-px h-0.5 w-full bg-gray-900 dark:bg-white rounded-full" />}
            </button>
          )
        })}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <EmptyState kindFilter={kindFilter} searching={!!q} t={t} />
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <section key={group.label}>
              {/* 날짜 그룹 헤더 */}
              <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white mb-2.5 px-0.5">
                {group.label}
              </h2>
              <div className="space-y-3">
                {group.rows.map(({ order, kind }) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    kind={kind}
                    onSelectOrder={onSelectOrder}
                    onCancelOrder={onCancelOrder}
                    onConfirmOrder={onConfirmOrder}
                    onRequestReturn={onRequestReturn}
                    returnStatus={returnsByOrder?.[String(order.id)]}
                    onSellerContact={handleSellerContact}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 주문 카드 ─────────────────────────────────────────────────────────────────

function OrderCard({
  order, kind, onSelectOrder, onCancelOrder, onConfirmOrder, onRequestReturn, returnStatus, onSellerContact, t,
}: {
  order: Order
  kind: OrderKind
  onSelectOrder: (o: Order) => void
  onCancelOrder: (id: number | string, n: string) => void
  onConfirmOrder?: (id: number | string, n: string) => void
  onRequestReturn?: (id: number | string, n: string) => void
  returnStatus?: string
  onSellerContact: (o: Order) => void
  t: TFunction
}) {
  const status = getStatusInfo(order.status, kind, t)
  const s = (order.status || '').toLowerCase()
  const canCancel  = ['pending', 'paid', 'confirmed', 'done'].includes(s)
  const canConfirm = s === 'shipping' && !!onConfirmOrder
  const canReturn  = kind === 'product' && ['delivered', 'done'].includes(s) && !!onRequestReturn && !returnStatus
  const orderNum = order.order_number ?? String(order.id)
  const items = Array.isArray(order.items) ? order.items : []
  const hasTracking = kind === 'product' && !!order.courier && !!order.tracking_number

  const openDetail = () => onSelectOrder(order)

  return (
    <article className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden">
      {/* 클릭 영역: 상태 + 판매처 + 상품 → 상세 */}
      <div
        role="button"
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail() } }}
        className="w-full text-left px-4 pt-3.5 cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[12px] font-bold ${status.cls}`}>{status.label}</span>
          {order.seller_name && (
            <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 truncate max-w-[55%]">
              {order.seller_name}
            </span>
          )}
        </div>

        <div className="space-y-3 pb-1">
          {items.slice(0, 3).map((item, idx) => {
            const opt = optionText(item)
            return (
              <div key={idx} className="flex gap-3">
                <ItemThumb item={item} />
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-[14px] font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug">
                    {item.product_name}
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                    {opt && <span>{opt} · </span>}
                    {t('ordersTab.itemQty', { qty: item.quantity, defaultValue: `${item.quantity}개` })}
                  </p>
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white mt-0.5">
                    {formatNumber(orderItemLineTotal(item))}
                    <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-0.5">{t('ordersTab.won', { defaultValue: '원' })}</span>
                  </p>
                </div>
              </div>
            )
          })}
          {items.length > 3 && (
            <p className="text-[12px] text-gray-500 dark:text-gray-400 pl-[76px]">
              {t('ordersTab.moreItems', { count: items.length - 3, defaultValue: `외 ${items.length - 3}개` })}
            </p>
          )}
        </div>
      </div>

      {/* 배송 송장 (상품만) */}
      {hasTracking && (
        <div className="mx-4 mt-1 mb-3 flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-[#121212] rounded-xl">
          <div className="flex items-center gap-1.5 min-w-0">
            <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="text-[12px] min-w-0 truncate">
              <span className="text-gray-500 dark:text-gray-400">{order.courier} · </span>
              <span className="font-semibold text-gray-900 dark:text-white">{order.tracking_number}</span>
            </span>
          </div>
          <a
            href={getTrackingUrl(order.courier, order.tracking_number)}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-0.5"
          >
            {t('ordersTab.trackingLink', { defaultValue: '배송조회' })}
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* 교환권/공구 — '내 교환권' 사용 안내 */}
      {kind !== 'product' && (
        <Link
          to="/my-vouchers"
          onClick={(e) => e.stopPropagation()}
          className="mx-4 mt-1 mb-3 flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#121212] rounded-xl"
        >
          <span className="text-[12px] text-gray-600 dark:text-gray-300 flex items-center gap-1.5 min-w-0">
            {kind === 'voucher'
              ? <Ticket className="h-3.5 w-3.5 text-emerald-500 shrink-0" strokeWidth={2} aria-hidden="true" />
              : <Users className="h-3.5 w-3.5 text-emerald-500 shrink-0" strokeWidth={2} aria-hidden="true" />}
            <span className="truncate">{t('ordersTab.useInMyVouchers', { defaultValue: "'내 교환권'에서 사용하세요" })}</span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
        </Link>
      )}

      {/* 푸터: 결제금액 + 액션 */}
      <div className="px-4 pb-3.5 pt-3 flex items-center justify-between border-t border-gray-100 dark:border-[#1A1A1A]">
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">{t('ordersTab.paymentAmount', { defaultValue: '결제금액' })}</p>
          <p className="text-[17px] font-extrabold text-gray-900 dark:text-white">
            {formatNumber(order.total_amount ?? order.amount ?? 0)}
            <span className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 ml-0.5">{t('ordersTab.won', { defaultValue: '원' })}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            onClick={() => onSellerContact(order)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] rounded-full hover:bg-gray-50 dark:hover:bg-[#121212] transition-colors"
            aria-label={t('ordersTab.inquiry', { defaultValue: '판매자 문의' })}
          >
            <MessageCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {t('ordersTab.inquiry', { defaultValue: '문의' })}
          </button>
          {returnStatus && (
            <span className="px-2.5 py-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full">
              {t('ordersTab.returnInProgress', { defaultValue: '반품 진행중' })}
            </span>
          )}
          {canReturn && (
            <button
              onClick={() => onRequestReturn!(order.id, orderNum)}
              className="px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] rounded-full hover:bg-gray-50 dark:hover:bg-[#121212] transition-colors"
            >
              {t('ordersTab.requestReturn', { defaultValue: '반품' })}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancelOrder(order.id, orderNum)}
              className="px-2.5 py-1.5 text-[12px] font-semibold text-red-600 bg-white dark:bg-[#0A0A0A] border border-red-100 dark:border-red-900/40 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              {t('ordersTab.cancelOrder', { defaultValue: '취소' })}
            </button>
          )}
          {canConfirm && onConfirmOrder && (
            <button
              onClick={() => onConfirmOrder(order.id, orderNum)}
              className="px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full hover:bg-emerald-100 transition-colors"
            >
              {t('ordersTab.confirmOrder', { defaultValue: '구매확정' })}
            </button>
          )}
          <button
            onClick={openDetail}
            className="flex items-center text-[13px] font-bold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-200 transition-colors ml-0.5"
          >
            {t('ordersTab.detail', { defaultValue: '상세' })}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── 빈 상태 (필터별 문구) ─────────────────────────────────────────────────────

function EmptyState({ kindFilter, searching, t }: { kindFilter: KindFilter; searching: boolean; t: TFunction }) {
  let title: string
  let desc: string
  if (searching) {
    title = t('ordersTab.emptySearchTitle', { defaultValue: '검색 결과가 없습니다' })
    desc = t('ordersTab.emptySearchDesc', { defaultValue: '다른 검색어로 다시 시도해보세요' })
  } else {
    switch (kindFilter) {
      case 'product':
        title = t('ordersTab.emptyProductTitle', { defaultValue: '상품 주문이 없습니다' }); break
      case 'voucher':
        title = t('ordersTab.emptyVoucherTitle', { defaultValue: '교환권 구매 내역이 없습니다' }); break
      case 'groupbuy':
        title = t('ordersTab.emptyGroupbuyTitle', { defaultValue: '공구 참여 내역이 없습니다' }); break
      default:
        title = t('ordersTab.emptyTitle', { defaultValue: '주문 내역이 없습니다' })
    }
    desc = t('ordersTab.emptyDesc', { defaultValue: '마음에 드는 상품을 둘러보세요' })
  }
  return (
    <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-12 text-center">
      <div className="w-20 h-20 bg-gray-50 dark:bg-[#121212] rounded-full flex items-center justify-center mx-auto mb-5">
        <Package className="h-10 w-10 text-gray-400 dark:text-gray-500" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
      <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6">{desc}</p>
      {!searching && (
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white text-[14px] font-semibold rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors"
        >
          {t('ordersTab.goToLive', { defaultValue: '둘러보기' })}
        </Link>
      )}
    </div>
  )
}
