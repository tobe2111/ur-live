/**
 * 🛡️ 2026-05-16: 쏘카 스타일 hero — 인사 + 슬로건 + 8 카테고리 그리드.
 *
 * 라이트/다크 양쪽 지원. CLAUDE.md 의 dark: variant 룰 준수.
 * 카테고리 클릭 시 /group-buy 의 해당 필터로 이동.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface Category {
  key: string
  label: string
  emoji: string
  path: string
  bgClass: string
  badge?: string
}

const CATEGORIES: Category[] = [
  { key: 'meal',     label: '식사권',     emoji: '🍱', path: '/group-buy?category=meal_voucher',     bgClass: 'bg-orange-50 dark:bg-orange-950/30' },
  { key: 'beauty',   label: '뷰티',       emoji: '💄', path: '/group-buy?category=beauty_voucher',   bgClass: 'bg-pink-50 dark:bg-pink-950/30' },
  { key: 'health',   label: '헬스',       emoji: '💪', path: '/group-buy?category=health_voucher',   bgClass: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { key: 'pet',      label: '펫',         emoji: '🐶', path: '/group-buy?category=pet_voucher',      bgClass: 'bg-amber-50 dark:bg-amber-950/30' },
  { key: 'stay',     label: '숙박',       emoji: '🏠', path: '/group-buy?category=stay_voucher',     bgClass: 'bg-sky-50 dark:bg-sky-950/30', badge: 'NEW' },
  { key: 'activity', label: '액티비티',   emoji: '🎯', path: '/group-buy?category=activity_voucher', bgClass: 'bg-violet-50 dark:bg-violet-950/30' },
  { key: 'live',     label: '라이브',     emoji: '📺', path: '/live',                                bgClass: 'bg-red-50 dark:bg-red-950/30', badge: 'LIVE' },
  { key: 'deal',     label: '특가',       emoji: '🔥', path: '/group-buy?sort=discount',             bgClass: 'bg-yellow-50 dark:bg-yellow-950/30', badge: '~70%' },
]

interface Props {
  userName?: string
  availableVouchers?: number
}

export default function SocarStyleHero({ userName, availableVouchers = 0 }: Props) {
  const { t } = useTranslation()
  return (
    <section className="px-4 pt-4 pb-2">
      {/* 인사 + 슬로건 */}
      <div className="mb-4">
        <h2 className="text-[15px] font-medium text-gray-700 dark:text-gray-300">
          ✨ 안녕하세요 <span className="font-bold text-gray-900 dark:text-white">{userName?.trim() || '유저'}</span>님, 오늘도 좋은 하루
        </h2>
        <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1 tracking-tight">
          특가는 <span className="text-pink-500">역시 유어딜</span>
        </p>
      </div>

      {/* 사용 가능 voucher 카드 (있을 때만) */}
      {availableVouchers > 0 && (
        <Link to="/my-vouchers" className="block mb-4">
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40 border border-pink-200 dark:border-pink-900/50 rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div>
              <p className="text-[11px] text-pink-600 dark:text-pink-300 font-medium">사용 가능 식권</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{availableVouchers}장</p>
            </div>
            <span className="px-3 py-1.5 bg-white dark:bg-[#0A0A0A] text-pink-600 dark:text-pink-300 rounded-full text-xs font-bold shadow-sm">
              사용하기 →
            </span>
          </div>
        </Link>
      )}

      {/* 8 카테고리 그리드 (2x4) */}
      <div className="bg-gray-50 dark:bg-[#0A0A0A] rounded-2xl p-3">
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              to={cat.path}
              className={`${cat.bgClass} rounded-xl p-3 flex flex-col items-center justify-center text-center active:scale-95 transition-transform relative`}
            >
              {cat.badge && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {cat.badge}
                </span>
              )}
              <span className="text-2xl" aria-hidden>{cat.emoji}</span>
              <span className="text-[11px] font-bold text-gray-900 dark:text-white mt-1.5">{cat.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
