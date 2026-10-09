/**
 * 🦦 이용권 사용 직후 "어떠셨어요?" (2026-10-09 대표 확정 시안 ① — "좋다 모두 해줘").
 *
 * 사용 순간은 서비스에서 가장 기분 좋은 순간인데, 종전 화면은 "사용 완료" 로 조용히 끝났다.
 * 그 자리에서 별점 한 번이면 리뷰가 시작되게 한다.
 *
 * 규칙
 *   · **취소 가능 시간이 끝난 뒤에만** 뜬다(부모가 정한다) — 첫 60초는 직원에게 보여주는 확인 화면이라
 *     그 위에 별점이 올라오면 화면이 무엇을 말하는지 흐려진다.
 *   · 별을 누르면 상품 상세의 **같은 리뷰 폼**이 그 별점으로 열린다(폼을 두 벌 만들지 않는다 — 보상 금액
 *     안내·사진 첨부·10자 규칙이 갈린다). 폼은 별을 누를 때 내려받는다.
 *   · 보상 금액은 이 카드가 말하지 않는다 — 폼이 서버 설정값으로 말한다(두 곳이 말하면 반드시 갈린다).
 */
import { lazy, Suspense, useState } from 'react'
import { StarIcon } from '@/components/icons/urdeal-icons'

const ReviewForm = lazy(() => import('@/pages/product-detail/ProductReviews').then((m) => ({ default: m.ReviewForm })))

export default function RedeemReviewCard({ productId }: { productId: number }) {
  const [picked, setPicked] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    return <p className="mt-5 text-[15px] font-bold text-gray-900 dark:text-white">리뷰 고마워요!</p>
  }

  return (
    <div className="mt-5 text-left">
      {picked === 0 ? (
        <div className="rounded-2xl bg-warm px-4 py-4">
          <p className="text-[17px] font-bold text-gray-900 dark:text-white">어떠셨어요?</p>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">리뷰를 남기면 딜 리워드를 드려요</p>
          <div className="mt-3 flex justify-between" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={false}
                aria-label={`${n}점`}
                onClick={() => setPicked(n)}
                className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/[0.04] dark:active:bg-white/[0.06]"
              >
                <StarIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Suspense fallback={<div className="h-40 rounded-2xl bg-warm" />}>
          <ReviewForm productId={productId} initialOpen initialRating={picked} onSubmitted={() => setDone(true)} />
        </Suspense>
      )}
    </div>
  )
}
