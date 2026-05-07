/**
 * 🛡️ 2026-05-07: Replay 시 상품별 chapter 마커.
 *
 * 라이브 방송 중 셀러가 "현재 상품" 변경 시 자동 기록된 timestamp 를
 * 클릭 가능한 chapter 리스트로 보여줌. 시청자는 원하는 상품 시점으로 점프.
 *
 * Backend: GET /api/streams/:id/product-timestamps
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface Chapter {
  product_id: number
  offset_sec: number
  created_at: string
  name: string
  image_url: string | null
  price: number
}

interface Props {
  streamId: number | string
  onJumpTo?: (offsetSec: number) => void
  className?: string
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ReplayChapterMarkers({ streamId, onJumpTo, className }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get(`/api/streams/${streamId}/product-timestamps`)
      .then(r => {
        if (cancelled) return
        if (r.data?.success) setChapters(r.data.data || [])
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [streamId])

  if (loading) return null
  if (chapters.length === 0) return null

  return (
    <div className={className}>
      <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
        📍 상품별 타임라인 ({chapters.length})
      </p>
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {chapters.map((ch, i) => (
          <button
            key={`${ch.product_id}-${ch.offset_sec}`}
            onClick={() => onJumpTo?.(ch.offset_sec)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] hover:border-blue-300 dark:hover:border-blue-500 transition-colors text-left"
          >
            <span className="shrink-0 w-12 text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 text-center">
              {formatTime(ch.offset_sec)}
            </span>
            {ch.image_url && (
              <img src={ch.image_url} alt={ch.name} className="w-10 h-10 rounded-md object-cover shrink-0" loading="lazy" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{ch.name}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {ch.price ? `${ch.price.toLocaleString('ko-KR')}원` : ''}
              </p>
            </div>
            <span className="shrink-0 text-[10px] text-gray-400">#{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
