import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatNumber } from '@/utils/format'

interface TimedealCardProps {
  id: number
  name: string
  price: number
  original_price?: number | null
  image_url?: string | null
  sold_count?: number | null
  stock?: number | null
  flash_deal_end?: string | null
  discount_rate?: number
}

function useCountdown(target: Date | null) {
  const getRemaining = () => {
    if (!target) return null
    const diff = target.getTime() - Date.now()
    if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true }
    const totalSecs = Math.floor(diff / 1000)
    return {
      h: Math.floor(totalSecs / 3600),
      m: Math.floor((totalSecs % 3600) / 60),
      s: totalSecs % 60,
      expired: false,
    }
  }

  const [remaining, setRemaining] = useState(getRemaining)

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setRemaining(getRemaining()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.getTime()])

  return remaining
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function TimedealCard({
  id,
  name,
  price,
  original_price,
  image_url,
  sold_count,
  stock,
  flash_deal_end,
  discount_rate,
}: TimedealCardProps) {
  const navigate = useNavigate()
  const target = flash_deal_end ? new Date(flash_deal_end) : null
  const remaining = useCountdown(target)

  const discPct = discount_rate != null && discount_rate > 0
    ? discount_rate
    : (original_price && original_price > price
      ? Math.round((1 - price / original_price) * 100)
      : 0)

  const soldN = sold_count ?? 0
  const stockN = stock ?? 0
  const progressPct = stockN > 0 ? Math.min(100, Math.round((soldN / stockN) * 100)) : 0

  return (
    <button
      onClick={() => navigate(`/products/${id}`)}
      className="w-full text-left bg-white dark:bg-[#121212] rounded-xl overflow-hidden border border-gray-100 dark:border-[#1A1A1A] active:scale-[0.98] transition-transform"
    >
      {/* 상품 이미지 */}
      <div className="relative aspect-square w-full bg-gray-100 dark:bg-[#1A1A1A]">
        {image_url && (
          <img
            src={image_url}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}

        {/* 좌상단: 남은 시간 빨간 pill */}
        {remaining && !remaining.expired && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-red-500/30">
            {pad(remaining.h)}:{pad(remaining.m)}:{pad(remaining.s)}
          </span>
        )}
        {remaining?.expired && (
          <span className="absolute top-1.5 left-1.5 bg-gray-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            종료
          </span>
        )}

        {/* 우상단: 할인율 검정 pill */}
        {discPct > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
            -{discPct}%
          </span>
        )}
      </div>

      {/* 카드 본문 */}
      <div className="p-2.5">
        <p className="text-[12px] text-gray-800 dark:text-gray-200 font-semibold leading-tight line-clamp-2 mb-1.5">
          {name}
        </p>

        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-[15px] font-extrabold text-gray-900 dark:text-white">
            {formatNumber(price)}원
          </span>
          {original_price && original_price > price && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 line-through">
              {formatNumber(original_price)}원
            </span>
          )}
        </div>

        {/* 진행률 바 */}
        {stockN > 0 && (
          <div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {progressPct}% · {formatNumber(soldN)}/{formatNumber(stockN)}개
            </p>
          </div>
        )}
      </div>
    </button>
  )
}
