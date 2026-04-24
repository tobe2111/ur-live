import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, MessageSquare, ShoppingBag, DollarSign } from 'lucide-react'
import api from '@/lib/api'

// ── 라이브 실시간 통계 카운터 ────────────────────────────────────
interface LiveStats { viewer_count: number; chat_count: number; order_count: number; revenue: number }

export function LiveStatsBar({ streamId }: { streamId: number }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<LiveStats>({ viewer_count: 0, chat_count: 0, order_count: 0, revenue: 0 })

  useEffect(() => {
    let active = true
    const fetchStats = async () => {
      try {
        // 병렬로 우리 DB stats + YouTube Live API stats 조회, viewer_count 는 YouTube 값 우선
        const [ours, yt] = await Promise.allSettled([
          api.get(`/api/seller/streams/${streamId}/live-stats`),
          api.get(`/api/seller/youtube/live/${streamId}/youtube-stats`),
        ])
        if (!active) return
        const next: LiveStats = { viewer_count: 0, chat_count: 0, order_count: 0, revenue: 0 }
        if (ours.status === 'fulfilled' && ours.value.data?.success) {
          Object.assign(next, ours.value.data.data)
        }
        if (yt.status === 'fulfilled' && yt.value.data?.success) {
          next.viewer_count = yt.value.data.data.concurrent_viewers || next.viewer_count
        }
        setStats(next)
      } catch { /* silent */ }
    }
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => { active = false; clearInterval(id) }
  }, [streamId])

  const ordersUnit = t('seller.liveBroadcast.ordersUnit')
  const items = [
    { icon: Eye, value: stats.viewer_count.toLocaleString() },
    { icon: MessageSquare, value: stats.chat_count.toLocaleString() },
    { icon: ShoppingBag, value: `${stats.order_count}${ordersUnit}` },
    { icon: DollarSign, value: `₩${stats.revenue.toLocaleString()}` },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
      {items.map(({ icon: Icon, value }, i) => (
        <div key={i} className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="font-bold text-gray-900 truncate">{value}</span>
        </div>
      ))}
    </div>
  )
}
