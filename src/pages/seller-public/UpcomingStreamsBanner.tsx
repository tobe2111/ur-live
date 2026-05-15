/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): 셀러 페이지 라이브 예고 배너.
 *
 * mallpro 의 "라이브예고" 기능 따라잡기.
 *
 * 동작:
 *   - GET /api/seller-public/:sellerId/upcoming → scheduled + live 가져옴
 *   - live 상태면 빨간 LIVE 배지 + 즉시 진입 CTA
 *   - scheduled 상태면 countdown + 알림 신청 (단골 등록 유도)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Clock, ChevronRight } from 'lucide-react'
import api from '@/lib/api'

interface UpcomingStream {
  id: number
  title: string
  thumbnail_url?: string
  scheduled_at?: string
  status: 'scheduled' | 'live' | string
  youtube_video_id?: string
  description?: string
}

interface Props {
  sellerId: number
}

function timeUntil(iso?: string): string {
  if (!iso) return '시작 시간 미정'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return '이미 시작됨'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}일 ${hours}시간 후`
  if (hours > 0) return `${hours}시간 ${mins}분 후`
  return `${mins}분 후`
}

export default function UpcomingStreamsBanner({ sellerId }: Props) {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<UpcomingStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId || sellerId <= 0) return
    api.get(`/api/seller-public/${sellerId}/upcoming`)
      .then(r => { if (r.data?.success) setStreams(r.data.data || []) })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [sellerId])

  if (loading || streams.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          {streams[0].status === 'live' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-red-500">LIVE 진행 중</span>
            </>
          ) : (
            <>📅 다가오는 라이브</>
          )}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {streams.slice(0, 5).map(s => (
          <button
            key={s.id}
            onClick={() => navigate(`/live/${s.id}`)}
            className="shrink-0 w-[240px] text-left rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="relative w-full aspect-video bg-gray-100">
              {s.thumbnail_url ? (
                <img src={s.thumbnail_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
              ) : s.youtube_video_id ? (
                <img src={`https://i.ytimg.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-300 to-rose-400" />
              )}
              {s.status === 'live' ? (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-extrabold flex items-center gap-1">
                  <Radio className="w-3 h-3" /> LIVE
                </div>
              ) : (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-white text-[10px] font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeUntil(s.scheduled_at)}
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.title}</p>
              {s.scheduled_at && s.status === 'scheduled' && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {new Date(s.scheduled_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
