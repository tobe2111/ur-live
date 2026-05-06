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
    // 이미 정오 지남 → 자정까지
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

  // 타임딜 데이터 fetch
  useEffect(() => {
    let cancelled = false
    fetch('/api/flash-deals')
      .then(res => res.ok ? res.json() : null)
      .then((json: any) => {
        if (cancelled) return
        if (json?.success && json?.data) {
          setData(json.data as FlashDealsData)
        }
      })
      .catch(() => { /* graceful fallback — null 유지 */ })
    return () => { cancelled = true }
  }, [])

  // 카운트다운 — 1초마다 갱신
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const noon = new Date(now)
      noon.setHours(12, 0, 0, 0)

      if (noon.getTime() <= now.getTime()) {
        // 정오 지남 → 자정 카운트다운
        setIsNoonTarget(false)
        setMsLeft(midnight.getTime() - now.getTime())
      } else {
        // 정오 전 → 정오 카운트다운
        setIsNoonTarget(true)
        setMsLeft(noon.getTime() - now.getTime())
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // 데이터 없으면 렌더 안 함
  if (!data || data.count === 0) return null

  const { h, m, s } = formatCountdown(msLeft)

  return (
    <div className="px-4 pt-6 pb-2">
      {/* ── 히어로 박스 ── */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-pink-500 to-rose-500 p-4 mb-4 shadow-lg shadow-pink-500/20">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px]">🔥</span>
          <span className="text-[12px] font-extrabold text-white/90 tracking-[0.12em]">FLASH DEALS</span>
          <span className="text-[10px] text-white/60 ml-1">· 매일 자정·정오·18시 갱신</span>
        </div>

        {/* 카운트다운 */}
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-[36px] font-black text-white tabular-nums" style={{ letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            {pad(h)}:{pad(m)}:{pad(s)}
          </span>
          <span className="text-[11px] text-white/70 font-semibold ml-1">
            {isNoonTarget ? '정오까지' : '자정까지'}
          </span>
        </div>

        {/* 부제 */}
        <p className="text-[11px] text-white/80 font-semibold">
          지금 진행 중인 타임딜 <span className="text-white font-extrabold">{data.count}개</span>
          {data.avg_discount_rate > 0 && (
            <> · 평균 할인율 <span className="text-white font-extrabold">{data.avg_discount_rate}%</span></>
          )}
        </p>
      </div>

      {/* ── 타임딜 그리드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
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
  )
}
