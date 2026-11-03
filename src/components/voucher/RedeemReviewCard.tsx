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
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-03 16차 ⑨ — 사용 완료 뒤 리뷰 카드가 아래에서 올라오고, 별을 누르면 그 별까지 하나씩 톡톡 켜진 뒤(0.32초) 쓰기 칸이 열린다.
//   '리뷰 고마워요!' 도 톡 튀며 나타난다. (리뷰 쓰기 화면의 별점과 같은 움직임 — 1·10차)
injectMotionCss('ur-m-redeemreview', `@keyframes ur-rr-in { from { opacity: 0; transform: translateY(24px); } }@keyframes ur-rr-pop { 0% { transform: scale(.5); } 60% { transform: scale(1.2); } 100% { transform: none; } }.ur-rr-in { animation: ur-rr-in .45s cubic-bezier(.2,1,.3,1) .2s backwards; }.ur-rr-star { animation: ur-rr-pop .3s cubic-bezier(.3,1.3,.5,1) backwards; }.ur-rr-thx { display: inline-block; animation: ur-rr-pop .4s cubic-bezier(.3,1.3,.5,1); }@media (prefers-reduced-motion: reduce){.ur-rr-in,.ur-rr-star,.ur-rr-thx{animation:none!important}}`)

const ReviewForm = lazy(() => import('@/pages/product-detail/ProductReviews').then((m) => ({ default: m.ReviewForm })))

export default function RedeemReviewCard({ productId }: { productId: number }) {
  const [picked, setPicked] = useState(0)
  const [done, setDone] = useState(false)
  const [filling, setFilling] = useState(0) // 🎬 16차 ⑨ — 누른 별까지 잠깐 채워 보여 준 뒤 쓰기 칸으로
  const pick = (n: number) => {
    if (filling) return
    let reduce = false
    try { reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { /* 미지원 */ }
    if (reduce) { setPicked(n); return }
    setFilling(n)
    setTimeout(() => setPicked(n), 320)
  }

  if (done) {
    return <p className="mt-5 text-[15px] font-bold text-gray-900 dark:text-white"><span className="ur-rr-thx">리뷰 고마워요!</span></p>
  }

  return (
    <div className="mt-5 text-left">
      {picked === 0 ? (
        <div className="ur-rr-in rounded-2xl bg-warm px-4 py-4">
          <p className="text-[16px] font-semibold text-gray-900 dark:text-white">어떠셨어요?</p>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">리뷰를 남기면 딜 리워드를 드려요</p>
          <div className="mt-3 flex justify-between" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={false}
                aria-label={`${n}점`}
                onClick={() => pick(n)}
                className="w-12 h-12 flex items-center justify-center rounded-full active:bg-black/[0.04] dark:active:bg-white/[0.06]"
              >
                <StarIcon
                  filled={n <= filling}
                  className={`w-8 h-8 ${n <= filling ? 'text-amber-400 fill-amber-400 ur-rr-star' : 'text-gray-300 dark:text-gray-600'}`}
                  style={n <= filling ? { animationDelay: `${(n - 1) * 50}ms` } : undefined}
                />
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
