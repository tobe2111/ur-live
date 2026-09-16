/**
 * 🧮 오늘 — 홈 첫 블록. D3 밀도·데이터 + B2 합계·매장별 (2026-09-15 대표 확정 — `seller-dashboard-2nd-directions-2026-09.md`).
 *   - 매장 1곳: 스탯 타일 셋(폰) / 넷(PC) — 현재 좌석.
 *   - 매장 2곳 이상: 타일은 **전 매장 합계**, 아래에 매장별 행(오늘 매출·대기·현재 좌석 표시). 행을 누르면 그 좌석으로 전환.
 *   숫자는 전부 훅이 준 값만 그린다. 로딩 중엔 스켈레톤 — 0 을 먼저 보여 주면 "오늘 안 팔렸다"고 읽힌다.
 *   합계는 `useStoresSummary`(사람 기준) 가 주고, 현재 좌석 값은 종전 `/dashboard/stats` 그대로 — 둘의 판정 규칙은 서버에서 같다.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { formatNumber, formatWon } from '@/utils/format'
import { switchStore } from '@/components/seller/StoreSwitcher'
import type { StoresSummary } from './useSellerHome'

interface Props {
  loading: boolean
  storeName: string
  todayRevenue: number
  todayOrders: number
  pendingOrders: number
  withdrawable: number
  /** 🧮 B2: 전 매장 요약. null 이면(실패·매장 없음) 현재 좌석만 그린다. */
  summary?: StoresSummary | null
}

const Skel = () => <span className="inline-block h-6 w-16 animate-pulse rounded bg-gray-200" />
/** D3 스탯 타일 — 라벨 위, 숫자 아래(모노·고정폭). */
const TILE = 'min-w-0 rounded-[var(--dash-radius,16px)] border border-rule bg-white px-3.5 py-3'

export default function TodayTicket({ loading, storeName, todayRevenue, todayOrders, pendingOrders, withdrawable, summary }: Props) {
  const { t, i18n } = useTranslation()
  const [switching, setSwitching] = useState<number | null>(null)
  const today = new Date().toLocaleDateString(i18n.language || 'ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })
  const multi = !!summary && summary.stores.length >= 2
  const rev = multi ? summary!.totals.today_revenue : todayRevenue
  const ord = multi ? summary!.totals.today_orders : todayOrders
  const pend = multi ? summary!.totals.pending : pendingOrders
  const scope = multi
    ? t('seller.home.allStores', { defaultValue: '내 매장 {{count}}곳 전체', count: summary!.stores.length })
    : storeName
  const cells: Array<{ label: string; value: string; hot?: boolean; pcOnly?: boolean }> = [
    { label: t('seller.home.revenue', { defaultValue: '오늘 매출' }), value: formatWon(rev) },
    { label: t('seller.home.orders', { defaultValue: '주문' }), value: formatNumber(ord) },
    { label: t('seller.home.pending', { defaultValue: '처리 대기' }), value: formatNumber(pend), hot: pend > 0 },
    { label: t('seller.home.settleAvail', { defaultValue: '정산 가능' }), value: formatWon(withdrawable), pcOnly: true },
  ]

  async function go(sellerId: number, name: string) {
    if (switching || sellerId === summary?.current_seller_id) return
    setSwitching(sellerId)
    try { await switchStore(sellerId, name) } catch { setSwitching(null) }
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-extrabold text-gray-900">{t('seller.home.today', { defaultValue: '오늘' })}</h2>
        <p className="truncate pl-3 text-[12px] text-gray-500">{today} · {scope}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className={`${TILE} ${c.pcOnly ? 'hidden lg:block' : ''}`}>
            <p className="truncate text-[11.5px] font-semibold text-gray-500">{c.label}</p>
            <p className={`dash-num mt-1 whitespace-nowrap text-[18px] font-extrabold leading-tight lg:text-[22px] ${c.hot ? 'text-brand-text' : 'text-gray-900'}`}>
              {loading ? <Skel /> : c.value}
            </p>
          </div>
        ))}
      </div>

      {multi && (
        <div className="mt-2 overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-[11px] font-semibold text-gray-500">
                <th className="border-b border-rule px-3 py-2 text-left">{t('seller.home.store', { defaultValue: '매장' })}</th>
                <th className="border-b border-rule px-3 py-2 text-right">{t('seller.home.todayWon', { defaultValue: '오늘 ₩' })}</th>
                <th className="border-b border-rule px-3 py-2 text-right">{t('seller.home.pendingShort', { defaultValue: '대기' })}</th>
                <th className="w-8 border-b border-rule" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {summary!.stores.map((s) => {
                const cur = s.seller_id === summary!.current_seller_id
                return (
                  <tr key={s.seller_id} onClick={() => go(s.seller_id, s.name)} className={`${cur ? '' : 'cursor-pointer hover:bg-gray-50'} [&+&>td]:border-t [&+&>td]:border-rule`}>
                    <td className="px-3 py-3 sm:py-2.5">
                      <span className={`block truncate ${cur ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-700'}`}>{s.name}</span>
                      {s.role === 'operator' && <span className="text-[10.5px] text-gray-400">{t('seller.home.delegated', { defaultValue: '위임 운영' })}</span>}
                    </td>
                    <td className="dash-num px-3 py-3 text-right font-semibold text-gray-900 sm:py-2.5">{formatNumber(s.today_revenue)}</td>
                    <td className={`dash-num px-3 py-3 text-right font-bold sm:py-2.5 ${s.pending > 0 ? 'text-brand-text' : 'text-gray-400'}`}>{s.pending}</td>
                    <td className="pr-3 text-right text-gray-400">
                      {switching === s.seller_id ? <Loader2 size={14} className="inline animate-spin" /> : cur ? <Check size={14} className="inline text-gray-900" /> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
