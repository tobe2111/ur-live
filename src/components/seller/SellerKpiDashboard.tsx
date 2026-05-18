/**
 * 🛡️ 2026-05-15: 셀러 KPI 통합 대시보드 위젯.
 *
 * SellerPage 메인에 압축 카드로 표시:
 *   - 단골 수 (+ 7일 신규)
 *   - 진행 중 공구 (active)
 *   - 이번 달 매출 (예상)
 *   - 미해결 분쟁
 *
 * 클릭 시 각 detail 페이지 이동.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Ticket, DollarSign, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import { formatNumber } from '@/utils/format'

interface KpiData {
  followers: { total: number; recent_7d: number }
  active_groups: number
  monthly_revenue_est: number
  pending_disputes: number
}

export default function SellerKpiDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getSellerToken()}` }
    Promise.all([
      api.get('/api/seller-public/seller/analytics', { headers }).catch(() => ({ data: { data: null } })),
      api.get('/api/seller/products?category=meal_voucher', { headers }).catch(() => ({ data: { data: [] } })),
      api.get('/api/disputes/seller/pending', { headers }).catch(() => ({ data: { data: { summary: { escalated: 0 } } } })),
    ]).then(([analyticsRes, productsRes, disputesRes]) => {
      const analytics = analyticsRes.data?.data
      const products = productsRes.data?.data || []
      const VOUCHER = ['meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher']
      const vouchers = products.filter((p: { category?: string }) => VOUCHER.includes(p.category || ''))
      const active = vouchers.filter((p: { group_buy_status?: string }) => p.group_buy_status === 'active').length

      // 이번 달 GMV (active + achieved 의 진행 합계 × 95% 셀러 수령)
      const monthlyEst = vouchers.reduce((sum: number, p: { price?: number; group_buy_current?: number; updated_at?: string }) => {
        if (!p.updated_at) return sum
        const updated = new Date(p.updated_at)
        const now = new Date()
        if (updated.getFullYear() === now.getFullYear() && updated.getMonth() === now.getMonth()) {
          return sum + ((p.price ?? 0) * (p.group_buy_current ?? 0))
        }
        return sum
      }, 0)
      const monthlyNet = Math.round(monthlyEst * 0.95)

      const recent7 = (analytics?.daily || []).slice(0, 7).reduce((s: number, d: { new_count: number }) => s + d.new_count, 0)

      setData({
        followers: {
          total: Number(analytics?.total ?? 0),
          recent_7d: recent7,
        },
        active_groups: active,
        monthly_revenue_est: monthlyNet,
        pending_disputes: Number(disputesRes.data?.data?.summary?.escalated ?? 0),
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null
  // 전부 0 이면 hide (신규 셀러는 OnboardingChecklist 가 보임)
  if (data.followers.total === 0 && data.active_groups === 0 && data.monthly_revenue_est === 0 && data.pending_disputes === 0) {
    return null
  }

  const items = [
    {
      icon: Users,
      label: t('seller.kpi.followers', { defaultValue: '단골' }),
      value: data.followers.total,
      sub: data.followers.recent_7d > 0
        ? t('seller.kpi.followersRecent', { defaultValue: '+{{n}}/7일', n: data.followers.recent_7d })
        : t('seller.kpi.followersNoneRecent', { defaultValue: '신규 0' }),
      color: 'text-pink-600',
      bg: 'bg-pink-50',
      path: '/seller/followers',
    },
    {
      icon: Ticket,
      label: t('seller.kpi.activeGroups', { defaultValue: '진행 공구' }),
      value: data.active_groups,
      sub: t('seller.kpi.unitCount', { defaultValue: '개' }),
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/seller/group-buy',
    },
    {
      icon: DollarSign,
      label: t('seller.kpi.thisMonth', { defaultValue: '이번 달' }),
      value: data.monthly_revenue_est,
      sub: t('seller.kpi.unitWon', { defaultValue: '원' }),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/seller/settlement',
      isMoney: true,
    },
    {
      icon: AlertTriangle,
      label: t('seller.kpi.disputes', { defaultValue: '분쟁' }),
      value: data.pending_disputes,
      sub: data.pending_disputes > 0
        ? t('seller.kpi.disputesPending', { defaultValue: '검토 대기' })
        : t('seller.kpi.disputesNone', { defaultValue: '없음' }),
      color: data.pending_disputes > 0 ? 'text-amber-600' : 'text-gray-400',
      bg: data.pending_disputes > 0 ? 'bg-amber-50' : 'bg-gray-50',
      path: '/seller/group-buy',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-pink-500" /> KPI
        </h3>
        <span className="text-[10px] text-gray-400">{t('seller.kpi.realtime', { defaultValue: '실시간' })}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`${item.bg} rounded-xl p-3 text-left transition-transform hover:scale-[1.02] active:scale-100`}
          >
            <div className="flex items-center justify-between mb-1">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <ChevronRight className="w-3 h-3 text-gray-300" />
            </div>
            <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
            <p className={`text-lg font-extrabold ${item.color} mt-0.5`}>
              {item.isMoney
                ? (item.value >= 10000 ? `${(item.value / 10000).toFixed(1)}만` : formatNumber(item.value))
                : formatNumber(item.value)}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
