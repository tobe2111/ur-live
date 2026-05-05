import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Zap, Clock, Users, Gift } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface TimeDeal {
  id: number; product_id: number; product_name: string
  original_price: number; deal_price: number; discount_percent: number
  max_claims: number; claimed_count: number
  status: string; expires_at: string
  // Group buy fields (optional for backward compat)
  is_group_buy?: boolean
  target_participants?: number
  current_participants?: number
  progress_percent?: number
  target_reached?: boolean
  bonus_discount_percent?: number
  effective_discount_percent?: number
  effective_price?: number
  remaining?: number
}

export default function TimeDealPopup({ streamId }: { streamId: string | number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [deal, setDeal] = useState<TimeDeal | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [show, setShow] = useState(false)
  const prevDealId = useRef<number | null>(null)

  useEffect(() => {
    const poll = () => {
      if (document.hidden) return
      api.get(`/api/timedeal/stream/${streamId}`).then(r => {
        if (r.data.success && r.data.data && r.data.data.status === 'active') {
          const d = r.data.data
          setDeal(d)
          setTimeLeft(Math.max(0, Math.floor((new Date(d.expires_at).getTime() - Date.now()) / 1000)))
          if (prevDealId.current !== d.id) {
            prevDealId.current = d.id
            setShow(true)
            setClaimed(false)
          }
        } else {
          if (deal && deal.status === 'active') setShow(false)
          setDeal(null)
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    }
    poll()
    const iv = setInterval(poll, 5000)
    const onVisible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVisible) }
  }, [streamId])

  useEffect(() => {
    if (deal?.status === 'active' && timeLeft > 0) {
      const t = setInterval(() => setTimeLeft(v => {
        if (v <= 1) { setShow(false); return 0 }
        return v - 1
      }), 1000)
      return () => clearInterval(t)
    }
  }, [deal?.id, deal?.status])

  const handleClaim = async () => {
    if (!deal || claiming || claimed) return
    setClaiming(true)
    const wasTargetReached = !!deal.target_reached
    try {
      const res = await api.post(`/api/timedeal/${deal.id}/claim`)
      if (res.data.success) {
        setClaimed(true)
        const isGroupBuy = !!deal.is_group_buy
        // Detect if target was just reached with this claim
        const newTargetReached = res.data.data?.target_reached ?? res.data.target_reached
        if (isGroupBuy && !wasTargetReached && newTargetReached) {
          toast.success(t('live.timeDealGroupTargetReached', { defaultValue: '🎉 목표 달성! 추가 할인이 적용됐어요!' }))
        } else if (isGroupBuy) {
          toast.success(t('live.timeDealGroupJoined', { defaultValue: '공구 참여 완료! 장바구니에서 확인하세요' }))
        } else {
          toast.success(t('live.timeDealClaimed', { defaultValue: '타임딜 획득! 장바구니에서 할인가로 구매하세요' }))
        }
      } else {
        toast.error(res.data.error)
      }
    } catch (err: any) { toast.error(err?.response?.data?.error || t('live.timeDealJoinFailed', { defaultValue: '참여 실패' })) }
    finally { setClaiming(false) }
  }

  if (!deal || !show || deal.status !== 'active') return null

  const isGroupBuy = !!deal.is_group_buy
  const remaining = typeof deal.remaining === 'number' ? deal.remaining : (deal.max_claims - deal.claimed_count)
  const progressPct = Math.min(100, (deal.claimed_count / deal.max_claims) * 100)

  // Group buy specific
  const currentParticipants = deal.current_participants ?? 0
  const targetParticipants = deal.target_participants ?? 0
  const groupProgressPct = Math.min(100, deal.progress_percent ?? 0)
  const targetReached = !!deal.target_reached
  const needMore = Math.max(0, targetParticipants - currentParticipants)
  const effectiveDiscount = deal.effective_discount_percent ?? deal.discount_percent
  const effectivePrice = deal.effective_price ?? deal.deal_price
  const bonusDiscount = deal.bonus_discount_percent ?? 0

  const containerGradient = isGroupBuy
    ? 'bg-gradient-to-r from-pink-500 to-pink-600'
    : 'bg-gradient-to-r from-red-500 to-pink-600'

  const ctaLabel = claimed
    ? t('live.timeDealClaimedLabel', { defaultValue: '✓ 획득 완료' })
    : remaining <= 0
      ? t('live.timeDealSoldOut', { defaultValue: '매진' })
      : claiming
        ? t('live.timeDealProcessing', { defaultValue: '처리 중...' })
        : isGroupBuy ? t('live.timeDealJoin', { defaultValue: '참여하기' }) : t('live.timeDealBuy', { defaultValue: '지금 구매하기' })

  const ctaColorClass = isGroupBuy ? 'bg-white text-pink-600' : 'bg-white text-red-600'

  return (
    <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 animate-in slide-in-from-bottom duration-300">
      <div className={`w-full max-w-md ${containerGradient} rounded-2xl p-4 text-gray-900 dark:text-white shadow-2xl relative overflow-hidden`}>
        {/* 배경 효과 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full" />
        </div>

        <div className="relative">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {isGroupBuy ? (
                <Users className="w-5 h-5 text-gray-900 dark:text-white" />
              ) : (
                <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              )}
              <span className="font-bold">{isGroupBuy ? t('live.timeDealGroupBuyLabel', { defaultValue: '🎁 라이브 공구!' }) : t('live.timeDealLabel', { defaultValue: '타임딜!' })}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono font-bold text-sm">{t('live.timeDealSeconds', { timeLeft, defaultValue: '{{timeLeft}}초' })}</span>
            </div>
          </div>

          {/* 상품 정보 */}
          <p className="text-sm font-semibold line-clamp-1 mb-1">{deal.product_name}</p>

          <div className="flex items-end gap-2 mb-2">
            <span className="text-[10px] line-through text-gray-900 dark:text-white/60">{formatNumber(deal.original_price)}{t('common.won', { defaultValue: '원' })}</span>
            <span className="text-xl font-bold">{formatNumber(isGroupBuy ? effectivePrice : deal.deal_price)}{t('common.won', { defaultValue: '원' })}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isGroupBuy ? 'bg-white text-pink-600' : 'bg-yellow-400 text-red-700'}`}>
              -{isGroupBuy ? effectiveDiscount : deal.discount_percent}%
            </span>
          </div>

          {/* 진행 바: 공구 vs 타임딜 */}
          {isGroupBuy ? (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-gray-900 dark:text-white/90 mb-1">
                <div className="flex items-center gap-1 font-semibold">
                  <Users className="w-3 h-3" />
                  <span>{t('live.timeDealParticipants', { current: currentParticipants, target: targetParticipants, defaultValue: '{{current}}/{{target}}명 참여중' })}</span>
                </div>
                <span className="font-mono">{Math.floor(groupProgressPct)}%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-200 rounded-full transition-all"
                  style={{ width: `${groupProgressPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] flex items-center gap-1">
                {targetReached ? (
                  <span className="font-bold text-yellow-200">
                    {t('live.timeDealGroupTargetAchieved', { discount: effectiveDiscount, defaultValue: '🎉 목표 달성! {{discount}}% 할인 적용!' })}
                  </span>
                ) : (
                  <span className="text-gray-900 dark:text-white/90 flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    {t('live.timeDealGroupNeedMore', { needMore, bonusDiscount, defaultValue: '{{needMore}}명 더 모이면 -{{bonusDiscount}}% 추가 할인!' })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-gray-900 dark:text-white/70 mb-1">
                <span>{t('live.timeDealRemaining', { remaining, defaultValue: '남은 수량 {{remaining}}개' })}</span>
                <span>{deal.claimed_count}/{deal.max_claims}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleClaim}
              disabled={claiming || claimed || remaining <= 0}
              className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-[0.97] transition-all ${
                claimed ? 'bg-green-400 text-green-900' :
                remaining <= 0 ? 'bg-gray-400 text-gray-200' :
                ctaColorClass
              }`}
            >
              {ctaLabel}
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-4 py-3 bg-white/20 rounded-xl text-sm font-medium"
            >
              {t('common.close', { defaultValue: '닫기' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
