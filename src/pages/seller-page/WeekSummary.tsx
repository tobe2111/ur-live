/**
 * 📈 이번 주 — 홈 마지막 블록 (M2 시안 · 2026-09-14). 폰은 한 줄(매출 · 주문 N건 · 지난주 대비), PC 는 그 아래 7일 차트.
 *   🧮 2026-09-15 D3: 차트(LazyChart) 대신 PC 일별 표 — 숫자를 읽는 화면. 차트는 /seller/analytics 가 맡는다.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { formatNumber, formatWon } from '@/utils/format'

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
      <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
        <Link to="/seller/analytics" className="flex items-center gap-3 px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="dash-num block text-[20px] font-extrabold tracking-tight text-gray-900 lg:text-[22px]">{formatWon(revenue)}</span>
            <span className="block text-[12px] text-gray-400">
              {t('seller.home.weekOrders', { defaultValue: '주문 {{count}}건', count: orders })}
              {hasDaily && <> · {t('seller.home.vsLastWeek', { defaultValue: '지난주보다' })} <em className={`not-italic font-bold ${delta >= 0 ? 'text-brand-text' : 'text-tone-bad'}`}>{deltaText}</em></>}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-gray-300" />
        </Link>
        {/* 📱 2026-09-15 모바일 특화: 폰은 7일 미니 막대(div 7개 — 라이브러리 0, 한눈에 흐름). 마지막 막대 = 오늘(브랜드). */}
        {hasDaily && week7.length > 0 && (
          <div className="flex items-end gap-1 border-t border-rule px-4 pb-3 pt-2.5 lg:hidden" aria-hidden>
            {(() => { const max = Math.max(1, ...week7.map((d) => d.sales)); return week7.map((d, i) => (
              <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-9 w-full items-end">
                  <div className={`w-full rounded-sm ${i === week7.length - 1 ? 'bg-brand' : 'bg-gray-200'}`} style={{ height: `${Math.max(6, Math.round((d.sales / max) * 100))}%` }} />
                </div>
                <span className="text-[9.5px] leading-none text-gray-400">{d.date.slice(-2)}</span>
              </div>
            )) })()}
          </div>
        )}
        {/* 🧮 D3 (2026-09-15): PC 는 차트 대신 일별 표 — 숫자를 읽는 화면. 차트는 성과 페이지(/seller/analytics)가 맡는다. */}
        {hasDaily && (
          <table className="hidden w-full border-collapse border-t border-rule text-[12.5px] lg:table">
            <thead>
              <tr className="text-[11px] font-semibold text-gray-500">
                <th className="border-b border-rule px-4 py-2 text-left">{t('seller.home.date', { defaultValue: '날짜' })}</th>
                <th className="border-b border-rule px-4 py-2 text-right">{t('seller.home.revenueWon', { defaultValue: '매출 ₩' })}</th>
              </tr>
            </thead>
            <tbody>
              {week7.map((d, i) => (
                <tr key={d.date} className={i === week7.length - 1 ? 'font-bold' : ''}>
                  <td className={`px-4 py-1.5 text-gray-700 ${i > 0 ? 'border-t border-rule' : ''}`}>{d.date}</td>
                  <td className={`dash-num px-4 py-1.5 text-right text-gray-900 ${i > 0 ? 'border-t border-rule' : ''}`}>{formatNumber(d.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
