/**
 * 🎯 안 C 의 "데이터가 있을 때" 절반 — 안 B 구조(2026-09-15 대표 확정).
 *
 * 바뀐 것은 스킨이 아니라 **순서**다:
 *   · 질문은 **기간 하나**만 먼저. 나머지는 답이 나온 뒤에 묻는다(탭 6개 → 목록의 줄).
 *   · 주인공은 **숫자 하나**(기간 매출). 카드 넷에 흩어져 있던 보조 지표는 그 밑 한 줄로 내려간다.
 *   · 다른 화면으로 가는 길은 버튼이 아니라 **목록의 줄** — 버튼 여섯 줄보다 스크롤 한 번이 싸다.
 *
 * ⚠️ 이 파일은 **표시 전용**이다. 집계는 호출부가 서버 응답으로 한다.
 */
import { Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart2, Users, ChevronRight, Gift, Calendar, TrendingUp, Loader2 } from 'lucide-react'
import { formatWon } from '@/utils/format'
import { NoSalesInWindow } from './NoSalesYet'

const SellerAnalyticsChart = lazy(() => import('@/components/charts/SellerAnalyticsChart'))

export interface RevenuePoint { date: string; revenue: number; orders: number }
export type SubView = 'customers' | 'products' | 'commission' | 'monthly' | 'funnel'

interface Props {
  days: number
  onDays: (d: number) => void
  points: RevenuePoint[]
  revenue: number
  orders: number
  buyers: number
  repeatRate: number
  conversionRate: number
  showMore: boolean
  onShowMore: () => void
  onOpen: (v: SubView) => void
}

const CARD = 'rounded-[var(--dash-radius,16px)] border border-rule bg-white'

export default function AnalyticsOverview(p: Props) {
  const { t } = useTranslation()

  // 🔤 한 줄 요약 — 조각을 배열로 만들고 마지막에 한 번만 잇는다(원문에 구분자를 늘어놓지 않는다).
  const summary = [
    t('seller.analyticsView.sumOrders', { n: p.orders, defaultValue: '주문 {{n}}건' }),
    t('seller.analyticsView.sumBuyers', { n: p.buyers, defaultValue: '고객 {{n}}명' }),
    t('seller.analyticsView.sumRepeat', { n: p.repeatRate, defaultValue: '재구매 {{n}}%' }),
    t('seller.analyticsView.sumConversion', { n: p.conversionRate, defaultValue: '전환 {{n}}%' }),
  ].join(' · ')

  const rows: { key: SubView; icon: typeof Users; label: string; hint: string; extra?: boolean }[] = [
    { key: 'customers', icon: Users, label: t('seller.customerAnalysis'), hint: t('seller.analyticsView.sumBuyers', { n: p.buyers, defaultValue: '고객 {{n}}명' }) },
    { key: 'products', icon: BarChart2, label: t('seller.productPerformance'), hint: t('seller.analyticsView.sumOrders', { n: p.orders, defaultValue: '주문 {{n}}건' }) },
    { key: 'commission', icon: Gift, label: t('seller.analyticsView.rowCommission', { defaultValue: '추천 수익' }), hint: '', extra: true },
    { key: 'monthly', icon: Calendar, label: t('seller.analyticsView.rowMonthly', { defaultValue: '월별 입점 추이' }), hint: '', extra: true },
    { key: 'funnel', icon: TrendingUp, label: t('seller.analyticsView.rowFunnel', { defaultValue: '유입 경로' }), hint: '', extra: true },
  ]
  const visible = rows.filter(r => !r.extra || p.showMore)
  const windowEmpty = p.revenue === 0 && p.orders === 0

  return (
    <div className="space-y-4">
      {/* 질문은 하나만 — 기간 */}
      <div className={`flex p-1 ${CARD}`} role="group">
        {[7, 30, 90].map(d => (
          <button key={d} type="button" onClick={() => p.onDays(d)} aria-pressed={p.days === d}
            className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${p.days === d ? 'bg-brand text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            {t('seller.analyticsView.daysLabel', { n: d, defaultValue: '{{n}}일' })}
          </button>
        ))}
      </div>

      {/* 🔑 이 기간에 판 게 없으면 **재는 도구를 그리지 않는다** — 큰 0 과 빈 차트 대신 다음 행동 하나.
          기간 선택은 위에 그대로 남는다(안 그러면 다른 기간으로 갈 길이 없어진다). */}
      {windowEmpty ? (
        <NoSalesInWindow days={p.days} onWiden={() => p.onDays(90)} />
      ) : (
        <>
          {/* 주인공은 숫자 하나 */}
          <div>
            <p className="text-[12.5px] font-semibold text-gray-400">
              {t('seller.analyticsView.windowRevenue', { days: p.days, defaultValue: '최근 {{days}}일 매출' })}
            </p>
            <p className="dash-num text-[32px] font-extrabold leading-tight tracking-tight text-gray-900">{formatWon(p.revenue)}</p>
            <p className="mt-1 text-[12.5px] text-gray-500">{summary}</p>
          </div>

          <div className={`${CARD} p-4`}>
            {p.points.length > 0 ? (
              <Suspense fallback={<div className="flex h-[240px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-text" /></div>}>
                <SellerAnalyticsChart data={p.points.slice(-30)} />
              </Suspense>
            ) : (
              <p className="py-8 text-center text-xs text-gray-500">{t('seller.noRevenueData')}</p>
            )}
          </div>
        </>
      )}

      {/* 나머지 화면은 목록의 줄로 */}
      <div className={`overflow-hidden ${CARD}`}>
        {visible.map(r => (
          <button key={r.key} type="button" onClick={() => p.onOpen(r.key)}
            className="flex w-full items-center gap-3 border-b border-rule px-4 py-3 text-left last:border-b-0 hover:bg-gray-50">
            <r.icon className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-[13px] font-bold text-gray-900">{r.label}</span>
            {r.hint && <span className="text-[12px] text-gray-400">{r.hint}</span>}
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>
        ))}
        {!p.showMore && (
          <button type="button" onClick={p.onShowMore} className="w-full border-t border-rule px-4 py-2.5 text-[12px] font-bold text-gray-500 hover:bg-gray-50">
            {t('seller.analyticsView.more', { defaultValue: '더 보기 (추천 수익, 입점 추이, 유입 경로)' })}
          </button>
        )}
      </div>
    </div>
  )
}
