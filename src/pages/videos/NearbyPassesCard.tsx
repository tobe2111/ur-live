import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { pickNearbyPasses, type FeedPass } from './nearby-picks'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-03 16차 ⑦ — 영상이 조금 돈 뒤(0.6초) 근처 이용권 카드가 아래에서 살짝 튕기며 올라온다.
//   바깥 상자는 넘김 위치(`style` — 영상 넘길 때 transform)를 그대로 받고, 움직임은 안쪽 상자에만 건다(둘이 같은 transform 을 다투지 않게).
injectMotionCss('ur-m-nearby', `@keyframes ur-np-in { from { opacity: 0; transform: translateY(140%); } 70% { opacity: 1; transform: translateY(-4%); } to { transform: none; } }.ur-np-in { animation: ur-np-in .55s cubic-bezier(.2,1,.3,1) .6s backwards; }@media (prefers-reduced-motion: reduce){.ur-np-in{animation:none!important}}`)
export { usePopularPassFeed as useNearbyFeed } from '@/hooks/usePopularPassFeed'

/**
 * 🎬 이용권 없는 쇼츠의 흰 카드 (2026-10-14 대표 확정, 시안 ② 나안).
 *
 * 구매 바와 **같은 자리 · 같은 흰 카드**다(`inset-x-[10px] bottom-[10px] rounded-2xl bg-white/95`).
 * 자리가 같아야 영상마다 카드가 생겼다 사라졌다 하지 않는다.
 * 고를 이용권이 없으면 `null` — 빈 흰 카드는 "안내" 가 아니라 결함으로 보인다.
 */

export default function NearbyPassesCard({ feed, regionSi, style }: { feed: FeedPass[]; regionSi?: string | null; style?: CSSProperties }) {
  // 🩸 2026-11-03 대표 신고 *"아래 부분도 수정 필요"* — 반투명(`bg-white/95`)이라 아래 유튜브 Shorts 글자·검은 띠가
  //   비쳐 카드가 반쯤 찢어진 것처럼 보였다 ⇒ **불투명 흰 판** + 여백 12 · 사진 44 · [더 보기]는 구매 바와 같은 둥근 사각.
  const picks = pickNearbyPasses(feed, regionSi)
  if (picks.items.length === 0) return null
  return (
    <div style={style} className="absolute inset-x-[10px] bottom-[10px] z-20">
    <div className="ur-np-in flex items-center gap-3 rounded-2xl bg-white p-3 shadow-2xl" data-testid="shorts-nearby-card">
      <div className="min-w-0 flex-1 text-gray-900">
        <div className="truncate text-[13px] font-medium">{picks.label}</div>
        <div className="mt-2 flex gap-2">
          {picks.items.map((it) => (
            <Link key={it.id} to={it.to} aria-label={it.name || '이용권 보기'} className="shrink-0">
              <img
                src={cfImage(it.image, { width: 120 })} alt=""
                width={44} height={44}
                className="h-11 w-11 rounded-lg object-cover"
                onError={(e) => cfImageOnError(e.currentTarget, it.image)}
              />
            </Link>
          ))}
        </div>
      </div>
      <Link
        to={picks.more}
        className="shrink-0 h-11 px-4 rounded-xl bg-brand text-[13px] font-medium text-white inline-flex items-center"
      >
        더 보기
      </Link>
    </div>
    </div>
  )
}
