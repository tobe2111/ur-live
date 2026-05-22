/**
 * /live/recap/:id — 종료된 라이브 다시보기 (VOD)
 * YouTube recordFromStart=true 로 생성된 VOD 를 동일 video_id 로 임베드.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, ShoppingBag, Clock } from 'lucide-react'
import api from '@/lib/api'
import { onYoutubeThumbError } from '@/utils/youtube-thumb'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'

interface RecapStream {
  id: number
  title: string
  youtube_video_id: string | null
  seller_name: string | null
  viewer_count: number
  ended_at: string | null
  created_at: string
  current_product: { id: number; name: string; price: number; image_url: string | null } | null
}

export default function LiveRecapPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [stream, setStream] = useState<RecapStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [relatedStreams, setRelatedStreams] = useState<RecapStream[]>([])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/api/streams/${id}`)
      .then(res => {
        if (res.data.success) setStream(res.data.data)
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[LiveRecap] stream load failed:', e) })
      .finally(() => setLoading(false))

    api.get('/api/streams?status=ended&limit=6')
      .then(res => {
        if (res.data.success) {
          setRelatedStreams((res.data.data || []).filter((s: RecapStream) => String(s.id) !== id))
        }
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[LiveRecap] related streams failed:', e) })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="h-10 w-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center text-white gap-4">
        <p className="text-lg font-bold">{t('recap.notFound', { defaultValue: '방송을 찾을 수 없어요' })}</p>
        <button onClick={() => navigate('/live')} className="px-5 py-2 bg-red-500 rounded-full text-sm font-bold">
          {t('recap.backToList', { defaultValue: '목록으로' })}
        </button>
      </div>
    )
  }

  const durationMin = stream.ended_at && stream.created_at
    ? Math.round((new Date(stream.ended_at).getTime() - new Date(stream.created_at).getTime()) / 60000)
    : null

  return (
    // 🛡️ 2026-05-20: VOD 재생 페이지 — PC 에선 비디오/메타 가운데 정렬 + ur-content-medium (1024px).
    <div className="min-h-screen bg-[#020202] text-white ur-content-medium">
      <SEO
        title={t('recap.seoTitle', { defaultValue: '{{title}} 다시보기 - 유어딜', title: stream.title })}
        description={t('recap.seoDesc', { defaultValue: '유어딜 라이브 방송 다시보기' })}
        url={`/live/recap/${id}`}
      />

      {/* 상단 뒤로가기 */}
      <div className="sticky top-0 z-20 bg-[#020202]/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.08]">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="font-bold text-sm truncate flex-1">{stream.title}</p>
      </div>

      {/* 비디오 영역 */}
      <div className="w-full aspect-video bg-black">
        {stream.youtube_video_id ? (
          <iframe
            src={`https://www.youtube.com/embed/${stream.youtube_video_id}?autoplay=1&rel=0&modestbranding=1`}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <p className="text-sm">{t('recap.noVideo', { defaultValue: 'VOD 준비 중' })}</p>
          </div>
        )}
      </div>

      {/* 스트림 메타 */}
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <h1 className="text-base font-bold mb-1">{stream.title}</h1>
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span className="font-medium text-white/70">{stream.seller_name}</span>
          {stream.viewer_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatNumber(stream.viewer_count)}
            </span>
          )}
          {durationMin && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {durationMin}{t('recap.minutes', { defaultValue: '분' })}
            </span>
          )}
        </div>

        {/* 방송 중 소개 상품 */}
        {stream.current_product && (
          <div
            className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate(`/products/${stream.current_product!.id}`)}
          >
            {stream.current_product.image_url && (
              <img src={stream.current_product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white/70 mb-0.5 flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                {t('recap.featuredProduct', { defaultValue: '방송 중 소개 상품' })}
              </p>
              <p className="text-sm font-bold truncate">{stream.current_product.name}</p>
              <p className="text-sm text-red-400 font-bold">{formatNumber(stream.current_product.price)}{t('ordersTab.won', { defaultValue: '원' })}</p>
            </div>
          </div>
        )}
      </div>

      {/* 다른 다시보기 */}
      {relatedStreams.length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-bold text-white/50 mb-3 uppercase tracking-wider">
            {t('recap.moreReplays', { defaultValue: '다른 다시보기' })}
          </p>
          <div className="flex flex-col gap-2">
            {relatedStreams.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/live/recap/${s.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-left active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                  {s.youtube_video_id ? (
                    <img
                      src={`https://i.ytimg.com/vi/${s.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={onYoutubeThumbError}
                    />
                  ) : (
                    <Eye className="w-4 h-4 text-white/20" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-white/40">{s.seller_name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
