/**
 * 📈 이번 주 — 홈 마지막 블록 (M2 시안 · 2026-09-14). 폰은 한 줄(매출 · 주문 N건 · 지난주 대비), PC 는 그 아래 7일 차트.
 *   차트는 `LazyChart`(recharts 지연 로드) — 폰에서는 안 그린다(번들·세로 공간 모두 아깝다).
 */
import { Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { formatWon } from '@/utils/format'
import LazyChart from './LazyChart'

interface Props {
  revenue: number
  orders: number
  delta: number
  week7: { date: string; sales: number; orders: number }[]
  hasDaily: boolean
}

export default function WeekSummary({ revenue, orders, delta, week7, hasDaily }: Props) {
  const { t } = useTranslation()
  const deltaText = `${delta >= 0 ? '+' : ''}${delta}%`
  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-extrabold text-gray-900">
        {t('seller.home.thisWeek', { defaultValue: '이번 주' })}
        <Link to="/seller/analytics" className="text-[12px] font-bold text-brand-text">{t('seller.home.seePerf', { defaultValue: '성과 보기' })}</Link>
      </h2>
      <div className="rounded-2xl border border-rule bg-white">
        <Link to="/seller/analytics" className="flex items-center gap-3 px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[20px] font-extrabold tracking-tight text-gray-900 lg:text-[24px]">{formatWon(revenue)}</span>
            <span className="block text-[12px] text-gray-400">
              {t('seller.home.weekOrders', { defaultValue: '주문 {{count}}건', count: orders })}
              {hasDaily && <> · {t('seller.home.vsLastWeek', { defaultValue: '지난주보다' })} <em className={`not-italic font-bold ${delta >= 0 ? 'text-brand-text' : 'text-tone-bad'}`}>{deltaText}</em></>}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-gray-300" />
        </Link>
        {hasDaily && (
          <div className="hidden border-t border-rule px-3 pb-3 pt-2 lg:block" style={{ height: 200 }}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-400">{t('seller.chartLoading')}</div>}>
              <LazyChart data={week7} salesLabel={t('seller.sales')} ordersLabel={t('seller.order')} />
            </Suspense>
          </div>
        )}
      </div>
    </section>
  )
}
