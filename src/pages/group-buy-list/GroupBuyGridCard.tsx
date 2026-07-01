// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 동네딜 그리드 카드(verbatim 추출).
//   동작/스타일 불변. React.memo 라 부모 재렌더 시 카드 재조정 0 (감사 권고 A9 유지).
import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Bell, MapPin, Store, Clock } from 'lucide-react'
import { usePrefetchGroupBuyProduct } from '@/hooks/queries'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { cardGradient } from '@/utils/card-gradient'
import { formatPrice } from '@/utils/currency'
import FcfsBadge from '@/features/group-buy/FcfsBadge'
import type { FcfsInfo } from '@/features/group-buy/useFcfs'
import { calcDiscountRate, formatTimeLeft } from './utils'
import type { GroupBuyProduct } from './types'

const GroupBuyGridCard = memo(function GroupBuyGridCard({
  p, idx, interested, onToggleInterest, fcfs,
}: {
  p: GroupBuyProduct
  idx: number
  interested: boolean
  onToggleInterest: (e: React.MouseEvent, productId: number, restaurantName?: string) => void
  fcfs?: FcfsInfo
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  // 🏁 2026-06-11 (플로우 감사 🟢): 메인 피드 카드(GroupBuyFeedCard)에만 있던 상세 prefetch 를
  //   동네딜 그리드에도 — hover/터치 시 상세 데이터 선로딩 → 클릭 시 fetch 워터폴 제거.
  const prefetch = usePrefetchGroupBuyProduct()
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  // 🏭 2026-06-05 (사용자 신고 — 깨진 이미지가 빈 카드로): onError 폴백.
  const [imgError, setImgError] = useState(false)
  const grad = cardGradient(cardColor)
  const discount = calcDiscountRate(p)
  const target = p.group_buy_target || 0
  const current = p.group_buy_current || 0
  // 🏭 2026-06-07 (사용자 요청): '현재 N명 참여중' 제거 — 즉시판매 단일가 모델에서 카드 참여 수 무의미.
  //   '달성' 뱃지(이미지 우상단)는 유지. 진행률 바 + 참여 인원 텍스트 삭제 → 업장명/주소/판매자 노출.
  const achieved = target > 0 && current >= target
  const timeLeft = formatTimeLeft(p.group_buy_deadline)
  return (
    <button
      onClick={() => navigate(`/group-buy/${p.id}`)}
      onMouseEnter={() => prefetch(p.id)}
      onTouchStart={() => prefetch(p.id)}
      onFocus={() => prefetch(p.id)}
      className="text-left active:scale-[0.98] transition-transform rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: grad.base }}
    >
      {/* 이미지 */}
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: grad.base }}>
        {p.image_url && !imgError ? (
          <img
            src={cfImage(p.image_url, { width: 400, format: 'auto' })}
            srcSet={cfSrcSet(p.image_url, 400)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
            alt={p.name}
            className="w-full h-full object-cover"
            loading={idx < 4 ? 'eager' : 'lazy'}
            fetchPriority={idx < 2 ? 'high' : 'auto'}
            decoding="async"
            onLoad={(e) => {
              const el = e.currentTarget
              el.style.opacity = '1'
              const color = extractDominantColor(el)
              if (color) {
                if (!cardColor) setCardColor(color)
                if (!p.dominant_color) reportDominantColor(p.id, color)
              }
            }}
            onError={() => setImgError(true)}
            style={{ opacity: idx < 4 ? 1 : 0, transition: 'opacity 200ms ease-out' }}
          />
        ) : (
          <div className="w-full h-full" />
        )}

        {/* 사진 하단 → 같은 카드색으로 번짐 (경계 제거) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />

        {/* 할인 뱃지 */}
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
            {t('groupBuy.maxDiscount', { defaultValue: '최대 -{{rate}}%', rate: discount })}
          </span>
        )}

        {/* 달성 뱃지 */}
        {achieved && !fcfs && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
            <CheckCircle2 className="w-3 h-3" />
            {t('groupBuy.achieved', { defaultValue: '달성' })}
          </span>
        )}

        {/* 🎯 추첨 응모 배지 (우상단) — 결제 없이 응모 → 추첨. 상세에서 응모 가능. */}
        {fcfs && <FcfsBadge info={fcfs} className="absolute top-2 right-2" />}

        {/* 관심 등록 */}
        <button
          onClick={(e) => onToggleInterest(e, p.id, p.restaurant_name)}
          className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur shadow-sm active:scale-90 transition-transform"
          aria-label={t('common.wishlist', { defaultValue: '관심 등록' })}
        >
          <Bell className={`w-3.5 h-3.5 ${interested ? 'text-gray-900 fill-gray-900 dark:text-white dark:fill-white' : 'text-gray-400'}`} />
        </button>
      </div>

      {/* 정보 — 카드 대표색 위에 올라가므로 글자색은 grad 로 자동 대비 (내용은 불변) */}
      <div className="px-2.5 pt-1 pb-2.5 flex flex-col flex-1" style={{ color: grad.text }}>
        <p className="text-[12px] leading-tight line-clamp-2">{p.name}</p>

        {/* 업장명 + 주소 (참여 인원 대신 — 즉시판매 단일가 모델: 참여 수는 카드에서 무의미) */}
        {p.restaurant_name && (
          <p className="text-[10px] mt-0.5 truncate font-medium" style={{ color: grad.sub }}>{p.restaurant_name}</p>
        )}
        {p.restaurant_address && (
          <p className="text-[10px] mt-0.5 truncate flex items-center gap-0.5" style={{ color: grad.sub }}>
            <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: grad.sub }} />
            <span className="truncate">{p.restaurant_address}</span>
          </p>
        )}

        {/* 가격 */}
        <div className="flex items-baseline gap-1 mt-1">
          {p.original_price && p.original_price > p.price && (
            <span className="text-[10px] line-through" style={{ color: grad.sub }}>{formatPrice(p.original_price)}</span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          {discount > 0 && (
            <span className="text-[13px] font-extrabold" style={{ color: grad.accent }}>{discount}%</span>
          )}
          <span className="text-[13px] font-extrabold">{formatPrice(p.price)}</span>
        </div>

        {/* 판매자 (참여 인원 표기 제거 — 즉시판매 단일가 모델) */}
        {p.seller_name && (
          <p className="text-[10px] mt-1.5 truncate flex items-center gap-1" style={{ color: grad.sub }}>
            <Store className="w-3 h-3 flex-shrink-0" style={{ color: grad.sub }} />
            <span className="truncate">
              {t('groupBuy.sellerLabel', { defaultValue: '판매자' })} · {p.seller_name}
            </span>
          </p>
        )}

        {/* 시간 */}
        {timeLeft && (
          <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: grad.sub }}>
            <Clock className="w-3 h-3" style={{ color: grad.sub }} />
            {timeLeft}
          </p>
        )}
      </div>
    </button>
  )
})

export default GroupBuyGridCard
