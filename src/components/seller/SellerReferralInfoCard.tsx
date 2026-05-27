/**
 * 🛡️ 2026-05-27 (사용자 결정 — 투명성): 셀러 dashboard 에 본인 영입자 + commission 분배 표시.
 *
 * "@영업자 가 나를 영입 — 6개월간 commission X% 추가 차감" 명시.
 * 사장님이 본인 commission 분배를 정확히 이해 → 투명성 ↑.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'

interface ReferralInfo {
  introduced_by_agency_id: string | null
  introduced_by_influencer_id: string | null
  introduced_at: string | null
  referral_bonus_until: string | null
  agency_name?: string
  influencer_handle?: string
  agency_commission_pct?: number
  influencer_commission_pct?: number
  bonus_pct?: number
}

export default function SellerReferralInfoCard() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getSellerToken()}` }
    api.get('/api/seller/referral-info', { headers })
      .then(r => { if (r.data?.success) setInfo(r.data.data) })
      .catch(() => { /* graceful — 영입자 없을 수도 */ })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !info) return null
  if (!info.introduced_by_agency_id && !info.introduced_by_influencer_id) return null

  const isAgency = !!info.introduced_by_agency_id
  const introducerName = isAgency
    ? (info.agency_name || `에이전시 #${info.introduced_by_agency_id}`)
    : (info.influencer_handle ? `@${info.influencer_handle}` : `인플루언서 #${info.introduced_by_influencer_id}`)
  const commissionPct = isAgency ? (info.agency_commission_pct ?? 2) : (info.influencer_commission_pct ?? 1)
  const bonusPct = info.bonus_pct ?? 1
  const isActive = info.referral_bonus_until
    ? new Date(info.referral_bonus_until) > new Date()
    : false

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{isAgency ? '🏢' : '🎤'}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">
            {isAgency ? '소속 에이전시' : '영입 인플루언서'}: {introducerName}
          </p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            매출의 <strong className="text-blue-700">{commissionPct}%</strong> 가 영업 commission 으로 차감됩니다.
            {isActive && (
              <>
                {' '}<strong className="text-pink-700">+ {bonusPct}% 영입 보너스</strong>
                {info.referral_bonus_until && (
                  <span className="text-gray-500"> (~{new Date(info.referral_bonus_until).toLocaleDateString('ko-KR')})</span>
                )}
              </>
            )}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            나머지는 매장 정산금. 자세한 분배는 매월 정산 상세 페이지에서 확인.
          </p>
        </div>
      </div>
    </div>
  )
}
