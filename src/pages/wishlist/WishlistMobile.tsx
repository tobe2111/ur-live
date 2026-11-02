/**
 * 📱 찜 목록 모바일 — 요약 카드 + 한 줄 목록 (2026-10-14 대표 확정, 모바일 시안 ① **나안**).
 *
 * PC 는 왼쪽 레일이 "다 사면 아끼는 돈" 을 말한다. 폰엔 레일 자리가 없어 그 숫자가 제목 밑
 * 작은 글씨로 묻혔다. ⇒ 맨 위 흰 카드로 올려 숫자를 주인공으로 두고, 목록은 사진 작은 한 줄씩
 * (`DealRow` — 줄 카드는 새로 그리지 않는다)으로 한 화면에 더 많이 보이게 한다.
 *
 * 숫자 규칙은 PC 레일과 **같은 함수**(`summarize`)를 쓴다. 0 은 띄우지 않는다.
 */
import { useEffect, useRef, useState } from 'react'
import DealRow from '@/components/deal/DealRow'
import WishlistHeart from '@/components/deal/WishlistHeart'
import { canonicalDetailPath } from '@/shared/product-flow'
import { formatNumber } from '@/utils/format'
import type { WishlistItem } from '@/hooks/queries/useWishlist'
import { priceDrop, type WishlistSummary } from './wishlist-signals'
import { WishlistFlag } from './WishlistParts'

// 🎬 2026-11-02 시안 6차 "찜 목록에서 지우기"(대표 "다 넣어줘") — 하트를 풀어 목록에서 빠지는 줄은 바로 사라지지 않고
//   옆으로 밀려 나가며 접힌다. 그래서 아래 줄이 툭 끊기지 않고 부드럽게 올라온다. 빠진 줄은 300ms 동안만 그 자리에 남는다.
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-wish', `@keyframes ur-wish-out { 0% { opacity: 1; transform: none; max-height: 160px; } 45% { opacity: 0; transform: translateX(24px); max-height: 160px; } 100% { opacity: 0; transform: translateX(24px); max-height: 0; margin-top: -8px; } }.ur-wish-out { overflow: hidden; pointer-events: none; animation: ur-wish-out .32s cubic-bezier(.65,0,.35,1) both; }@media (prefers-reduced-motion: reduce){.ur-wish-out{animation:none!important;display:none}}`)
const LEAVE_MS = 320

/** 사라진 줄을 잠깐 원래 자리에 붙잡아 둔다 — 지워지는 움직임을 보여 줄 시간만. */
function useLeavingRows<T extends { id: number | string }>(items: T[]): { row: T; leaving: boolean }[] {
  const prev = useRef(items)
  const [ghosts, setGhosts] = useState<{ row: T; at: number }[]>([])
  useEffect(() => {
    const now = new Set(items.map((i) => i.id))
    const gone = prev.current.map((row, at) => ({ row, at })).filter((g) => !now.has(g.row.id))
    prev.current = items
    if (!gone.length) return
    setGhosts((g) => [...g, ...gone])
    window.setTimeout(() => setGhosts((g) => g.filter((x) => !gone.some((y) => y.row.id === x.row.id))), LEAVE_MS)
  }, [items])
  const out: { row: T; leaving: boolean }[] = items.map((row) => ({ row, leaving: false }))
  for (const g of [...ghosts].sort((a, b) => a.at - b.at)) {
    if (items.some((i) => i.id === g.row.id)) continue
    out.splice(Math.min(g.at, out.length), 0, { row: g.row, leaving: true })
  }
  return out
}

/** 맨 위 요약 카드 — 인하가 있으면 인하 개수, 없으면 찜 개수가 큰 숫자다(레일과 같은 규칙). */
export function WishlistSummaryCard({ s }: { s: WishlistSummary }) {
  const headline = s.drops > 0 ? { n: s.drops, cap: '찜한 뒤 가격이 내렸어요' } : { n: s.total, cap: '찜한 이용권' }
  return (
    <div className="lg:hidden flex items-center gap-4 rounded-2xl px-4 py-4 mb-4">
      <div className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
        {headline.n}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-gray-500 dark:text-gray-400">{headline.cap}</p>
        {s.savings > 0 && (
          <p className="mt-1 text-[15px] font-bold text-sale">다 사면 {formatNumber(s.savings)}원 아껴요</p>
        )}
      </div>
    </div>
  )
}

/** 내 위치에서의 거리(km 문자열) — 홈 카드와 같은 표기(1km 미만 소수 한 자리, 10km 이상은 안 말함). */
export function wishDistance(it: Pick<WishlistItem, 'restaurant_lat' | 'restaurant_lng'>, loc: { lat: number; lng: number } | null): string | null {
  if (!loc || it.restaurant_lat == null || it.restaurant_lng == null) return null
  const la = Number(it.restaurant_lat), ln = Number(it.restaurant_lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  const r = (d: number) => (d * Math.PI) / 180
  const s = Math.sin(r(la - loc.lat) / 2) ** 2 + Math.cos(r(loc.lat)) * Math.cos(r(la)) * Math.sin(r(ln - loc.lng) / 2) ** 2
  const km = 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
  if (km >= 10) return null
  return km < 1 ? `${Math.round(km * 10) / 10}km` : `${Math.round(km)}km`
}

export function WishlistRows({ items, userLoc }: { items: WishlistItem[]; userLoc: { lat: number; lng: number } | null }) {
  const rows = useLeavingRows(items)
  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ row: it, leaving }) => {
        const addr = (it.restaurant_address || '').trim().split(/\s+/).slice(0, 3).join(' ')
        const dist = wishDistance(it, userLoc)
        const where = [addr, dist].filter(Boolean).join(' ')
        const drop = priceDrop(it)
        return (
          <div key={it.id} className={leaving ? 'ur-wish-out' : undefined} aria-hidden={leaving || undefined}>
          <DealRow
            to={canonicalDetailPath({ id: it.product_id, category: it.category, deal_only: it.deal_only } as never) ?? `/pass/${it.product_id}`}
            imageUrl={it.image_url}
            eyebrow={it.restaurant_name || it.seller_name || undefined}
            title={it.product_name}
            price={it.price}
            originalPrice={it.original_price}
            discountPct={Number(it.discount_rate) || 0}
            unit={Number(it.deal_only) === 1 ? '딜' : '원'}
            meta={(drop != null || where) ? (
              <div className="flex flex-col gap-1">
                {drop != null && <WishlistFlag drop={drop} />}
                {where && <span className="truncate">{where}</span>}
              </div>
            ) : undefined}
            trailing={<WishlistHeart productId={it.product_id} className="shrink-0 self-start" />}
          />
          </div>
        )
      })}
    </div>
  )
}
