/**
 * 🎬 2026-10-26 (대표 "이용권 상세 갤러리에 매장 숏폼 영상"): 한 이용권에 연결된 유어쇼츠 영상.
 *
 * 영상은 어드민·사장님이 `home_shorts.product_id` 로 이미 이용권에 붙여 둔다(유어쇼츠 레일·뷰어와 같은 데이터).
 * 상세 화면은 새 목록을 만들지 않고 **같은 공개 목록**(`/api/urshorts?all=1` — 엣지 캐시)에서 걸러 쓴다.
 * 두 벌이면 뷰어에서 안 나오는 영상을 상세가 가리키는 날이 온다.
 */
import type { UrShortItem } from './urshorts'

export function storeShortsFor(list: readonly UrShortItem[] | null | undefined, productId: number | null | undefined): UrShortItem[] {
  const id = Number(productId)
  if (!Number.isFinite(id) || id <= 0 || !Array.isArray(list)) return []
  return list.filter((x) => Number(x?.product_id) === id && typeof x?.video_id === 'string' && x.video_id.length > 0)
}

/** 뷰어 주소 — 그 영상부터 튼다(`VideosPage` 가 `?v=` 를 읽는다). */
export function storeShortsHref(item: Pick<UrShortItem, 'video_id'>): string {
  return `/videos?v=${encodeURIComponent(item.video_id)}`
}
