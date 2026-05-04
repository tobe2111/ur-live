import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

const DONATION_GOAL = 10000

interface TeamPointsBadgeProps {
  streamId?: number
}

// 딜 포인트 후원 게이지 뱃지 (상단 왼쪽, LIVE 뱃지 아래)
export function TeamPointsBadge({ streamId }: TeamPointsBadgeProps) {
  const [donated, setDonated] = useState(0)

  const fetchDonated = useCallback(async () => {
    if (!streamId) return
    try {
      const res = await api.get(`/api/donations/stream/${streamId}`)
      if (res.data.success) {
        const d = res.data.data
        // data.total (직접) 또는 배열이면 합산
        const total = d?.total ?? (Array.isArray(d) ? d.reduce((s: number, x: any) => s + (x.amount || 0), 0) : 0)
        setDonated(total)
      }
    } catch {
      // Silently ignore - endpoint may not exist yet
    }
  }, [streamId])

  useEffect(() => {
    fetchDonated()
  }, [fetchDonated])

  // Refresh when a donation happens
  useEffect(() => {
    const handler = () => {
      // Small delay to let the server process
      setTimeout(fetchDonated, 1000)
    }
    window.addEventListener('donationAlert', handler)
    return () => window.removeEventListener('donationAlert', handler)
  }, [fetchDonated])

  const progress = Math.min((donated / DONATION_GOAL) * 100, 100)

  return (
    <div className="flex flex-col gap-1 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md min-w-[100px]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">🎁</span>
        <span className="text-[11px] font-bold text-gray-900 dark:text-white/90">
          {formatNumber(donated)}/{formatNumber(DONATION_GOAL)}딜
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-pink-400 to-red-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
