/**
 * 🎟️ 이용권 상세 머리 — 사진 **아래** 평면 (2026-10-24 대표 승인 "그루폰식으로 하자")
 *
 * 순서는 그루폰 상세 그대로다:
 *   제목(h1) → [가게 · 종류 · 지역] → [주소(누르면 매장 위치) ····· 거리] → [별점 · 리뷰 N개 · N명이 샀어요]
 * 가격은 여기서 빠졌다 — 아래 '옵션 선택' 카드(`PassOptionCard`)가 정가·판매가·할인·구매를 함께 말한다.
 *
 * ## 서버가 먼저 그리는 범위
 * 제목 · 가게 줄까지는 워커가 같은 클래스(`PASS_HEAD`)·같은 함수(`passSubLine`)로 미리 그린다
 * (`worker/utils/detail-ssr-body.ts`). 주소·거리·별점은 그 **아래**라 나중에 채워져도 위가 안 움직인다.
 * (거리는 내 위치 기준이라 서버가 모른다 — 2026-09-16 에 경계를 h1 로 잡은 이유 그대로다.)
 */
import { formatNumber } from '@/utils/format'
import { PASS_HEAD, passSubLine } from '@/shared/pass-head'
import StarRating from '@/components/deal/StarRating'

const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function PassHeadCard({
  merchant, category, address, onnuri, isPrelaunch, name, distKm, buyers, rating, reviewCount,
}: {
  merchant?: string | null
  category?: string | null
  address?: string | null
  onnuri?: boolean
  isPrelaunch: boolean
  name: string
  distKm: string | number | null
  buyers: number
  rating?: number | null
  reviewCount?: number | null
}) {
  const sub = passSubLine({ restaurant_name: merchant, category, restaurant_address: address })
  const rv = Number(rating) || 0
  const rc = Number(reviewCount) || 0
  const hasReviews = rv > 0 && rc > 0
  return (
    <div className={PASS_HEAD.card}>
      <h1 className={PASS_HEAD.h1}>{name}</h1>
      {sub && (
        <div className={PASS_HEAD.merchant}>
          {sub}
          {/* 🏪 2026-07-05 온누리 가맹 뱃지 (B2G — "온누리 사용 가능 표시" 약속) */}
          {onnuri && <span className={PASS_HEAD.onnuri}>온누리 사용 가능</span>}
        </div>
      )}
      {isPrelaunch && <span className={PASS_HEAD.prelaunch}>오픈 예정 · 사전 응모 받는 중</span>}

      {(address || distKm != null) && (
        <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
          {address
            ? <button type="button" onClick={() => goTo('gb-sec-location')} className="min-w-0 truncate text-left bg-transparent border-0 p-0 underline underline-offset-[3px] cursor-pointer" style={{ color: 'var(--gbd-ink)' }}>{address}</button>
            : <span />}
          {distKm != null && <span className="shrink-0" style={{ color: 'var(--gbd-sub)' }}>{distKm}km</span>}
        </div>
      )}

      {(hasReviews || buyers > 0) && (
        <div className="mt-2 flex items-center flex-wrap gap-x-2 gap-y-1 text-[13px]">
          {hasReviews && (
            <>
              <StarRating value={rv} size={13} />
              <b className="font-bold" style={{ color: 'var(--gbd-ink)' }}>{rv.toFixed(1)}</b>
              <button type="button" onClick={() => goTo('gb-sec-reviews')} className="bg-transparent border-0 p-0 underline underline-offset-[3px] cursor-pointer" style={{ color: 'var(--gbd-sub)' }}>리뷰 {formatNumber(rc)}개</button>
            </>
          )}
          {hasReviews && buyers > 0 && <span aria-hidden="true" style={{ color: 'var(--gbd-sub2)' }}>·</span>}
          {buyers > 0 && <span style={{ color: 'var(--gbd-sub)' }}>{formatNumber(buyers)}명이 샀어요</span>}
        </div>
      )}
    </div>
  )
}
