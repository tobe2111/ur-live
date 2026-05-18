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

// 🛡️ 2026-05-17: 카테고리 6종 → 4종 통합. 대분류 오프라인(voucher 4) + 온라인(쇼핑/라이브) 분리.
//   2x4 그리드 — 첫 줄: 오프라인 4종 / 둘째 줄: 온라인 4 entry (라이브/쇼핑/특가/지도).
const CATEGORIES: Category[] = [
  // 🏪 오프라인 (1행) — 매장 방문 voucher 4종
  { key: 'meal',   label: '식사권',  emoji: '🍽️', path: '/group-buy?category=meal_voucher',   bgClass: 'bg-orange-50 dark:bg-orange-950/30' },
  { key: 'beauty', label: '미용',    emoji: '💇', path: '/group-buy?category=beauty_voucher', bgClass: 'bg-pink-50 dark:bg-pink-950/30' },
  { key: 'stay',   label: '숙소',    emoji: '🏨', path: '/group-buy?category=stay_voucher',   bgClass: 'bg-sky-50 dark:bg-sky-950/30' },
  { key: 'etc',    label: '기타',    emoji: '🎯', path: '/group-buy?category=etc_voucher',    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30' },
  // 🛍️ 온라인 (2행) — 라이브 커머스 + 쇼핑 + 특가 + 지도(매장 찾기)
  { key: 'live',   label: '라이브',  emoji: '📺', path: '/live',                              bgClass: 'bg-red-50 dark:bg-red-950/30', badge: 'LIVE' },
  { key: 'shop',   label: '쇼핑',    emoji: '🛍️', path: '/browse',                            bgClass: 'bg-violet-50 dark:bg-violet-950/30' },
  { key: 'deal',   label: '특가',    emoji: '🔥', path: '/group-buy?sort=discount',           bgClass: 'bg-yellow-50 dark:bg-yellow-950/30', badge: '~70%' },
  { key: 'map',    label: '내주변',  emoji: '📍', path: '/restaurant-map',                    bgClass: 'bg-amber-50 dark:bg-amber-950/30' },
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

      {/* 🛡️ 2026-05-17: 오프라인/온라인 대분류 명시 — 카테고리 그리드 위 헤더 라벨. */}
      <div className="bg-gray-50 dark:bg-[#0A0A0A] rounded-2xl p-3 space-y-3">
        {/* 오프라인 (voucher 4종) */}
        <div>
          <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 tracking-[0.12em] mb-2 px-1">
            🏪 오프라인 — 매장 방문 공구
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.slice(0, 4).map((cat) => (
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

        {/* 온라인 (라이브 + 쇼핑) */}
        <div>
          <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 tracking-[0.12em] mb-2 px-1">
            🛍️ 온라인 — 라이브 + 쇼핑
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.slice(4).map((cat) => (
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
      </div>
    </section>
  )
}
