import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import SellerStreamCard from '@/components/seller/public/SellerStreamCard'
import { LiveStream } from '@/components/seller/public/seller-public-types'

interface SellerPublicLiveTabProps {
  streams: LiveStream[]
}

export default function SellerPublicLiveTab({ streams }: SellerPublicLiveTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (streams.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">{t('seller.publicPage.noLiveRecords')}</div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {streams.map(s => (
        <SellerStreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
      ))}
    </div>
  )
}
