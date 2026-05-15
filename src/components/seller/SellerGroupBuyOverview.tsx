/**
 * 🛡️ 2026-05-15: 셀러 대시보드 메인에 공구 진행 현황 카드 — 공구 플로우 진입점.
 *
 * 표시:
 *   - 진행 중 공구 N개 (active)
 *   - 마감 임박 (24시간 이내) 갯수
 *   - 미달성 위험 (deadline 24h + progress < 50%)
 *   - 미해결 분쟁 갯수
 *
 * 클릭 시 /seller/group-buy 또는 /seller/disputes (TBD)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import { VOUCHER_CATEGORY_SET } from '@/shared/constants/voucher-categories'

interface Overview {
  active: number
  closing_soon: number
  at_risk: number
  pending_disputes: number
  next_payout_estimate: number | null
}

export default function SellerGroupBuyOverview() {
  const navigate = useNavigate()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getSellerToken()}` }
    Promise.all([
      api.get('/api/seller/products?category=meal_voucher', { headers }).catch(() => ({ data: { data: [] } })),
      api.get('/api/disputes/seller/pending', { headers }).catch(() => ({ data: { data: { summary: { total: 0 } } } })),
    ]).then(([prodRes, disputeRes]) => {
      const products = prodRes.data?.data || []
      const vouchers = products.filter((p: { category?: string }) => VOUCHER_CATEGORY_SET.has(p.category || ''))
      const now = Date.now()
      const active = vouchers.filter((p: { group_buy_status?: string }) => p.group_buy_status === 'active').length
      const closingSoon = vouchers.filter((p: { group_buy_deadline?: string; group_buy_status?: string }) => {
        if (p.group_buy_status !== 'active' || !p.group_buy_deadline) return false
        const ms = new Date(p.group_buy_deadline).getTime() - now
        return ms > 0 && ms < 24 * 3600 * 1000
      }).length
      const atRisk = vouchers.filter((p: { group_buy_deadline?: string; group_buy_status?: string; group_buy_target?: number; group_buy_current?: number }) => {
        if (p.group_buy_status !== 'active' || !p.group_buy_deadline) return false
        const ms = new Date(p.group_buy_deadline).getTime() - now
        if (ms <= 0 || ms > 24 * 3600 * 1000) return false
        const progress = (p.group_buy_target ?? 0) > 0 ? (p.group_buy_current ?? 0) / (p.group_buy_target ?? 1) : 0
        return progress < 0.5
      }).length
      const ongoing = vouchers.reduce((s: number, p: { price?: number; group_buy_current?: number }) =>
        s + ((p.price ?? 0) * (p.group_buy_current ?? 0)), 0)
      const nextPayoutEstimate = Math.round(ongoing * 0.95)
      const pendingDisputes = Number(disputeRes.data?.data?.summary?.escalated ?? 0)

      setData({
        active, closing_soon: closingSoon, at_risk: atRisk,
        pending_disputes: pendingDisputes,
        next_payout_estimate: nextPayoutEstimate,
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading || !data || data.active === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-pink-500" /> 공구 진행 현황
        </h3>
        <button
          onClick={() => navigate('/seller/group-buy')}
          className="text-[11px] text-pink-500 font-bold flex items-center gap-0.5 hover:underline"
        >
          전체 관리 <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/seller/group-buy')}
          className="bg-blue-50 rounded-xl p-3 text-left hover:bg-blue-100 transition-colors"
        >
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">진행중</p>
          <p className="text-2xl font-extrabold text-blue-700 mt-0.5">{data.active}</p>
          <p className="text-[10px] text-gray-500 mt-1">공구 active</p>
        </button>

        <button
          onClick={() => navigate('/seller/group-buy')}
          className={`rounded-xl p-3 text-left transition-colors ${data.at_risk > 0 ? 'bg-red-50 hover:bg-red-100' : 'bg-amber-50 hover:bg-amber-100'}`}
        >
          <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${data.at_risk > 0 ? 'text-red-600' : 'text-amber-600'}`}>
            {data.at_risk > 0 ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {data.at_risk > 0 ? '⚠️ 미달성 위험' : '마감 임박'}
          </p>
          <p className={`text-2xl font-extrabold mt-0.5 ${data.at_risk > 0 ? 'text-red-700' : 'text-amber-700'}`}>{data.at_risk > 0 ? data.at_risk : data.closing_soon}</p>
          <p className="text-[10px] text-gray-500 mt-1">{data.at_risk > 0 ? '24h+ 진행률 50%-' : '24시간 이내'}</p>
        </button>
      </div>

      {data.next_payout_estimate !== null && data.next_payout_estimate > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">예상 정산액 (진행 중 합계)</span>
            <span className="font-extrabold text-emerald-600">₩{data.next_payout_estimate.toLocaleString('ko-KR')}</span>
          </div>
        </div>
      )}

      {/* 위험 액션 — at_risk 1개+ 일 때 push to share */}
      {data.at_risk > 0 && (
        <button
          onClick={() => navigate('/seller/group-buy')}
          className="w-full mt-3 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {data.at_risk}개 공구 — 지금 share 하면 살릴 수 있어요
        </button>
      )}

      {/* 분쟁 알림 */}
      {data.pending_disputes > 0 && (
        <button
          onClick={() => navigate('/seller/group-buy')}
          className="w-full mt-2 px-4 py-2.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {data.pending_disputes}건 분쟁 진행 중 — 어드민 검토 대기
        </button>
      )}
    </div>
  )
}
