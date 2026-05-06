import React, { useState, useEffect } from 'react'
import TimedealCard from './TimedealCard'

interface FlashDeal {
  id: number
  name: string
  price: number
  original_price: number | null
  image_url: string | null
  sold_count: number | null
  stock: number | null
  flash_deal_end: string | null
  computed_discount_rate: number
}

interface FlashDealsData {
  deals: FlashDeal[]
  avg_discount_rate: number
  count: number
}

/** 자정(00:00) 또는 정오(12:00) 중 더 가까운 시각까지 남은 ms */
function getMsToNextReset(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const noon = new Date(now)
  noon.setHours(12, 0, 0, 0)
  if (noon.getTime() <= now.getTime()) {
    return midnight.getTime() - now.getTime()
  }
  return noon.getTime() - now.getTime()
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatCountdown(ms: number) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return { h, m, s }
}

export default function FlashDealsHero() {
  const [data, setData] = useState<FlashDealsData | null>(null)
  const [msLeft, setMsLeft] = useState(getMsToNextReset())
  const [isNoonTarget, setIsNoonTarget] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/flash-deals')
      .then(res => res.ok ? res.json() : null)
      .then((json: unknown) => {
        if (cancelled) return
        const j = json as { success?: boolean; data?: FlashDealsData } | null
        if (j?.success && j?.data) {
          setData(j.data)
        }
      })
      .catch(() => { /* graceful fallback */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const noon = new Date(now)
      noon.setHours(12, 0, 0, 0)

      if (noon.getTime() <= now.getTime()) {
        setIsNoonTarget(false)
        setMsLeft(midnight.getTime() - now.getTime())
      } else {
        setIsNoonTarget(true)
        setMsLeft(noon.getTime() - now.getTime())
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!data || data.count === 0) return null

  const { h, m, s } = formatCountdown(msLeft)

  return (
    <div className="px-4 pt-6 pb-2 lg:px-0 lg:pt-8">
      {/* PC: 2-column (hero left + grid right), mobile: stacked */}
      <div className="lg:flex lg:gap-6 xl:gap-8">

        {/* ── 히어로 박스 (countdown + stats) ── */}
        <div className="lg:w-[280px] xl:w-[300px] lg:shrink-0 mb-4 lg:mb-0">
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 p-4 lg:p-5 shadow-lg shadow-pink-500/20 h-full flex flex-col justify-between">
            {/* 헤더 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[15px]">🔥</span>
                <span className="text-[12px] lg:text-[13px] font-extrabold text-white/90 tracking-[0.12em]">FLASH DEALS</span>
                <span className="text-[10px] text-white/60 ml-1 hidden lg:inline">· 매일 자정·정오 갱신</span>
              </div>
              <p className="text-[10px] text-white/60 lg:hidden">· 매일 자정·정오 갱신</p>

              {/* 카운트다운 */}
              <div className="flex items-baseline gap-1 mt-2 mb-3">
                <span
                  className="font-black text-white tabular-nums"
                  style={{ fontSize: 'clamp(32px, 5vw, 44px)', letterSpacing: '-0.04em', lineHeight: 1.1 }}
                >
                  {pad(h)}:{pad(m)}:{pad(s)}
                </span>
                <span className="text-[11px] lg:text-[12px] text-white/70 font-semibold ml-1">
                  {isNoonTarget ? '정오까지' : '자정까지'}
                </span>
              </div>
            </div>

            {/* 통계 */}
            <div className="space-y-1.5">
              <p className="text-[11px] lg:text-[12px] text-white/90 font-semibold">
                진행 중 타임딜{' '}
                <span className="text-white font-extrabold text-[13px] lg:text-[14px]">{data.count}개</span>
              </p>
              {data.avg_discount_rate > 0 && (
                <p className="text-[11px] lg:text-[12px] text-white/90 font-semibold">
                  평균 할인율{' '}
                  <span className="text-white font-extrabold text-[13px] lg:text-[14px]">{data.avg_discount_rate}%</span>
                </p>
              )}

              {/* 강조 배지 */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ⚡ 한정수량
                </span>
                <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  🎯 특가딜
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 타임딜 그리드 ── */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {data.deals.map(deal => (
              <TimedealCard
                key={deal.id}
                id={deal.id}
                name={deal.name}
                price={deal.price}
                original_price={deal.original_price}
                image_url={deal.image_url}
                sold_count={deal.sold_count}
                stock={deal.stock}
                flash_deal_end={deal.flash_deal_end}
                discount_rate={deal.computed_discount_rate}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
