/**
 * 🛡️ 2026-05-15: 실시간 참여 ticker — SNS 흐름.
 *
 * 사용:
 *   <LiveTicker />  (기본 — 30초 polling, 마지막 5건을 fade 회전)
 *
 * UX 의도:
 *   - "지금 사람들이 몰리고 있다" 인식
 *   - polling 30s 지만 클라이언트는 5초마다 다음 entry rotate → realtime 처럼 느낌
 *   - 페이지 hidden 시 polling/rotation 일시정지 (배터리)
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'

interface TickerEntry {
  masked_name: string
  avatar: string | null
  product_id: number
  product_name: string
  restaurant_name: string | null
  product_image: string | null
  category: string
  quantity: number
  created_at: string
}

const CATEGORY_EMOJI: Record<string, string> = {
  meal_voucher: '🍽️', beauty_voucher: '💇', health_voucher: '💪',
  pet_voucher: '🐶', stay_voucher: '🏨', activity_voucher: '🎯',
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  return `${h}시간 전`
}

export default function LiveTicker({ className = '' }: { className?: string }) {
  const [entries, setEntries] = useState<TickerEntry[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchTicker = async () => {
      if (document.hidden) return
      try {
        const res = await api.get('/api/group-buy/live-ticker')
        if (!cancelled && res.data?.success) setEntries(res.data.data || [])
      } catch { /* silent */ }
    }
    fetchTicker()
    const pollTimer = setInterval(fetchTicker, 30_000)
    return () => { cancelled = true; clearInterval(pollTimer) }
  }, [])

  // 5초마다 다음 entry 회전 (realtime "처럼" 느끼게)
  useEffect(() => {
    if (entries.length <= 1) return
    const t = setInterval(() => {
      if (document.hidden) return
      setIdx(i => (i + 1) % entries.length)
    }, 5000)
    return () => clearInterval(t)
  }, [entries.length])

  if (entries.length === 0) return null
  const e = entries[idx]
  if (!e) return null

  return (
    <Link
      to={`/group-buy/${e.product_id}`}
      className={`flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow transition-shadow ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* 깜빡이는 빨간 dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>

      {/* 아바타 */}
      {e.avatar ? (
        <img src={e.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 shrink-0 flex items-center justify-center text-[10px]">
          {CATEGORY_EMOJI[e.category] || '🎫'}
        </div>
      )}

      {/* 텍스트 (animate-in) */}
      <p key={`${e.product_id}-${e.created_at}`} className="text-[11px] text-gray-700 truncate flex-1 animate-fadeIn">
        <span className="font-bold text-gray-900">{e.masked_name}</span>
        <span className="text-gray-500"> · </span>
        <span className="text-gray-700">{e.restaurant_name || e.product_name}</span>
        <span className="text-gray-400 ml-1">· {timeAgo(e.created_at)}</span>
      </p>
    </Link>
  )
}
