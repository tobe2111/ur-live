/**
 * 셀러 등급 배지 (2026-05-05) — diamond/gold/silver/bronze/new
 *
 * Migration 0244 의 sellers.tier 컬럼을 시각화.
 * 등급별 수수료/노출/혜택 안내 + 다음 등급까지의 score 격차.
 */
import { useEffect, useState } from 'react'
import { TrendingUp, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'

type Tier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'new'

interface TierInfo {
  tier: Tier
  tier_score: number
  exposure_weight: number
  commission_rate: number
}

const TIER_META: Record<Tier, { label: string; emoji: string; color: string; bg: string; border: string; nextScore?: number; benefits: string[] }> = {
  diamond: {
    label: '다이아몬드',
    emoji: '💎',
    color: 'text-blue-700',
    bg: 'bg-gradient-to-br from-blue-100 to-cyan-50',
    border: 'border-blue-300',
    benefits: ['수수료 3% (최저)', '노출 가중치 4×', 'TimeDeal 무제한', '메인 hero 우선', '알림톡 1만건/월 무료'],
  },
  gold: {
    label: '골드',
    emoji: '⭐',
    color: 'text-amber-700',
    bg: 'bg-gradient-to-br from-amber-100 to-yellow-50',
    border: 'border-amber-300',
    nextScore: 85,
    benefits: ['수수료 4%', '노출 가중치 2.5×', 'TimeDeal 일 5회', '카테고리 상위'],
  },
  silver: {
    label: '실버',
    emoji: '🥈',
    color: 'text-gray-700',
    bg: 'bg-gradient-to-br from-gray-100 to-slate-50',
    border: 'border-gray-300',
    nextScore: 70,
    benefits: ['수수료 5%', '노출 가중치 1.5×', 'TimeDeal 일 2회'],
  },
  bronze: {
    label: '브론즈',
    emoji: '🥉',
    color: 'text-orange-700',
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
    border: 'border-orange-200',
    nextScore: 50,
    benefits: ['수수료 5%', '노출 가중치 1×', 'TimeDeal 주 3회'],
  },
  new: {
    label: '신규',
    emoji: '🆕',
    color: 'text-purple-700',
    bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
    border: 'border-purple-200',
    nextScore: 25,
    benefits: ['가입 30일 보호', '온보딩 가이드', 'TimeDeal 주 1회'],
  },
}

export default function TierBadge() {
  const [info, setInfo] = useState<TierInfo | null>(null)

  useEffect(() => {
    const token = getSellerToken()
    if (!token) return
    api.get('/api/seller/tier', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.data?.success) setInfo(res.data.data) })
      .catch(() => { /* tier API 미구현 — silently skip */ })
  }, [])

  if (!info) return null
  const meta = TIER_META[info.tier] || TIER_META.new
  const score = Math.round(info.tier_score || 0)
  const nextScore = meta.nextScore
  const progress = nextScore ? Math.min(100, (score / nextScore) * 100) : 100

  return (
    <div className={`rounded-2xl border-2 ${meta.border} ${meta.bg} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{meta.emoji}</div>
          <div>
            <p className={`text-[11px] font-bold ${meta.color} uppercase tracking-wider`}>현재 등급</p>
            <p className={`text-xl font-extrabold ${meta.color}`}>{meta.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">점수 {score} · 수수료 {info.commission_rate}% · 노출 {info.exposure_weight}×</p>
          </div>
        </div>
        {nextScore && (
          <div className="text-right">
            <p className="text-[10px] text-gray-500">다음 등급까지</p>
            <p className="text-sm font-bold text-gray-900">{Math.max(0, nextScore - score).toFixed(0)}점</p>
          </div>
        )}
      </div>

      {nextScore && (
        <div className="mt-3">
          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${meta.color.replace('text-', 'bg-').replace('-700', '-500')}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {meta.benefits.slice(0, 3).map((b, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 bg-white/70 text-gray-700 rounded-full font-medium">
            {b}
          </span>
        ))}
      </div>

      <a href="/seller/tier" className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900">
        <TrendingUp className="w-3 h-3" /> 등급 자세히 보기 <ChevronRight className="w-3 h-3" />
      </a>
    </div>
  )
}
