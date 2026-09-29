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
 * ⭐ **별점·구매수는 없다**(2026-09-28 대표 결재 `2026-09-28-ushop-star-rating.md` 3번:
 *    *"유어샵 목록에 별점은 보이지 않게 해줘도 돼"* → 선택지 3 "가격·할인·거리로만 판단하게 하고,
 *    진짜 리뷰가 쌓이면 그때 켠다"). 라이브 유어샵 핀은 전부 데모·플랫폼 상품이라 별점(4.6~4.7)도
 *    구매수(54~140)도 **시드값**이다. 없는 신뢰를 지어내지 않는 쪽이 안전하고, 나중에 켜는 것이
 *    끄는 것보다 쉽다. ⇒ `meta` 를 넘기지 않는다(`DealRow` 는 없으면 그 줄을 아예 안 그린다).
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
import DealRow from '@/components/deal/DealRow'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { CuratorPin } from '@/features/curator/api/curator-api'

export default memo(function PinRow({ pin, handle, order, prefetch }: {
  pin: CuratorPin
  handle: string
  /** 주인이 정한 순서(1부터). **화면 순서가 아니다** — 위 ① 참조. */
  order: number
  prefetch?: () => void
}) {
  const img = pin.thumbnail || pin.image_url || ''

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
        </>
      }
      thumbSize="lg"
      leading={
        /*
         * 🩸 2026-09-29 (대표 *"세련된 느낌이 없다"* 진단) — 순번을 **사진 밖**으로 옮겼다.
         *   종전엔 흰 원이 사진 좌상단에 얹혀 있었다. 순번은 지울 수 없지만(위 ① — SNS 에서
         *   "N번 사세요" 로 부르는 주소다) 사진의 가장 좋은 자리를 덮을 이유는 없다.
         *   2026-08-31 대표 *"할인율이 사진 안으로 들어가면 안돼"* 와 같은 판단이다.
         *   밖으로 나오니 흰 원(어떤 사진 위에서도 읽히게)이 필요 없어져 회색 숫자로 족하다.
         */
        <span className="w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-gray-400 dark:text-gray-500">
          {order}
        </span>
      }
      eyebrow={pin.restaurant_name || undefined}
      title={pin.product_name}
      price={pin.price}
      originalPrice={pin.original_price ?? undefined}
      discountPct={Number(pin.discount_rate) || 0}
      unit={pin.deal_only === 1 ? '딜' : '원'}
    />
  )
})
