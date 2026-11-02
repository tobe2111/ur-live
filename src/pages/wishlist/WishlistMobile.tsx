/**
 * 📱 찜 목록 모바일 — 요약 카드 + 한 줄 목록 (2026-10-14 대표 확정, 모바일 시안 ① **나안**).
 *
 * PC 는 왼쪽 레일이 "다 사면 아끼는 돈" 을 말한다. 폰엔 레일 자리가 없어 그 숫자가 제목 밑
 * 작은 글씨로 묻혔다. ⇒ 맨 위 흰 카드로 올려 숫자를 주인공으로 두고, 목록은 사진 작은 한 줄씩
 * (`DealRow` — 줄 카드는 새로 그리지 않는다)으로 한 화면에 더 많이 보이게 한다.
 *
 * 숫자 규칙은 PC 레일과 **같은 함수**(`summarize`)를 쓴다. 0 은 띄우지 않는다.
 */
import DealRow from '@/components/deal/DealRow'
import WishlistHeart from '@/components/deal/WishlistHeart'
import { canonicalDetailPath } from '@/shared/product-flow'
import { formatNumber } from '@/utils/format'
import type { WishlistItem } from '@/hooks/queries/useWishlist'
import { priceDrop, type WishlistSummary } from './wishlist-signals'
import { WishlistFlag } from './WishlistParts'

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
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => {
        const addr = (it.restaurant_address || '').trim().split(/\s+/).slice(0, 3).join(' ')
        const dist = wishDistance(it, userLoc)
        const where = [addr, dist].filter(Boolean).join(' ')
        const drop = priceDrop(it)
        return (
          <DealRow
            key={it.id}
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
        )
      })}
    </div>
  )
}
