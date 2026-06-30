// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 유저 공구(커뮤니티) 카드(verbatim 추출). 동작 불변.
import { useTranslation } from 'react-i18next'
import { MapPin, Bell, HandCoins, Users, Clock } from 'lucide-react'
import { formatPrice } from '@/utils/currency'
import { STATUS_BADGES } from './constants'
import { formatTimeLeft } from './utils'
import type { CommunityGroupBuy } from './types'

export default function CommunityGroupBuyCard({
  g, interested, onToggleInterest, navigate,
}: {
  g: CommunityGroupBuy
  interested: boolean
  onToggleInterest: (e: React.MouseEvent, productId: number, restaurantName?: string) => void
  navigate: (to: string) => void
}) {
  const { t } = useTranslation()
  const progress =
    g.target_count > 0
      ? Math.min(100, (g.current_count / g.target_count) * 100)
      : 0
  const achieved = g.current_count >= g.target_count
  const badge = STATUS_BADGES[g.status] || STATUS_BADGES.proposed
  const timeLeft = formatTimeLeft(g.expires_at)

  return (
    <button
      onClick={() => navigate(`/community-group-buy/${g.invite_code}`)}
      className="w-full text-left border border-gray-100 dark:border-[#2A2A2A] rounded-2xl p-4 active:scale-[0.98] transition-transform bg-white dark:bg-[#121212] hover:border-gray-200 dark:hover:border-[#3A3A3A]"
    >
      {/* 상단: 아이콘 + 식당명 + 상태 배지 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
            <span className="text-[18px]">🙋</span>
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">
              {g.restaurant_name}
            </p>
            {g.restaurant_address && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-0.5 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {g.restaurant_address}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={(e) => onToggleInterest(e, g.id, g.restaurant_name)}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 dark:border-[#2A2A2A] active:scale-90 transition-transform"
            aria-label={t('common.wishlist', { defaultValue: '관심 등록' })}
          >
            <Bell
              className={`w-3.5 h-3.5 ${interested ? 'text-gray-900 fill-gray-900 dark:text-white dark:fill-white' : 'text-gray-400'}`}
            />
          </button>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* 가격 + 보증금 정보 */}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1">
          <HandCoins className="w-3.5 h-3.5 text-gray-900 dark:text-white" />
          <span className="text-[12px] text-gray-600 dark:text-gray-400">{t('groupBuy.proposedPrice', { defaultValue: '제안가' })}</span>
          <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">
            {formatPrice(g.proposed_price)}
          </span>
        </div>
        <div className="text-[11px] text-gray-400 dark:text-gray-600">|</div>
        <div className="text-[12px] text-gray-500 dark:text-gray-400">
          {t('groupBuy.depositLabel', { defaultValue: '보증금' })} <span className="font-semibold text-gray-700 dark:text-gray-200">{formatPrice(g.deposit_per_person)}</span>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mt-3">
        <div className="w-full h-2.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              achieved ? 'bg-emerald-500' : 'bg-gray-900 dark:bg-white'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Users className="w-3 h-3 text-gray-400" />
            {achieved ? (
              <span className="text-emerald-600 font-semibold">
                {t('groupBuy.goalReached', { defaultValue: '목표 달성!' })}
              </span>
            ) : (
              <>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {g.current_count}
                </span>
                <span className="text-gray-400">/</span>
                <span>{t('groupBuy.peopleSuffix', { defaultValue: '{{count}}명', count: g.target_count })}</span>
              </>
            )}
          </p>
          {timeLeft && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {timeLeft}
            </p>
          )}
        </div>
      </div>

      {/* 참여하기 CTA — 부모가 이미 <button> 이라 중첩 불가, 표시용 div 유지 */}
      <div className="mt-3 bg-gray-900 text-white text-center py-2 rounded-xl text-[13px] font-bold">
        {t('groupBuy.joinCta', { defaultValue: '참여하기' })}
      </div>
    </button>
  )
}
