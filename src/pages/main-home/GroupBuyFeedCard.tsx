/**
 * 🛡️ 2026-05-20: 홈 공구 피드 카드 (당근 2열 + 공구 진행 overlay).
 *
 * 정사각형 이미지 + 좌하단 진행/카테고리 배지 overlay → 당근의 깔끔함 유지하면서
 * 공구 핵심 정보 (현재/목표 인원 + 마감 시간) 한눈에.
 */

import { Link } from 'react-router-dom'
import { formatNumber } from '@/utils/format'
import type { Product } from './types'

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  meal_voucher:     { emoji: '🍽️', label: '식사' },
  beauty_voucher:   { emoji: '💇', label: '뷰티' },
  stay_voucher:     { emoji: '🏨', label: '숙소' },
  etc_voucher:      { emoji: '🎯', label: '기타' },
  health_voucher:   { emoji: '💪', label: '건강' },
  pet_voucher:      { emoji: '🐶', label: '반려' },
  activity_voucher: { emoji: '🎉', label: '액티비티' },
}

interface FeedCardProduct extends Product {
  group_buy_current?: number
  group_buy_target?: number
  group_buy_status?: string
  expires_at?: string | null
  seller_name?: string
  seller_avatar?: string
  category?: string
  business_address?: string
  discount_rate?: number
  current_price?: number
}

function timeRemaining(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '마감'
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 2) return `마감 ${days}일`
  if (hours >= 1) return `마감 ${hours}시간`
  const mins = Math.max(1, Math.floor(ms / 60_000))
  return `마감 ${mins}분`
}

export default function GroupBuyFeedCard({ p }: { p: FeedCardProduct }) {
  const cat = CATEGORY_META[p.category || 'etc_voucher'] || CATEGORY_META.etc_voucher
  const remaining = timeRemaining(p.expires_at)
  const isUrgent = remaining && (remaining.includes('시간') || remaining.includes('분'))
  const price = p.current_price ?? p.price ?? 0
  const discount = p.discount_rate ?? 0

  // 🛡️ 2026-05-20: 사용자 명시 — "공구 진행 게이지 필요 없어. 그냥 결제하는 거야."
  //   → group_buy_current/target/status 의 progress overlay 완전 제거.
  //   카드는 카테고리 + 할인율 배지 + 가격 + 마감 시간만 노출.

  // 동네명 추출 — business_address 의 첫 2 토큰 (예: "서울 강남구 역삼동 123-45" → "강남구 역삼동")
  const dong = p.business_address
    ? p.business_address.split(/\s+/).slice(1, 3).join(' ') || p.business_address.slice(0, 20)
    : null

  return (
    <Link
      to={`/group-buy/${p.id}`}
      className="block group active:opacity-90 transition-opacity"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-[#121212]">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name || cat.label}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-[#1A1A1A] dark:to-[#0A0A0A] flex items-center justify-center">
            <span className="text-3xl opacity-40">{cat.emoji}</span>
          </div>
        )}

        {/* 좌상단 카테고리 배지 */}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/95 dark:bg-black/70 text-[10px] font-bold text-gray-800 dark:text-white backdrop-blur-sm">
          {cat.emoji} {cat.label}
        </span>

        {/* 우상단 할인 배지 (있을 때만) */}
        {discount > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-pink-500 text-[10px] font-extrabold text-white">
            {discount}% OFF
          </span>
        )}
      </div>

      <div className="pt-2 px-0.5">
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white line-clamp-1">
          {p.name}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {p.seller_name || '셀러'}
          {dong && <span className="mx-1 text-gray-300">·</span>}
          {dong && <span>{dong}</span>}
        </p>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">
            {formatNumber(price)}원
          </span>
          {remaining && (
            <span className={`ml-auto text-[10px] font-bold ${isUrgent ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
              ⏰ {remaining}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
