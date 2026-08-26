/**
 * 💡 대시보드 인사이트 배너 — 데이터에서 자동 파생되는 "지금 할 일" (SellerPage 에서 추출, 2026-08-26)
 *   추출 사유: SellerPage 가 파일크기 래칫(600줄)을 넘어섬. 계산(useMemo)과 렌더가 한 덩어리라
 *   통째로 옮겨도 호출부는 `<InsightsCallouts stats dailyStats />` 한 줄이 된다. 로직 불변.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, TrendingUp, DollarSign } from 'lucide-react'
import type { DashboardStats, DailyStats } from './types'

type InsightSeverity = 'high' | 'medium' | 'info'
type InsightIcon = typeof Package | typeof TrendingUp | typeof DollarSign

interface Insight {
  severity: InsightSeverity
  icon: InsightIcon
  title: string
  description?: string
  action?: { label: string; path: string }
}

interface Props {
  stats: DashboardStats
  dailyStats: DailyStats[]
  fmtPrice: (n: number) => string
}

export default function InsightsCallouts({ stats, dailyStats, fmtPrice }: Props) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = []

    // 1) 미처리 주문 ≥ 5
    if ((stats.pendingOrders || 0) >= 5) {
      list.push({
        severity: 'high',
        icon: Package,
        title: t('seller.insightPendingOrdersTitle', { count: stats.pendingOrders }),
        description: t('seller.insightPendingOrdersDesc'),
        action: { label: t('seller.insightManageOrders'), path: '/seller/orders' },
      })
    }

    // 🗑️ 2026-08-23 (대표): 재고 부족 인사이트 제거 — 쇼핑 재고 레일 잔재, 이용권 콘솔에 무의미.

    // 3) 오늘 매출 > 어제 매출 * 1.2  (dailyStats 마지막 2개 비교)
    if (dailyStats.length >= 2) {
      const todayRevenue = dailyStats[dailyStats.length - 1]?.sales || 0
      const yesterdayRevenue = dailyStats[dailyStats.length - 2]?.sales || 0
      if (yesterdayRevenue > 0 && todayRevenue > yesterdayRevenue * 1.2) {
        const pct = Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        list.push({
          severity: 'info',
          icon: TrendingUp,
          title: t('seller.insightRevenueUpTitle'),
          description: t('seller.insightRevenueUpDesc', { pct }),
        })
      }
    }

    // 4) 등록된 상품이 없음 (totalProducts === 0) — 등록 동선은 이용권 위저드로.
    if ((stats.totalProducts ?? -1) === 0) {
      list.push({
        severity: 'high',
        icon: Package,
        title: t('seller.insightNoProductsTitle'),
        description: t('seller.insightNoProductsDesc'),
        action: { label: t('seller.insightRegisterProduct'), path: '/seller/meal-voucher/new' },
      })
    }

    // 5) 정산 신청 가능 > 0
    const settlementAvailable = stats.pendingSettlement ?? 0
    if (settlementAvailable > 0) {
      list.push({
        severity: 'info',
        icon: DollarSign,
        title: t('seller.insightSettlementTitle', { amount: fmtPrice(settlementAvailable) }),
        description: t('seller.insightSettlementDesc'),
        action: { label: t('seller.insightSettlement'), path: '/seller/settlements' },
      })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, dailyStats, t, i18n.language])

  if (insights.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {insights.map((insight, i) => (
        <div key={i} className={`rounded-xl p-3 flex items-start gap-3 ${insight.severity === 'high' ? 'bg-red-50 border border-red-200' : insight.severity === 'medium' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${insight.severity === 'high' ? 'bg-red-100' : insight.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'}`}>
            <insight.icon className={`w-4 h-4 ${insight.severity === 'high' ? 'text-red-600' : insight.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold text-gray-900">{insight.title}</p>
            {insight.description && <p className="text-[11px] text-gray-600 mt-0.5">{insight.description}</p>}
          </div>
          {insight.action && (
            <button onClick={() => navigate(insight.action!.path)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 shrink-0">
              {insight.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
