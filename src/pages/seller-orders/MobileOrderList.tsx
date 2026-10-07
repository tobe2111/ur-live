/**
 * 📱 **주문 — 폰 타임라인(M3)** (2026-09-14 대표 승인, `docs/design/seller-dashboard-mobile-first-2026-09.md`).
 *   시안: *"오늘 일어난 일을 시간순. '새 주문 → 주문 확인' 버튼이 그 자리에."* 처리 동선이 가장 짧다.
 *
 *   [처리 대기 N / 준비 중 N / 완료 N / 전체] 세그먼트 → 날짜별(오늘·어제·날짜) 타임라인. 점이 켜진(브랜드) 행은
 *   결제됐는데 아직 확인 안 한 주문이고, 그 행 안에 **[주문 확인]** 칩이 있다(누르면 준비 중으로 — `nextStatusOf` 와 같은 전이).
 *   행 자체를 누르면 상세 모달(기존).
 *
 * 🎟️ 2026-10-07 — **탭이 택배용이었다.** 이용권엔 배송이 없어 [주문 확인]→준비 중→배송 완료 길이 없고,
 *   그래서 이용권 주문이 **영원히 "처리 대기"** 에 쌓였다. 단계 판정을 `shared/order-stage`(SSOT)로 옮기고
 *   탭을 **그 매장에 실제로 있는 주문 종류**에 맞춘다 — 배송 주문이 있으면 [처리 대기·준비 중],
 *   이용권 주문이 있으면 [사용 전], 공통으로 [완료 · 취소·환불 · 전체]. 이용권 행엔 [주문 확인] 칩이 없다
 *   (눌러도 "준비 중" 이 될 뿐 아무 일도 안 일어난다).
 *
 * ## 왜 PC 표를 안 고치고 폰 뷰만 다시 그리는가 (2026-08-02 의 판단 그대로)
 *   `SellerOrdersPage` 에는 **`handleRefund`(머니 경로)** 가 들어 있다. 표를 재작성하면 돈 흐름 코드를 건드린다.
 *   ⇒ 표는 한 줄도 안 건드리고(`hidden md:block`) 폰에만 이 뷰를 얹는다(`md:hidden`). 롤백 = 렌더 1줄 제거.
 *
 * ⚠️ 날짜는 전부 `@/utils/date` SSOT 경유 — D1 타임스탬프는 `Z` 없는 UTC 문자열이라 `new Date()` 로 읽으면
 *   9시간 어긋난다(`check-utc-date-parse`). 픽업일(`pickup_date`)이 있으면 "사용 예정" 한 줄로 보여 준다.
 */
import { useMemo, useState } from 'react'
import { shortOrderNo } from '@/shared/order-number-display'
import { useTranslation } from 'react-i18next'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { parseUTCDate } from '@/utils/date'
import { formatWon } from '@/utils/format'
import { orderStageOf, type OrderStage } from '@/shared/order-stage'
import { orderKindOf } from '@/shared/order-kind'
import type { Order } from './types'

type Tab = 'waiting' | 'preparing' | 'unused' | 'done' | 'refunded' | 'all'

function kstParts(iso: string) {
  const d = parseUTCDate(iso)
  if (Number.isNaN(d.getTime())) return null
  const k = new Date(d.getTime() + 9 * 3600_000)
  return { key: k.toISOString().slice(0, 10), hh: String(k.getUTCHours()).padStart(2, '0'), mm: String(k.getUTCMinutes()).padStart(2, '0'), month: k.getUTCMonth() + 1, day: k.getUTCDate(), dow: k.getUTCDay(), ms: d.getTime() }
}
const todayKey = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const yesterdayKey = () => new Date(Date.now() - 86400_000 + 9 * 3600_000).toISOString().slice(0, 10)

export default function MobileOrderList({ orders, onSelect, onConfirm, confirming }: {
  orders: Order[]
  onSelect: (order: Order) => void
  /** [주문 확인] — 결제 완료 주문을 준비 중으로. 부모의 `handleStatusChange(order_number, 'PREPARING')`. */
  onConfirm?: (order: Order) => void
  confirming?: boolean
}) {
  const { t } = useTranslation()
  /** null = 아직 사장님이 안 골랐다 → 할 일이 있는 탭으로 자동(아래 `auto`). */
  const [picked, setPicked] = useState<Tab | null>(null)
  const DOW = [t('seller.settlements.sun'), t('seller.settlements.mon'), t('seller.settlements.tue'), t('seller.settlements.wed'), t('seller.settlements.thu'), t('seller.settlements.fri'), t('seller.settlements.sat')]

  /** 단계는 한 번만 계산한다 — 탭 숫자·필터·행 표시가 같은 값을 읽어야 서로 안 어긋난다. */
  const stageOf = useMemo(() => new Map(orders.map((o) => [o.order_number, orderStageOf(o)] as const)), [orders])
  const st = (o: Order): OrderStage => stageOf.get(o.order_number) ?? 'other'
  const n = (x: OrderStage) => orders.filter((o) => st(o) === x).length
  const counts = { waiting: n('waiting'), preparing: n('preparing'), unused: n('unused'), done: n('done'), refunded: n('refunded') }
  const kinds = new Set(orders.map((o) => orderKindOf(o.order_kind)))
  const hasShipping = kinds.has('shipping')
  // 주문이 아직 없으면 이용권 기준으로 보여 준다 — 유어딜 매장 대부분이 이용권만 판다.
  const hasVoucher = kinds.has('voucher') || orders.length === 0
  const auto: Tab = counts.waiting > 0 ? 'waiting' : hasVoucher && counts.unused > 0 ? 'unused' : 'all'
  const tab: Tab = picked ?? auto
  const setTab = (t: Tab) => setPicked(t)
  const today = todayKey(), yesterday = yesterdayKey()

  /** 탭 필터 → 주문 시각(KST) 내림차순 → 날짜별 묶음(오늘이 위). */
  const groups = useMemo(() => {
    const filtered = orders.filter((o) => tab === 'all' || st(o) === tab)
    const withTime = filtered.map((o) => ({ o, k: kstParts(o.created_at) })).sort((a, b) => (b.k?.ms ?? 0) - (a.k?.ms ?? 0))
    const map = new Map<string, { label: string; rows: typeof withTime }>()
    for (const row of withTime) {
      const key = row.k?.key ?? '0000'
      const label = key === today ? t('seller.ordersM3.today', { defaultValue: '오늘' })
        : key === yesterday ? t('seller.ordersM3.yesterday', { defaultValue: '어제' })
        : row.k ? `${row.k.month}/${row.k.day} (${DOW[row.k.dow]})` : '-'
      if (!map.has(key)) map.set(key, { label, rows: [] })
      map.get(key)!.rows.push(row)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tab, stageOf])

  const TABS: Array<{ id: Tab; label: string; n?: number; show: boolean }> = [
    { id: 'waiting', label: t('seller.ordersM3.waiting', { defaultValue: '처리 대기' }), n: counts.waiting, show: hasShipping || counts.waiting > 0 },
    { id: 'preparing', label: t('seller.ordersM3.preparing', { defaultValue: '준비 중' }), n: counts.preparing, show: hasShipping || counts.preparing > 0 },
    { id: 'unused', label: t('seller.ordersM3.unused', { defaultValue: '사용 전' }), n: counts.unused, show: hasVoucher || counts.unused > 0 },
    { id: 'done', label: t('seller.ordersM3.done', { defaultValue: '완료' }), n: counts.done, show: true },
    // 취소·환불은 있을 때만 — 0 인 탭을 늘 세워 두면 다섯 칸이 폰 폭을 넘는다.
    { id: 'refunded', label: t('seller.ordersM3.refunded', { defaultValue: '취소·환불' }), n: counts.refunded, show: counts.refunded > 0 || tab === 'refunded' },
    { id: 'all', label: t('seller.all'), show: true },
  ]

  return (
    <div className="md:hidden">
      {/* 🧭 2026-10-06: 줄바꿈 금지·글자 길이만큼 자리는 `SegmentedTabs` 가 지킨다. 숫자는 종전대로 0 이면 숨긴다. */}
      <SegmentedTabs<Tab>
        value={tab}
        onChange={setTab}
        items={TABS.filter((tb) => tb.show).map((tb) => ({ id: tb.id, label: tb.label, count: tb.n != null && tb.n > 0 ? tb.n : undefined }))}
      />

      {groups.length === 0 && (
        <p className="py-16 text-center text-[14px] font-bold text-gray-500">{t('seller.ordersM3.none', { defaultValue: '해당하는 주문이 없어요' })}</p>
      )}

      {groups.map(([key, g]) => (
        <section key={key} className="mt-5">
          <h3 className="mb-2 flex items-baseline justify-between px-1 text-[13px] font-extrabold text-gray-900">
            {g.label}<span className="text-[12px] font-bold text-gray-400">{t('seller.home.soldCount', { defaultValue: '{{count}}건', count: g.rows.length })}</span>
          </h3>
          {/* 타임라인 — 왼쪽 세로 선 + 행마다 점. 점이 브랜드색이면 "지금 사람이 움직여야 하는" 주문이다. */}
          <ol className="relative rounded-[var(--dash-radius,16px)] border border-rule bg-white px-4 py-1 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-rule">
            {g.rows.map(({ o, k }) => {
              const stage = st(o)
              const hot = stage === 'waiting'
              const done = stage === 'done' || stage === 'refunded'
              const isVoucher = orderKindOf(o.order_kind) === 'voucher'
              const unusedN = (o.vouchers ?? []).filter((v) => v.status === 'unused').length
              const pick = o.pickup_date ? kstParts(o.pickup_date) : null
              return (
                <li key={o.order_number} className="relative py-3 pl-6 [&+&]:border-t [&+&]:border-rule">
                  <span aria-hidden className={`absolute left-[-1px] top-[18px] h-[9px] w-[9px] rounded-full border-2 border-white ${hot ? 'bg-brand' : 'bg-gray-300'}`} />
                  <button type="button" onClick={() => onSelect(o)} className="block w-full text-left">
                    <p className="text-[11.5px] font-semibold text-gray-400">{k ? `${k.hh}:${k.mm}` : '-'}{o.order_number ? ` · ${shortOrderNo(o.order_number)}` : ''}</p>
                    <p className={`mt-0.5 text-[15px] font-extrabold ${done ? 'text-gray-500' : 'text-gray-900'}`}>
                      {o.items && o.items.length > 0
                        ? o.items.map((it) => `${it.product_name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ')
                        : (o.shipping_name || o.user_name || '-')}
                    </p>
                    <p className="mt-0.5 text-[13px] text-gray-500">
                      {(o.shipping_name || o.user_name || '-')} · {formatWon(o.total_amount)}
                      {pick && <> · {t('seller.ordersM3.pickupAt', { defaultValue: '사용 예정 {{date}}', date: `${pick.month}/${pick.day}` })}</>}
                      {stage === 'refunded' && <> · {t('seller.ordersM3.refunded', { defaultValue: '취소·환불' })}</>}
                      {stage === 'done' && (isVoucher
                        ? <> · {t('seller.ordersM3.voucherAllUsed', { defaultValue: '사용 완료' })}</>
                        : orderKindOf(o.order_kind) === 'shipping' ? <> · {t('seller.statusDelivered')}</> : null)}
                      {stage === 'unused' && unusedN > 0 && <> · {t('seller.ordersM3.voucherUnusedN', { defaultValue: '미사용 {{count}}장', count: unusedN })}</>}
                    </p>
                  </button>
                  {hot && onConfirm && (
                    <button type="button" disabled={confirming} onClick={() => onConfirm(o)}
                      className="mt-2 rounded-lg bg-brand-tint px-3 py-2 text-xs font-bold text-brand-text disabled:opacity-60">
                      {t('seller.ordersM3.confirm', { defaultValue: '주문 확인' })}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
