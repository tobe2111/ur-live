import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import { LiveStream } from '@/components/seller/public/seller-public-types'

interface StreamCardProps {
  stream: LiveStream
  onClick: () => void
}

export default function SellerStreamCard({ stream, onClick }: StreamCardProps) {
  const { t } = useTranslation()
  const isLive = stream.status === 'live'
  const thumb = stream.youtube_video_id ? `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg` : null

  return (
    <button onClick={onClick} className="text-left active:scale-[0.98] transition-transform">
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[#1A1A1A]">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />}
        {isLive ? (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-[#020202] rounded-full animate-pulse" />LIVE
          </span>
        ) : stream.status === 'scheduled' ? (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded">{t('seller.scheduledLabel')}</span>
        ) : null}
        {isLive && stream.viewer_count !== undefined && (
          <span className="absolute bottom-2 left-2 text-white text-[10px] flex items-center gap-0.5 drop-shadow-lg">
            <Eye className="w-3 h-3" /> {(stream.viewer_count || 0).toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-800 mt-1.5 line-clamp-2 font-medium">{stream.title}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {stream.viewer_count !== undefined ? `👁 ${(stream.viewer_count || 0).toLocaleString()}` : ''}
        {stream.created_at ? ` · ${new Date(stream.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}` : ''}
      </p>
    </button>
  )
}
