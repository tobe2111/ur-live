/**
 * 🎫 2026-09-28 (대표 확정 **s3 밀도형** — 11라운드 37안의 본문) 유어샵 한 줄.
 *
 * 왜 2열 격자에서 줄로 바꿨나(라이브 실측 근거):
 *   유어샵은 **3곳 · 핀 8개 · 최다 5개**다. 2열 격자는 그 수에서 첫 화면에 1.5개만 보여 주고
 *   헤더 chrome 이 화면의 76%를 먹었다. 줄로 내리면 같은 화면에 3~4개가 들어온다.
 *
 * 🔴 **줄 카드는 새로 그리지 않는다** — `components/deal/DealRow` 가 2026-09-03 에 만들어진
 *    **줄 한 벌 SSOT** 다(그 전엔 화면마다 따로 그려 같은 딜이 자리마다 다른 그림이었다).
 *    여기서는 그 부품에 유어샵 고유 두 가지만 얹는다:
 *      ① **순번 배지** — SNS 에서 *"N번 이용권 사세요"* 로 부르는 **주소**다(2026-08-31 대표).
 *         ⚠️ 그래서 번호는 **정렬과 무관하게 주인이 정한 순서**여야 한다. 화면 순서로 매기면
 *            할인율순으로 본 손님에게 3번이 다른 것을 가리킨다 — 돈이 새는 쪽으로 깨진다.
 *      ② (끝.)
 *
 * 🩸 **찜 하트는 일부러 뺐다**(2026-09-28 렌더 실측). 격자 카드(`GroupBuyFeedCard`)엔 있었지만
 *    `WishlistHeart` 는 `.ur-appear`(기본 `opacity:0`, `.group:hover` 에서만 나타남)라 **사진 위**에
 *    떠 있을 것을 전제로 만들어졌다. `DealRow` 루트엔 `group` 이 없어 **PC 에선 영영 안 보이고**
 *    폰(`hover: none`)에서만 보인다 — 기기마다 다른 기능이 된다. 게다가 `bg-white/85 backdrop-blur`
 *    는 흰 카드 위에서 아무것도 아니다. 확정 시안(s3)의 줄에도 하트가 없고, `DealRow` 를 쓰는
 *    다른 다섯 화면도 하트를 달지 않는다. ⇒ 찜은 상세 화면에 있다.
 *
 * 🔒 목적지는 반드시 `/u/:handle/p/:productId` — 그 경로가 클릭을 기록하고 소개비 귀속을 붙인다.
 *    상세로 직행시키면 화면은 같은데 귀속이 조용히 사라진다.
 */
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import DealRow from '@/components/deal/DealRow'
import StarRating from '@/components/deal/StarRating'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import type { CuratorPin } from '@/features/curator/api/curator-api'

export default memo(function PinRow({ pin, handle, order, prefetch }: {
  pin: CuratorPin
  handle: string
  /** 주인이 정한 순서(1부터). **화면 순서가 아니다** — 위 ① 참조. */
  order: number
  prefetch?: () => void
}) {
  const { t } = useTranslation()
  const img = pin.thumbnail || pin.image_url || ''
  const reviews = Number(pin.review_count) || 0
  const rating = Number(pin.avg_rating) || 0
  const sold = Number(pin.sold_count) || 0

  // ⭐ 리뷰가 0 이면 이 줄을 **통째로 뺀다**(자리도 안 남긴다).
  //   라이브 실측(2026-09-27): 유어샵 핀 8개는 전부 데모·플랫폼 상품이라 별점이 미리 채워져 있고,
  //   **실제 사업자 상품 2개만 리뷰 0** 이다. 빈 별 다섯을 그리면 진짜 매장만 "0점"처럼 보인다.
  const meta = reviews > 0 ? (
    <span className="flex items-center gap-1.5">
      <StarRating value={rating} />
      <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-200">{rating.toFixed(1)}</span>
      <span className="tabular-nums">({formatNumber(reviews)})</span>
      {sold > 0 && <span className="tabular-nums">· {t('curator.soldN', { defaultValue: '구매' })} {formatNumber(sold)}</span>}
    </span>
  ) : undefined

  return (
    <DealRow
      to={`/u/${handle}/p/${pin.product_id}`}
      prefetch={prefetch}
      thumbStyle={pin.dominant_color ? { background: pin.dominant_color } : undefined}
      thumb={
        <>
          {img && (
            <img
              src={cfImage(img, { width: 240, format: 'auto' }) || img}
              alt=""
              width={240}
              height={240}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => cfImageOnError(e.currentTarget, img)}
            />
          )}
          {/* 사진 위 유일한 표식이라 테마와 무관하게 흰 원이어야 어떤 사진에서도 읽힌다. */}
          <span className="absolute top-1 left-1 z-10 w-[18px] h-[18px] rounded-full bg-white text-[#16181C] text-[10px] font-black tabular-nums flex items-center justify-center shadow-lift pointer-events-none">  {/* light-fixed: 사진 위 */}
            {order}
          </span>
        </>
      }
      eyebrow={pin.restaurant_name || undefined}
      title={pin.product_name}
      price={pin.price}
      originalPrice={pin.original_price ?? undefined}
      discountPct={Number(pin.discount_rate) || 0}
      unit={pin.deal_only === 1 ? '딜' : '원'}
      meta={meta}
    />
  )
})
