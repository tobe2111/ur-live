import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { pickNearbyPasses, type FeedPass } from './nearby-picks'
export { usePopularPassFeed as useNearbyFeed } from '@/hooks/usePopularPassFeed'

/**
 * 🎬 이용권 없는 쇼츠의 흰 카드 (2026-10-14 대표 확정, 시안 ② 나안).
 *
 * 구매 바와 **같은 자리 · 같은 흰 카드**다(`inset-x-[10px] bottom-[10px] rounded-2xl bg-white/95`).
 * 자리가 같아야 영상마다 카드가 생겼다 사라졌다 하지 않는다.
 * 고를 이용권이 없으면 `null` — 빈 흰 카드는 "안내" 가 아니라 결함으로 보인다.
 */

export default function NearbyPassesCard({ feed, regionSi, style }: { feed: FeedPass[]; regionSi?: string | null; style?: CSSProperties }) {
  const picks = pickNearbyPasses(feed, regionSi)
  if (picks.items.length === 0) return null
  return (
    <div style={style} className="absolute inset-x-[10px] bottom-[10px] z-20 flex items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-2xl">
      <div className="min-w-0 flex-1 text-gray-900">
        <div className="truncate text-[12px] font-medium">{picks.label}</div>
        <div className="mt-1 flex gap-2">
          {picks.items.map((it) => (
            <Link key={it.id} to={it.to} aria-label={it.name || '이용권 보기'} className="shrink-0">
              <img
                src={cfImage(it.image, { width: 120 })} alt=""
                width={40} height={40}
                className="h-10 w-10 rounded-md object-cover"
                onError={(e) => cfImageOnError(e.currentTarget, it.image)}
              />
            </Link>
          ))}
        </div>
      </div>
      <Link
        to={picks.more}
        className="shrink-0 rounded-full bg-brand px-[13px] py-[11px] text-[13px] font-medium text-white"
      >
        더 보기
      </Link>
    </div>
  )
}
