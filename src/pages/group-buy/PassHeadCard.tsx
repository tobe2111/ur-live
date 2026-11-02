/**
 * 🎟️ 이용권 상세 머리 — 사진 **아래** 평면 (2026-10-24 대표 승인 "그루폰식으로 하자")
 *
 * 🔤 2026-10-25 대표 확정 **D안**(*"이용권 상세는 D"*) — 크기 위계:
 *   [가게 · 종류 · 지역](작은 회색) → 제목(h1) → [별점 · 리뷰 · N명이 샀어요] → [주소 ····· 거리]
 *   → **가격**(정가 취소선 / 할인율 빨강 + 판매가 28px). 가격이 머리로 올라왔다 — 사진 다음에 사람이 찾는 것은
 *   "무엇 · 얼마" 이고, 옵션 카드는 고른 옵션과 구매만 말한다(한 화면에 큰 가격은 한 번).
 *
 * ## 서버가 먼저 그리는 범위
 * 가게 줄 · 제목까지는 워커가 같은 클래스(`PASS_HEAD`)·같은 함수(`passSubLine`)로 미리 그린다
 * (`worker/utils/detail-ssr-body.ts`). 주소·거리·별점은 그 **아래**라 나중에 채워져도 위가 안 움직인다.
 * (거리는 내 위치 기준이라 서버가 모른다 — 2026-09-16 에 경계를 h1 로 잡은 이유 그대로다.)
 */
import { formatNumber } from '@/utils/format'
import { PASS_HEAD, passSubLine } from '@/shared/pass-head'
import StarRating from '@/components/deal/StarRating'

const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function PassHeadCard({
  merchant, category, address, onnuri, isPrelaunch, name, distKm, buyers, rating, reviewCount,
  unitPrice, refPrice, discountPct,
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
  unitPrice?: number
  refPrice?: number
  discountPct?: number
}) {
  const sub = passSubLine({ restaurant_name: merchant, category, restaurant_address: address })
  const rv = Number(rating) || 0
  const rc = Number(reviewCount) || 0
  const hasReviews = rv > 0 && rc > 0
  return (
    <div className={PASS_HEAD.card}>
      {sub && (
        <div className={PASS_HEAD.merchant}>
          {sub}
          {/* 🏪 2026-07-05 온누리 가맹 뱃지 (B2G — "온누리 사용 가능 표시" 약속) */}
          {onnuri && <span className={PASS_HEAD.onnuri}>온누리 사용 가능</span>}
        </div>
      )}
      <h1 className={PASS_HEAD.h1}>{name}</h1>
      {isPrelaunch && <span className={PASS_HEAD.prelaunch}>오픈 예정 · 사전 응모 받는 중</span>}

      {(hasReviews || buyers > 0) && (
        <div className="mt-2 flex items-center flex-wrap gap-x-2 gap-y-1 text-[13px]">
          {hasReviews && (
            <>
              <StarRating value={rv} size={13} />
              <b className="font-medium" style={{ color: 'var(--gbd-ink)' }}>{rv.toFixed(1)}</b>
              <button type="button" onClick={() => goTo('gb-sec-reviews')} className="bg-transparent border-0 p-0 underline underline-offset-[3px] cursor-pointer" style={{ color: 'var(--gbd-sub)' }}>리뷰 {formatNumber(rc)}개</button>
            </>
          )}
          {hasReviews && buyers > 0 && <span aria-hidden="true" style={{ color: 'var(--gbd-sub2)' }}>·</span>}
          {buyers > 0 && <span style={{ color: 'var(--gbd-sub)' }}>{formatNumber(buyers)}명이 샀어요</span>}
        </div>
      )}
      {(address || distKm != null) && (
        <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
          {address
            ? <button type="button" onClick={() => goTo('gb-sec-location')} className="min-w-0 truncate text-left bg-transparent border-0 p-0 underline underline-offset-[3px] cursor-pointer" style={{ color: 'var(--gbd-sub)' }}>{address}</button>
            : <span />}
          {distKm != null && <span className="shrink-0" style={{ color: 'var(--gbd-sub)' }}>{distKm}km</span>}
        </div>
      )}

      {unitPrice != null && unitPrice > 0 && (
        <div className="mt-4">
          {refPrice != null && refPrice > unitPrice && <div className="text-[13px]" style={{ color: 'var(--gbd-sub)' }}><s className="ur-strike [text-decoration:none]">{formatNumber(refPrice)}원</s></div>}
          <div className="flex items-baseline gap-2">
            {!!discountPct && discountPct > 0 && <span className="text-[24px] font-bold" style={{ color: 'var(--sale)' }}>{discountPct}%</span>}
            <span className="text-[28px] font-bold tracking-[-.02em]" style={{ color: 'var(--gbd-ink)' }}>{formatNumber(unitPrice)}원</span>
          </div>
        </div>
      )}
    </div>
  )
}
