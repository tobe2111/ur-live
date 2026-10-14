/**
 * 🎬 이용권이 안 붙은 쇼츠의 구매 바 자리 — "이 지역 인기 이용권" (2026-10-14 대표 확정, 시안 ② **나안**).
 *
 * 대표 *"없을 때에도 저 있을 때의 흰색 프레임은 두고 어떠한 안내라던지"*. 종전엔 이용권이 없으면
 * 바 전체를 안 그려 영상만 남았다. 이제 같은 흰 카드에 **영상 속 지역의 인기 이용권 세 장**을 넣는다.
 *
 * 🔴 숫자를 지어내지 않는다:
 *   - 지역 이용권이 하나도 없으면 라벨을 '지금 인기 이용권' 으로 바꾼다 — 다른 지역 상품을
 *     "이 지역" 이라고 부르지 않는다.
 *   - 교환권(`deal_only=1`)은 넣지 않는다 — 매장이 없어 "이 지역" 이 성립하지 않는다.
 *   - 사진이 없는 상품은 뺀다 — 이 카드는 사진 세 장이 전부라 빈 칸은 결함으로 보인다.
 */
import { addressInRegion, normalizeSido, regionPath } from '@/shared/constants/region-slugs'
import { canonicalDetailPath } from '@/shared/product-flow'

export interface FeedPass {
  id: number
  name?: string | null
  image_url?: string | null
  category?: string | null
  deal_only?: number | null
  restaurant_address?: string | null
  restaurant_name?: string | null
}

export interface NearbyPick { id: number; image: string; name: string; to: string }

export interface NearbyPicks {
  label: string
  /** '더 보기' 목적지 — 지역을 알면 그 지역 페이지, 아니면 지도. */
  more: string
  items: NearbyPick[]
}

export const NEARBY_PICK_COUNT = 3

/** 쇼츠의 도시 키(`'충남세종'` 같은 묶음 키 포함) → 행정 시/도. 모르면 null. */
export function sidoFromShortsRegion(si: string | null | undefined): string | null {
  const t = (si || '').trim()
  if (!t) return null
  return normalizeSido(t) ?? normalizeSido(t.slice(0, 2))
}

export function pickNearbyPasses(feed: FeedPass[], regionSi: string | null | undefined): NearbyPicks {
  const sido = sidoFromShortsRegion(regionSi)
  const usable = feed.filter((p) => Number(p.deal_only) !== 1 && !!p.image_url)
  const toPick = (p: FeedPass): NearbyPick => ({
    id: p.id,
    image: String(p.image_url),
    name: p.restaurant_name || p.name || '',
    to: canonicalDetailPath(p) ?? `/pass/${p.id}`,
  })
  if (sido) {
    const local = usable.filter((p) => addressInRegion(p.restaurant_address, { sido }))
    if (local.length > 0) {
      return {
        label: `${sido} 인기 이용권`,
        more: regionPath({ sido }),
        items: local.slice(0, NEARBY_PICK_COUNT).map(toPick),
      }
    }
  }
  return { label: '지금 인기 이용권', more: '/map', items: usable.slice(0, NEARBY_PICK_COUNT).map(toPick) }
}
