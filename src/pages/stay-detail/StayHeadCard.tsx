/**
 * 🏨 숙소 상세 폰 머리 — 이용권 상세 머리(`PassHeadCard`)와 **같은 순서·같은 크기** (2026-11-04)
 *
 * 대표 *"왜 기존 이용권이랑 숙소 이용권이 서로 다른거야"* → *"합쳐줘"*.
 * 두 상세는 이미 같은 부품(떠 있는 머리·사진·구역 탭·팔아보기·찜/담기/공유·바탕)을 쓰는데,
 * 사진 바로 아래 머리만 달랐다:
 *
 *     이용권  [가게 · 종류 · 지역 13px] → 제목 → [★ 4.5 (12) · N명 구매] → 가격(24px)
 *     숙소    [성급 12px — 37/49건은 빈 줄] → 제목 → [📍 주소 12px] → [★ 4.5 (12개 리뷰)]   ← 가격 없음
 *
 * ⇒ 이용권과 같은 네 줄로. 주소 줄은 이용권처럼 걷는다 — 아래 '위치' 구역이 같은 말을 한다(2026-11-02 C안).
 *
 * ## 서버가 먼저 그리는 범위
 * [유형 · 성급 · 지역] 줄과 제목까지는 워커(`stay-detail-ssr-body.ts`)가 **같은 클래스(`STAY_HEAD`)·같은
 * 함수(`staySubLine`)** 로 미리 그린다. 별점·가격은 그 **아래**라 나중에 채워져도 위가 안 움직인다
 * (가격은 객실 조회 뒤에야 안다 — 서버 시드엔 객실 값이 날짜에 따라 달라 그리지 않는다).
 */
import { formatNumber } from '@/utils/format'
import StarRating from '@/components/deal/StarRating'
import { STAY_HEAD, staySubLine } from '@/shared/stay-head'

const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function StayHeadCard({ stay, name, minPrice, priceLabel }: {
  stay: { property_type?: string | null; star_rating?: number | null; address?: string | null; region_sido?: string | null; region_sigungu?: string | null; avg_rating?: number | null; review_count?: number | null }
  name: string
  /** 고른 날짜·인원에 팔 수 있는 객실의 최저 총액. 모르면(조회 중·매진) 가격 줄을 안 그린다. */
  minPrice: number | null
  /** 가격이 무엇의 값인지 — `2박 총액` · `숙소 이용권 1박` */
  priceLabel: string
}) {
  const rv = Number(stay.avg_rating) || 0
  const rc = Number(stay.review_count) || 0
  const hasReviews = rv > 0 && rc > 0
  return (
    <div className={STAY_HEAD.titleBlock}>
      {/* ⚠️ 값이 없어도 div 는 그린다 — 서버 첫 화면도 그린다(`mb-1` 4px 가 자리에 남아야 안 튄다). */}
      <div className={STAY_HEAD.metaRow}>{staySubLine(stay)}</div>
      <h1 className={STAY_HEAD.h1}>{name}</h1>
      {hasReviews && (
        <div className="mt-2 flex items-center gap-2 text-[13px]">
          <StarRating value={rv} size={12} />
          <b className="font-medium text-gray-900 dark:text-white">{rv.toFixed(1)}</b>
          <button type="button" onClick={() => goTo('stay-sec-reviews')} className="bg-transparent border-0 p-0 cursor-pointer text-gray-500 dark:text-gray-400">({formatNumber(rc)})</button>
        </div>
      )}
      {minPrice != null && minPrice > 0 && (
        <div className="mt-3">
          <div className="text-[13px] text-gray-500 dark:text-gray-400">{priceLabel}</div>
          <div className="text-[24px] font-bold tracking-[-.02em] text-gray-900 dark:text-white tabular-nums">{formatNumber(minPrice)}원~</div>
        </div>
      )}
    </div>
  )
}
