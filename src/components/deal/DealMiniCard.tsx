/**
 * 🎫 미니 카드 — 딜 카드 3형태 중 **작은 정사각** 한 벌 (2026-09-03)
 *
 *   대표 질문: *"이런 이용권들 디자인이 왜 통합적으로 관리가 안되는거지?"*
 *   답: 격자(`GroupBuyFeedCard`)만 SSOT 였고 **미니와 줄은 화면마다 손으로 그려져 있었다.**
 *   그래서 홈 '우리 동네딜' 은 2026-06-10 의 **대표색 그라데이션**(사진 하단이 상품색으로 번지고
 *   글자가 그 위에 얹히는) 룩에 그대로 멈춰 있었다 — 09-02 표면 체계가 걷어낸 바로 그 룩이다.
 *   같은 홈 화면 위쪽 격자 카드는 흰 카드인데 아래 미니만 색 카드라 한 서비스로 안 보였다.
 *
 *   ⚠️ 이 파일이 미니 형태의 유일한 정의다. 새 화면이 "작은 사각 딜"을 그릴 일이 생기면
 *      여기에 prop 을 더하지, 그 화면에 마크업을 새로 쓰지 말 것(`check-deal-card-unify` 가 막는다).
 */
import { memo } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'

export interface DealMiniCardProps {
  to: string
  imageUrl?: string | null
  title: string
  /** 원 단위 숫자. `unit` 과 함께 카드 안에서 포매팅한다(화면마다 다르게 찍히던 것 통일). */
  price?: number | null
  unit?: '원' | '딜'
  /** 가로 스트립처럼 폭이 고정된 자리에서 쓰는 추가 클래스(`shrink-0 w-24` 등). */
  className?: string
  imgWidth?: number
}

/**
 * 표면 규칙(09-02) 그대로 — 흰 카드 + `shadow-lift`, 테두리 0, 숫자가 주인공(잉크 볼드).
 * 사진은 카드 안에서 모서리를 갖고, 대표색 번짐/그라데이션은 쓰지 않는다.
 */
export default memo(function DealMiniCard({
  to, imageUrl, title, price, unit = '원', className = '', imgWidth = 200,
}: DealMiniCardProps) {
  return (
    <Link
      to={to}
      className={`block text-left rounded-2xl overflow-hidden bg-white dark:bg-[#1D1F29] shadow-lift active:scale-[0.98] transition-transform ${className}`}
    >
      <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-[#222225]">
        {imageUrl ? (
          <img
            src={cfImage(imageUrl, { width: imgWidth, format: 'auto' }) || imageUrl}
            alt={title}
            width={imgWidth}
            height={imgWidth}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={(e) => cfImageOnError(e.currentTarget, imageUrl)}
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="px-2 pt-1.5 pb-2">
        <p className="text-[11.5px] leading-tight line-clamp-1 text-gray-600 dark:text-gray-300">{title}</p>
        {price != null && (
          <p className="mt-0.5 text-[13px] font-extrabold tracking-tight text-gray-900 dark:text-white">
            {formatNumber(price)}{unit === '딜' ? ' 딜' : '원'}
          </p>
        )}
      </div>
    </Link>
  )
})
