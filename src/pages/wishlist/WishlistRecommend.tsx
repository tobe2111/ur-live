import { Link } from 'react-router-dom'
import GroupBuyFeedCard from '../main-home/GroupBuyFeedCard'
import { usePopularPassFeed, type PopularPass } from '@/hooks/usePopularPassFeed'
import { mapPathFor } from '@/components/main/MapViewChip'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import type { WishlistItem } from '@/hooks/queries/useWishlist'

/**
 * 💗 위시리스트 아래 "찜한 것과 비슷한 이용권" (2026-10-14 대표 확정 — 위시리스트 **가안 + 나안**).
 *
 * 찜이 몇 개뿐이면 오른쪽 절반이 통째로 비었다(대표 스크린샷). 그 자리를 같은 카테고리의
 * 인기 이용권이 채운다. 데이터는 홈 피드와 **같은 예열 주소** 한 번(`usePopularPassFeed`).
 *
 * 고르는 규칙(순수 함수 — 시험이 직접 돌린다):
 *   이미 찜한 것 · 교환권(딜 결제) · 사진 없는 것은 빼고, 찜한 카테고리를 먼저, 나머지는 인기순으로 채운다.
 */
export const RECOMMEND_COUNT = 4

export function pickSimilar(feed: PopularPass[], wished: Pick<WishlistItem, 'product_id' | 'category'>[], n = RECOMMEND_COUNT): PopularPass[] {
  const taken = new Set(wished.map((w) => Number(w.product_id)))
  const cats = new Set(wished.map((w) => w.category).filter(Boolean))
  const pool = feed.filter((p) => !taken.has(Number(p.id)) && Number(p.deal_only) !== 1 && !!p.image_url)
  const same = pool.filter((p) => cats.has(p.category ?? ''))
  const rest = pool.filter((p) => !cats.has(p.category ?? ''))
  return [...same, ...rest].slice(0, n)
}

/** 찜에서 가장 많은 카테고리 — 지도 링크가 그 카테고리로 열린다. */
export function topCategory(wished: Pick<WishlistItem, 'category'>[]): string | null {
  const m = new Map<string, number>()
  for (const w of wished) if (w.category) m.set(w.category, (m.get(w.category) ?? 0) + 1)
  let best: string | null = null, n = 0
  for (const [k, v] of m) if (v > n) { best = k; n = v }
  return best
}

export default function WishlistRecommend({ wished, imgWidth, userLoc }: {
  wished: WishlistItem[]
  imgWidth: number
  userLoc: { lat: number; lng: number } | null
}) {
  const feed = usePopularPassFeed(wished.length > 0)
  const picks = feed ? pickSimilar(feed, wished) : []
  if (picks.length === 0) return null
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">찜한 것과 비슷한 이용권</h2>
        <Link to={mapPathFor(topCategory(wished))} className="shrink-0 text-[13px] font-medium text-brand-text hover:underline">
          지도에서 보기
        </Link>
      </div>
      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${DEAL_GRID_GAP}`}>
        {picks.map((p) => (
          <GroupBuyFeedCard key={p.id} imgWidth={imgWidth} userLoc={userLoc} p={p as never} />
        ))}
      </div>
    </section>
  )
}
