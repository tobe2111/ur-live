import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { ShoppingBag } from 'lucide-react'
import SEO from '@/components/SEO'

interface EmbedStream {
  id: number
  title: string
  youtube_video_id: string
  status: string
  current_product?: {
    id: number
    name: string
    price: number
    image_url: string
  } | null
}

export default function EmbedLivePage() {
  const { streamId } = useParams<{ streamId: string }>()
  const [stream, setStream] = useState<EmbedStream | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!streamId) return
    api.get(`/api/streams/${streamId}`)
      .then(r => {
        if (r.data.success) setStream(r.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [streamId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white text-sm">
        라이브를 찾을 수 없습니다
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <SEO title={stream.title || '라이브 임베드'} description="유어딜 라이브 임베드 위젯" url={`/embed/live/${streamId ?? ''}`} noindex />
      {/* YouTube 영상 */}
      {stream.youtube_video_id && (
        <iframe
          src={`https://www.youtube.com/embed/${stream.youtube_video_id}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0`}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* 상단 오버레이 - LIVE 뱃지 */}
      <div className="absolute top-3 left-3 z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90">
          <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-white">LIVE</span>
        </div>
      </div>

      {/* 하단 상품 카드 */}
      {stream.current_product && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-3 px-3">
          <a
            href={`https://live.ur-team.com/products/${stream.current_product.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white/95 backdrop-blur rounded-xl p-2.5"
          >
            {stream.current_product.image_url && (
              <img
                src={stream.current_product.image_url}
                alt=""
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{stream.current_product.name}</p>
              <p className="text-sm font-bold text-red-500 mt-0.5">
                {stream.current_product.price.toLocaleString()}원
              </p>
            </div>
            <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-black">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
          </a>
        </div>
      )}

      {/* ur-live 로고 */}
      <div className="absolute top-3 right-3 z-10">
        <a
          href={`https://live.ur-team.com/live/${streamId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm"
        >
          <span className="text-[9px] font-bold text-white/80">ur-live</span>
        </a>
      </div>
    </div>
  )
}
