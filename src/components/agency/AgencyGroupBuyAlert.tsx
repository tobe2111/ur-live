/**
 * 🛡️ 2026-05-15: 에이전시 대시보드 메인 — 본인 셀러망 공구 alert.
 *
 * 표시:
 *   - churn risk 셀러 (last 14일 등록 X)
 *   - 미달성 위험 공구 (24h + 50%-)
 *   - 미해결 분쟁
 *
 * 클릭 → /agency/group-buy 또는 /agency/sellers
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Users, ChevronRight, Ticket } from 'lucide-react'
import api from '@/lib/api'

interface AgencyAlert {
  churn_sellers: number
  at_risk_groups: number
  active_groups: number
  pending_disputes: number
}

export default function AgencyGroupBuyAlert() {
  const navigate = useNavigate()
  const [data, setData] = useState<AgencyAlert | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }
    // 에이전시 본인 셀러망 데이터 — TODO: /api/agency/group-buy/overview endpoint 가 이상적
    // 우선 기존 endpoints 활용
    Promise.all([
      api.get('/api/agency/sellers', { headers }).catch(() => ({ data: { data: [] } })),
    ]).then(([sellersRes]) => {
      const sellers = sellersRes.data?.data || []
      // churn signal: notifications 중 type='seller_churn_risk' 카운트
      // 단순화: 그냥 셀러 수 표시 (실제 churn 은 daily cron 결과)
      setData({
        churn_sellers: 0,  // TODO: notifications 조회 시 실제값
        at_risk_groups: 0,
        active_groups: sellers.length,
        pending_disputes: 0,
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading || !data || (data.churn_sellers === 0 && data.at_risk_groups === 0 && data.pending_disputes === 0)) {
    return null
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> 즉시 액션 필요
        </h3>
      </div>

      <div className="space-y-2">
        {data.churn_sellers > 0 && (
          <button
            onClick={() => navigate('/agency/sellers')}
            className="w-full bg-white rounded-xl p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <Users className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-gray-900">{data.churn_sellers}명 셀러 — 14일+ 미활동</p>
              <p className="text-[10px] text-gray-500 mt-0.5">연락 권장 (등록 격려 / 메뉴 변경 제안)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        )}

        {data.at_risk_groups > 0 && (
          <button
            onClick={() => navigate('/agency/group-buy')}
            className="w-full bg-white rounded-xl p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <Ticket className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-gray-900">{data.at_risk_groups}개 공구 — 미달성 위험</p>
              <p className="text-[10px] text-gray-500 mt-0.5">24h 이내 마감 + 진행률 50% 미만 — share 부스트 권장</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        )}

        {data.pending_disputes > 0 && (
          <button
            onClick={() => navigate('/agency/group-buy')}
            className="w-full bg-white rounded-xl p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-gray-900">{data.pending_disputes}건 미해결 분쟁</p>
              <p className="text-[10px] text-gray-500 mt-0.5">셀러 측 응대 필요</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  )
}
