import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { HOME_CARD_IMG_WIDTH_LG } from '@/shared/home-card-image'
import { usePopularDeals } from './usePopularDeals'

/**
 * 🏆 PC 홈 · 인기 이용권 순위 (2026-10-14 대표 확정 "시안 4" — 시안 3 에서 가져온 줄).
 *
 * 인기순 상위 10장을 한 줄에 다섯 장씩, 좌우 화살표로 넘긴다. 사진 왼쪽 아래에 **큰 순위 숫자**.
 * 카드는 홈 피드와 같은 `GroupBuyFeedCard` 다 — 카드가 두 벌이 되면 한쪽만 고쳐져 갈린다(2026-08-19).
 *
 * 🏷️ 제목은 "인기 이용권" 이지 "가장 많이 팔린" 이 아니다 — 서버의 인기순은 판매량 컬럼이 비면
 *   참여 수로 대신 센다(`soldOf`). 확인할 수 없는 말을 제목에 걸지 않는다. "실시간" 도 같은 이유로 안 쓴다.
 *
 * 순위는 화면 밖(접힘 아래)이라 사진을 최우선으로 받지 않는다(`aboveFold` 끔) — 위 배너와 대역폭을 다투면 안 된다.
 */
const RANK_MAX = 10

export default function PcTopRank() {
  const { data = [] } = usePopularDeals()
  const scroller = useRef<HTMLDivElement | null>(null)
  // 교환권(`deal_only`)은 딜 결제라 이 줄(동네 이용권 순위)에 섞지 않는다 — 피드도 같은 기준이다.
  const top = data.filter((p) => p.deal_only !== 1).slice(0, RANK_MAX)
  if (top.length < 3) return null

  const page = (d: number) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: d * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <section aria-labelledby="pc-top-rank" className="ur-home-panel !mb-0 relative">
      <div className="flex items-end justify-between mb-3">
        <h2 id="pc-top-rank" className="text-[24px] font-bold tracking-[-.02em] text-gray-900 dark:text-white">
          지금 인기 이용권 <span className="ml-1 text-[15px] font-semibold text-gray-500 dark:text-gray-400">TOP {top.length}</span>
        </h2>
        <Link to="/?sort=popular" className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          인기순 전체 보기 ›
        </Link>
      </div>
      <div className="relative">
        <div ref={scroller} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain scrollbar-hide">
          {top.map((p, k) => (
            <div key={p.id} className="snap-start shrink-0 w-[calc((100%-64px)/5)]">
              <GroupBuyFeedCard
                p={p}
                imgWidth={HOME_CARD_IMG_WIDTH_LG}
                overlayExtra={
                  <span aria-label={`${k + 1}위`} className="absolute left-3 bottom-1 z-[2] text-[48px] font-black italic leading-none text-white dark:text-white [text-shadow:0_2px_10px_rgba(0,0,0,.45)] pointer-events-none">
                    {k + 1}
                  </span>
                }
              />
            </div>
          ))}
        </div>
        {top.length > 5 && (
          <>
            <button type="button" onClick={() => page(-1)} aria-label="이전 순위"
              className="absolute -left-5 top-[36%] -translate-y-1/2 z-[3] w-10 h-10 rounded-full bg-surface text-gray-900 dark:text-white flex items-center justify-center shadow-lift">
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => page(1)} aria-label="다음 순위"
              className="absolute -right-5 top-[36%] -translate-y-1/2 z-[3] w-10 h-10 rounded-full bg-surface text-gray-900 dark:text-white flex items-center justify-center shadow-lift">
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  )
}
