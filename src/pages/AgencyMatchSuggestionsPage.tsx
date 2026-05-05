/**
 * 에이전시 매칭 제안 관리 페이지 (2026-05-05)
 *
 * 자동 매칭 cron (agency-seller-match.ts) 이 생성한 pending 제안을
 * 에이전시가 수락 / 거절합니다.
 *
 * API: /api/agency/match-suggestions
 */

import { useEffect, useState } from 'react'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { UserPlus, CheckCircle2, XCircle, Clock, TrendingUp, Star } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

interface MatchSuggestion {
  id: number
  seller_id: number
  seller_name: string
  business_name: string
  seller_email: string
  seller_created_at: string
  seller_tier: string
  seller_tier_score: number
  score: number
  status: string
  match_reason: Record<string, number> | null
  created_at: string
  expires_at: string
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000)
}

function hoursLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '만료'
  const h = Math.floor(diff / 3600_000)
  const d = Math.floor(h / 24)
  return d > 0 ? `${d}일` : `${h}시간`
}

const TIER_LABEL: Record<string, string> = {
  diamond: '💎 다이아', gold: '⭐ 골드', silver: '🥈 실버', bronze: '🥉 브론즈', new: '🆕 신규',
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
        <span>{label}</span>
        <span>{value.toFixed(0)}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full">
        <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  )
}

function SuggestionCard({ s, onAccept, onDecline }: {
  s: MatchSuggestion
  onAccept: (id: number) => void
  onDecline: (id: number) => void
}) {
  const reason = s.match_reason
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[14px] font-bold text-gray-900">{s.business_name || s.seller_name}</p>
          <p className="text-[12px] text-gray-500">{s.seller_email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {TIER_LABEL[s.seller_tier] ?? s.seller_tier}
            </span>
            <span className="text-[11px] text-gray-500">가입 {daysSince(s.seller_created_at)}일차</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-[22px] font-black text-blue-600">{s.score}</div>
          <div className="text-[10px] text-gray-400">매칭 점수</div>
        </div>
      </div>

      {reason && (
        <div className="space-y-1.5 mb-3">
          {reason.tierScore !== undefined && <ScoreBar label="에이전시 티어" value={reason.tierScore} max={40} />}
          {reason.capacityScore !== undefined && <ScoreBar label="여유 용량" value={reason.capacityScore} max={30} />}
          {reason.activityScore !== undefined && <ScoreBar label="활성도" value={reason.activityScore} max={20} />}
          {reason.acceptScore !== undefined && <ScoreBar label="수락 이력" value={reason.acceptScore} max={10} />}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <Clock className="w-3 h-3" />
          <span>만료까지 {hoursLeft(s.expires_at)}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDecline(s.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />거절
          </button>
          <button
            type="button"
            onClick={() => onAccept(s.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />수락
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgencyMatchSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('agency_token') || ''

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/agency/match-suggestions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSuggestions(res.data?.suggestions ?? [])
    } catch {
      toast.error('제안 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAccept = async (id: number) => {
    try {
      await api.post(`/api/agency/match-suggestions/${id}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('셀러를 수락했습니다. 이제 담당 셀러 목록에 추가됩니다.')
      setSuggestions(prev => prev.filter(s => s.id !== id))
    } catch {
      toast.error('수락에 실패했습니다.')
    }
  }

  const handleDecline = async (id: number) => {
    try {
      await api.post(`/api/agency/match-suggestions/${id}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('제안을 거절했습니다.')
      setSuggestions(prev => prev.filter(s => s.id !== id))
    } catch {
      toast.error('거절에 실패했습니다.')
    }
  }

  return (
    <AgencyLayout title="매칭 제안">
      <DashboardPageHeader
        title="신규 셀러 매칭 제안"
        subtitle="자동 매칭 시스템이 추천한 신규 셀러입니다. 수락하면 담당 셀러로 등록됩니다."
        icon={<UserPlus className="w-5 h-5" />}
      />

      {loading ? (
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 bg-white rounded-2xl border border-gray-200 animate-pulse" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="mt-8 text-center">
          <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-[14px]">현재 대기 중인 매칭 제안이 없습니다.</p>
          <p className="text-gray-400 text-[12px] mt-1">새 신규 셀러가 가입하면 자동으로 제안됩니다.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-4 mb-3">
            <span className="text-[13px] font-semibold text-gray-900">
              대기 중인 제안 {suggestions.length}건
            </span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="space-y-3">
            {suggestions.map(s => (
              <SuggestionCard key={s.id} s={s} onAccept={handleAccept} onDecline={handleDecline} />
            ))}
          </div>
        </>
      )}
    </AgencyLayout>
  )
}
