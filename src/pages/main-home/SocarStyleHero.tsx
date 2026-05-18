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
  badge?: string
}

// 🛡️ 2026-05-17: 카테고리 6종 → 4종 통합. 대분류 오프라인(voucher 4) + 온라인(쇼핑/라이브) 분리.
//   2026-05-18: 카드별 컬러 배경 제거 (촌스러운 인상) → Monochrome 통일.
//                카드 = bg-white (다크: bg-[#1A1A1A]) + subtle border.
//                컬러는 아이콘 (이모지) 만 유지 → 시각 노이즈 감소.
const CATEGORIES: Category[] = [
  // 🏪 오프라인 (1행) — 매장 방문 voucher 4종
  { key: 'meal',   label: '식사권',  emoji: '🍽️', path: '/group-buy?category=meal_voucher'   },
  { key: 'beauty', label: '미용',    emoji: '💇', path: '/group-buy?category=beauty_voucher' },
  { key: 'stay',   label: '숙소',    emoji: '🏨', path: '/group-buy?category=stay_voucher'   },
  { key: 'etc',    label: '기타',    emoji: '🎯', path: '/group-buy?category=etc_voucher'    },
  // 🛍️ 온라인 (2행) — 라이브 커머스 + 쇼핑 + 특가 + 지도(매장 찾기)
  { key: 'live',   label: '라이브',  emoji: '📺', path: '/live',                              badge: 'LIVE' },
  { key: 'shop',   label: '쇼핑',    emoji: '🛍️', path: '/browse'                             },
  { key: 'deal',   label: '특가',    emoji: '🔥', path: '/group-buy?sort=discount',           badge: '~70%' },
  { key: 'map',    label: '내주변',  emoji: '📍', path: '/restaurant-map'                     },
]

// 🛡️ 2026-05-18: 카드 공통 클래스 — 모든 카테고리 동일 (Monochrome).
//   bg-white (라이트) / bg-[#1A1A1A] (다크) + subtle border + 호버 강조.
const CARD_BASE =
  'bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] ' +
  'rounded-xl p-3 flex flex-col items-center justify-center text-center ' +
  'active:scale-95 hover:border-gray-200 dark:hover:border-[#3A3A3A] hover:shadow-sm ' +
  'transition-all relative'

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

      {/* 🛡️ 2026-05-17: 오프라인/온라인 대분류 명시 — 카테고리 그리드 위 헤더 라벨.
            2026-05-18: 카드 monochrome 화 후 wrapper 배경 제거 — 카드 자체가 white 인데
            wrapper 가 gray-50 면 시각 노이즈만 증가. 라벨 + 그리드 직접 노출. */}
      <div className="space-y-4">
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
                className={CARD_BASE}
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
                className={CARD_BASE}
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
