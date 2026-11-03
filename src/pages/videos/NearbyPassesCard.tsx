import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { pickNearbyPasses, type FeedPass } from './nearby-picks'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 영상이 조금 돈 뒤(0.6초) 카드 줄이 아래에서 부드럽게 올라온다. 바깥 상자는 넘김 위치(`style`)만, 움직임은 안쪽만.
injectMotionCss('ur-m-nearby', `@keyframes ur-np-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }.ur-np-in { animation: ur-np-in .5s cubic-bezier(.2,.9,.3,1) .6s backwards; }@media (prefers-reduced-motion: reduce){.ur-np-in{animation:none!important}}`)
export { usePopularPassFeed as useNearbyFeed } from '@/hooks/usePopularPassFeed'

/**
 * 🎬 이용권 없는 쇼츠의 아래 — **안 C · 근처 이용권 가로로 넘기기** (2026-11-03 대표 *"안 C로 하는게 좋겠네"*, 캔버스 VC).
 *
 * 종전(2026-10-14 나안): 흰 카드 하나에 [지역 인기 이용권 · 작은 사진 세 장 · 더 보기]. 대표 *"아래에 나오는 내용이 너무 별로야"*.
 * 이제: 영상 위에 글자 한 줄(📍 지역 근처 이용권 · 전체 ›) + 그 아래 **작은 흰 카드들이 가로로** 흐른다(사진 · 가게 · 할인가).
 *   흰 판 하나가 화면 아래를 덮지 않아 영상이 더 보이고, 카드 하나하나를 바로 누를 수 있다.
 * 🖐️ 가로로 미는 손짓은 이 줄 안에서만 — 줄이 제스처 층(z-10)보다 위(z-20)라 위아래 넘김과 안 싸운다.
 * 고를 이용권이 없으면 `null` — 빈 줄은 결함으로 보인다.
 * deal-card-ok: 영상 위에 뜨는 156px 작은 바로가기 줄이지 딜 목록 카드가 아니다(사진·이름·가격 한 줄). 목적지는 `pickNearbyPasses` 가 피드 SSOT 의 `to` 를 그대로 넘긴다.
 */
export default function NearbyPassesCard({ feed, regionSi, style }: { feed: FeedPass[]; regionSi?: string | null; style?: CSSProperties }) {
  const picks = pickNearbyPasses(feed, regionSi)
  if (picks.items.length === 0) return null
  return (
    <div style={style} className="absolute inset-x-0 bottom-3 z-20" data-testid="shorts-nearby-rail">
      <div className="ur-np-in">
        <div className="flex items-center justify-between px-4 pb-2 text-white">
          <span className="truncate text-[13px] font-medium [text-shadow:0_1px_4px_rgba(0,0,0,.5)]">📍 {picks.label}</span>
          <Link to={picks.more} className="shrink-0 inline-flex items-center gap-1 text-[13px] text-white/85 active:opacity-70">
            전체 <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 snap-x snap-mandatory overscroll-x-contain">
          {picks.items.map((it) => {
            const pct = it.price && it.originalPrice && it.originalPrice > it.price ? Math.round((1 - it.price / it.originalPrice) * 100) : 0
            return (
              <Link key={it.id} to={it.to} className="snap-start shrink-0 w-[156px] flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lift active:opacity-80">
                <img src={cfImage(it.image, { width: 120 })} alt="" width={44} height={44}
                  className="h-11 w-11 shrink-0 rounded-xl object-cover" onError={(e) => cfImageOnError(e.currentTarget, it.image)} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-gray-900">{it.name || '이용권'}</span>
                  {it.price != null && (
                    <span className="block text-[13px] tabular-nums text-gray-900">
                      {pct > 0 && <b className="mr-1 font-bold text-sale">{pct}%</b>}{formatNumber(it.price)}원
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
