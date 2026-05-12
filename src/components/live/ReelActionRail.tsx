import { useTranslation } from 'react-i18next'
import { ShoppingBag, MessageCircle } from 'lucide-react'
import KakaoShareButton from '@/components/KakaoShareButton'
import LiveDonation from '@/components/LiveDonation'
import HeartReaction from '@/components/live/HeartReaction'
import { glass } from '@/components/glass/glassTokens'
import type { Stream, Product } from '@/components/live/ReelCard'

interface ReelActionRailProps {
  stream: Stream
  safeProduct: Product
  isSeller: boolean
  streamProductCount: number
  onOpenProducts: () => void
  onOpenChat: () => void
}

export default function ReelActionRail({
  stream,
  safeProduct,
  isSeller,
  streamProductCount,
  onOpenProducts,
  onOpenChat,
}: ReelActionRailProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 shrink-0 pb-1 mr-2.5">
      {/* 1) 좋아요 (Heart) */}
      <div className="flex flex-col items-center gap-0.5">
        <HeartReaction />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{t('live.actionLike', { defaultValue: '좋아요' })}</span>
      </div>

      {/* 2) 상품 목록 */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onOpenProducts}
          className="flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ width: 44, height: 44, ...glass.actionRail }}
          aria-label={t('live.productAriaLabel', { defaultValue: '상품 목록' })}
        >
          <ShoppingBag style={{ width: 18, height: 18, color: '#fff' }} />
        </button>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          {t('live.productCountLabel', { count: streamProductCount, defaultValue: `상품 ${streamProductCount}` })}
        </span>
      </div>

      {/* 3) 선물 (LiveDonation) — 셀러는 미표시 */}
      {!isSeller && stream?.id && (
        <div className="flex flex-col items-center gap-0.5">
          <LiveDonation streamId={stream.id} />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{t('live.actionGift', { defaultValue: '선물' })}</span>
        </div>
      )}

      {/* 4) 채팅 토글 */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onOpenChat}
          className="flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ width: 44, height: 44, ...glass.actionRail }}
          aria-label={t('live.chatOpenAria', { defaultValue: '채팅 열기' })}
        >
          <MessageCircle style={{ width: 18, height: 18, color: '#fff' }} />
        </button>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{t('live.actionChat', { defaultValue: '채팅' })}</span>
      </div>

      {/* 5) 공유 */}
      <div className="flex flex-col items-center gap-0.5">
        <KakaoShareButton
          title={stream?.title || t('common.appName', { defaultValue: '유어딜 라이브' })}
          description={safeProduct?.name || t('live.broadcastInProgress', { defaultValue: '라이브 방송 중' })}
          imageUrl={safeProduct?.image_url}
          link={`/live/${stream?.id}`}
          compact
          className="flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ width: 44, height: 44, ...glass.actionRail }}
        />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{t('live.actionShare', { defaultValue: '공유' })}</span>
      </div>
    </div>
  )
}
