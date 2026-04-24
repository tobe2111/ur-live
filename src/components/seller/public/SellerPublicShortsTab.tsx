import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Play, Eye } from 'lucide-react'
import { Short, ThemeClasses } from '@/components/seller/public/seller-public-types'

interface SellerPublicShortsTabProps {
  shorts: Short[]
  isOwner: boolean
  T: ThemeClasses
}

export default function SellerPublicShortsTab({ shorts, isOwner, T }: SellerPublicShortsTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (shorts.length === 0) {
    return (
      <div className="text-center py-16">
        <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('seller.publicPage.noVideos')}</p>
        {isOwner && <button onClick={() => navigate('/seller/shorts')} className="mt-3 text-sm text-blue-500 font-medium">{t('seller.publicPage.registerVideo')}</button>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {shorts.map(s => (
        <div key={s.id} className="rounded-xl overflow-hidden bg-[#1A1A1A]">
          {s.youtube_video_id ? (
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${s.youtube_video_id}`}
                title={s.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-200 flex items-center justify-center"><Play className="w-6 h-6 text-gray-400" /></div>
          )}
          <div className="p-2">
            <p className={`text-[11px] font-medium ${T.text} line-clamp-2`}>{s.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
              {s.product_name && (
                <button onClick={() => s.product_id && navigate(`/products/${s.product_id}`)} className="text-[10px] text-pink-500 font-medium">
                  🍽️ {s.product_name}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
