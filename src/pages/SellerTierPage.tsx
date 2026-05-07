/**
 * 셀러 등급 상세 페이지 (2026-05-07)
 *
 * /seller/tier — TierBadge "등급 자세히 보기" 링크 도착지.
 * 등급 정보 + 점수 + 다음 등급까지 격차 + 변경 이력 + 등급별 혜택 표 표시.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ChevronLeft, Award, History } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardCard, DashboardLoading } from '@/components/dashboard'
import SEO from '@/components/SEO'
import { safeDate } from '@/utils/safe-date'

type Tier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'new'

interface TierHistoryItem {
  prev_tier: Tier
  new_tier: Tier
  prev_score: number
  new_score: number
  changed_at: string
}

interface TierInfo {
  tier: Tier
  tier_score: number
  exposure_weight: number
  commission_rate: number
  tier_updated_at: string | null
  history: TierHistoryItem[]
}

const TIER_ORDER: Tier[] = ['new', 'bronze', 'silver', 'gold', 'diamond']
const TIER_THRESHOLDS: Record<Tier, number> = {
  new: 0,
  bronze: 25,
  silver: 50,
  gold: 70,
  diamond: 85,
}

export default function SellerTierPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [info, setInfo] = useState<TierInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const TIER_META: Record<Tier, { label: string; emoji: string; color: string; bg: string; border: string; benefits: string[] }> = {
    diamond: {
      label: t('tierBadge.tierDiamond', { defaultValue: '다이아몬드' }),
      emoji: '💎',
      color: 'text-blue-700',
      bg: 'bg-gradient-to-br from-blue-100 to-cyan-50',
      border: 'border-blue-300',
      benefits: ['수수료 3% (최저)', '노출 가중치 4×', 'TimeDeal 무제한', '메인 hero 우선', '알림톡 1만건/월 무료'],
    },
    gold: {
      label: t('tierBadge.tierGold', { defaultValue: '골드' }),
      emoji: '⭐',
      color: 'text-amber-700',
      bg: 'bg-gradient-to-br from-amber-100 to-yellow-50',
      border: 'border-amber-300',
      benefits: ['수수료 4%', '노출 가중치 2.5×', 'TimeDeal 일 5회', '카테고리 상위'],
    },
    silver: {
      label: t('tierBadge.tierSilver', { defaultValue: '실버' }),
      emoji: '🥈',
      color: 'text-gray-700',
      bg: 'bg-gradient-to-br from-gray-100 to-slate-50',
      border: 'border-gray-300',
      benefits: ['수수료 5%', '노출 가중치 1.5×', 'TimeDeal 일 2회'],
    },
    bronze: {
      label: t('tierBadge.tierBronze', { defaultValue: '브론즈' }),
      emoji: '🥉',
      color: 'text-orange-700',
      bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
      border: 'border-orange-200',
      benefits: ['수수료 5%', '노출 가중치 1×', 'TimeDeal 주 3회'],
    },
    new: {
      label: t('tierBadge.tierNew', { defaultValue: '신규' }),
      emoji: '🌱',
      color: 'text-purple-700',
      bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
      border: 'border-purple-200',
      benefits: ['가입 30일 보호', '온보딩 가이드', 'TimeDeal 주 1회'],
    },
  }

  useEffect(() => {
    const token = getSellerToken()
    if (!token) {
      navigate('/seller/login')
      return
    }
    api.get('/api/seller/tier', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (res.data?.success) setInfo(res.data.data) })
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) {
    return <SellerLayout title={t('sellerTier.title', { defaultValue: '내 등급' })}><DashboardLoading /></SellerLayout>
  }

  const meta = info ? TIER_META[info.tier] || TIER_META.new : TIER_META.new
  const score = Math.round(info?.tier_score || 0)
  const currentIdx = info ? TIER_ORDER.indexOf(info.tier) : 0
  const nextTier = currentIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentIdx + 1] : null
  const nextScore = nextTier ? TIER_THRESHOLDS[nextTier] : null
  const progress = nextScore ? Math.min(100, (score / nextScore) * 100) : 100
  const remaining = nextScore ? Math.max(0, nextScore - score) : 0

  return (
    <SellerLayout title={t('sellerTier.title', { defaultValue: '내 등급' })}>
      <SEO title={t('sellerTier.seoTitle', { defaultValue: '셀러 등급 - 유어딜' })} description={t('sellerTier.seoDesc', { defaultValue: '내 셀러 등급과 혜택을 확인하세요' })} url="/seller/tier" noindex />
      <div className="px-4 py-4 lg:px-8 lg:py-6 max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> {t('common.back', { defaultValue: '뒤로' })}
        </button>

        <DashboardPageHeader
          icon={<Award className="w-5 h-5" />}
          title={t('sellerTier.title', { defaultValue: '내 등급' })}
          subtitle={t('sellerTier.subtitle', { defaultValue: '등급별 수수료/노출/혜택을 확인하세요' })}
        />

        {/* 현재 등급 카드 */}
        <DashboardCard className="mt-4">
          <div className={`rounded-2xl border-2 ${meta.border} ${meta.bg} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-2xl font-extrabold ${meta.color}`}>
                  {meta.emoji} {meta.label}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {t('sellerTier.currentScore', { score, defaultValue: `현재 점수: ${score}점` })}
                </p>
                {info?.tier_updated_at && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t('sellerTier.lastUpdated', { defaultValue: '마지막 갱신' })}: {safeDate(info.tier_updated_at)?.toLocaleString('ko-KR') ?? '-'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{t('sellerTier.commission', { defaultValue: '수수료' })}</p>
                <p className="text-lg font-bold text-gray-900">{info?.commission_rate ?? 5}%</p>
                <p className="text-xs text-gray-500 mt-2">{t('sellerTier.exposureWeight', { defaultValue: '노출 가중치' })}</p>
                <p className="text-lg font-bold text-gray-900">{info?.exposure_weight ?? 1}×</p>
              </div>
            </div>

            {/* Progress to next */}
            {nextTier && nextScore && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>{TIER_META[nextTier].emoji} {TIER_META[nextTier].label} 까지 {remaining}점</span>
                  <span className="font-semibold">{score} / {nextScore}</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-orange-400 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 혜택 chips */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {meta.benefits.map((b, i) => (
                <span key={i} className="text-[11px] bg-white/70 text-gray-700 rounded-full px-2 py-1 border border-white/80">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </DashboardCard>

        {/* 전체 등급 표 */}
        <DashboardCard className="mt-4">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> {t('sellerTier.allTiers', { defaultValue: '전체 등급 혜택' })}
          </h2>
          <div className="space-y-2">
            {[...TIER_ORDER].reverse().map(tier => {
              const m = TIER_META[tier]
              const threshold = TIER_THRESHOLDS[tier]
              const isCurrent = info?.tier === tier
              return (
                <div
                  key={tier}
                  className={`rounded-xl border ${m.border} ${m.bg} p-3 ${isCurrent ? 'ring-2 ring-pink-400' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className={`text-sm font-bold ${m.color}`}>
                      {m.emoji} {m.label}
                    </p>
                    <p className="text-[11px] text-gray-500 font-semibold">
                      {threshold}점 이상
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.benefits.map((b, i) => (
                      <span key={i} className="text-[10px] bg-white/70 text-gray-700 rounded px-1.5 py-0.5">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </DashboardCard>

        {/* 등급 변경 이력 */}
        {info?.history && info.history.length > 0 && (
          <DashboardCard className="mt-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" /> {t('sellerTier.history', { defaultValue: '등급 변경 이력' })}
            </h2>
            <div className="space-y-2">
              {info.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-100 last:border-0 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{TIER_META[h.prev_tier]?.emoji} {TIER_META[h.prev_tier]?.label || h.prev_tier}</span>
                    <span className="text-gray-400">→</span>
                    <span className={`font-bold ${TIER_META[h.new_tier]?.color}`}>{TIER_META[h.new_tier]?.emoji} {TIER_META[h.new_tier]?.label || h.new_tier}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-600">{h.prev_score} → {h.new_score}점</p>
                    <p className="text-[10px] text-gray-400">{safeDate(h.changed_at)?.toLocaleString('ko-KR') ?? '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        )}
      </div>
    </SellerLayout>
  )
}
