import { MapPin } from 'lucide-react'
import StarRating from '@/components/deal/StarRating'

/**
 * 🏷️ 이용권 상세 **제목 헤더** — PC 전용 (2026-08-19 대표 확정: 상세 시안 **1안 "그루폰 정석"**).
 *
 * ## 왜 사진 위로 올렸나
 * 이전 PC 화면은 [사진 800px] → 그 **아래**에 제목·매장·주소였다. 첫 화면에 사진만 가득 차고
 * *"무엇을 파는지 / 얼마나 좋은지"* 는 스크롤해야 나왔다. 그루폰은 반대다 — 제목·별점·위치가
 * 사진 **위**에 있고 사진은 그 근거로 따라온다. 대표가 1안을 고른 이유가 이것이다.
 *
 * ## 모바일은 왜 안 바꾸나
 * 세로 화면에서는 사진이 먼저 오는 게 자연스럽고(썸네일→상세의 시각적 연결), 제목은 바로 아래
 * 한 스크롤 안에 들어온다. PC 만 폭이 남아서 생기던 문제였다. ⇒ 이 컴포넌트는 `hidden lg:block`.
 *
 * 🧩 2026-08-19 (대표 — "앞으로는 다른 카테고리와 함께"): **상세 종류를 가리지 않는다.**
 *   공구/이용권(`.gbd` 표면)과 숙소(일반 tailwind 표면)가 같이 쓴다. 그래서 색을 `.gbd` CSS
 *   변수에서 **tailwind 토큰으로 옮겼다** — 그 변수는 `.gbd` 밖에서 정의되지 않아, 그대로 뒀다면
 *   숙소 상세에서 제목이 안 보였을 것이다(같은 컴포넌트를 두 표면에서 쓰려면 색이 표면에
 *   의존하면 안 된다).
 */
export default function DetailTitleHeader({
  name, storeName, address, phone, rating, reviewCount, onnuri,
}: {
  name: string
  storeName?: string
  address?: string
  phone?: string
  /** 평균 별점(0이면 별을 그리지 않는다 — 빈 별 5개는 "나쁨"으로 읽힌다). */
  rating?: number
  reviewCount?: number
  onnuri?: boolean
}) {
  const hasRating = Number(rating) > 0
  return (
    <header className="hidden lg:block lg:max-w-[1200px] lg:mx-auto lg:pt-6 lg:pb-3">
      {storeName && (
        <div className="text-[12.5px] font-bold tracking-[.01em] text-brand">
          {storeName} · 정식 등록 매장
          {onnuri && (
            <span className="ml-1.5 px-1.5 py-[1px] rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold align-middle">온누리 사용 가능</span>
          )}
        </div>
      )}
      <h1 className="mt-1.5 text-[29px] leading-[1.24] font-black tracking-[-.028em] text-gray-900 dark:text-white">{name}</h1>
      <div className="mt-2.5 flex items-center gap-2.5 flex-wrap text-[13.5px] text-gray-500 dark:text-gray-400">
        {hasRating && (
          <span className="inline-flex items-center gap-1.5">
            <StarRating value={Number(rating)} size={15} />
            <b className="font-extrabold text-gray-900 dark:text-white">{Number(rating).toFixed(1)}</b>
            {Number(reviewCount) > 0 && <span className="text-gray-400 dark:text-gray-500">({reviewCount})</span>}
          </span>
        )}
        {address && (
          <span className="inline-flex items-center gap-1.5">
            {hasRating && <span className="text-gray-200 dark:text-[#2C2F35]">|</span>}
            <MapPin className="w-[15px] h-[15px] shrink-0" />
            {address}
          </span>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="font-semibold no-underline text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-[#2C2F35]">{phone}</a>
        )}
      </div>
    </header>
  )
}
