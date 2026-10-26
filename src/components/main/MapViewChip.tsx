import { Link } from 'react-router-dom'

/**
 * 🗺️ PC 상단 카테고리 줄 오른쪽 '내 주변 지도' 칩 (2026-10-14 대표 확정 — 시안 ① **다안**).
 *
 * 옅은 브랜드 블루 칩 + 작은 지도 그림. '지도' 라는 것을 글자보다 그림이 먼저 말한다.
 * 블루 **면**이 아니라 옅은 틴트다 — 위 검색 버튼이 이미 블루 면이라 주 행동이 둘로 보이지 않게.
 *
 * 목적지는 **지금 보고 있는 카테고리 그대로**의 지도다(`/map?category=`). 지도 페이지가 그 쿼리를
 * 이미 읽는다(RestaurantMapPage `voucherType` 초기값). '전체' 면 쿼리 없이 `/map`.
 */
export function mapPathFor(dealCat: string | null | undefined): string {
  return dealCat && dealCat !== 'all' ? `/map?category=${encodeURIComponent(dealCat)}` : '/map'
}

export default function MapViewChip({ dealCat }: { dealCat?: string | null }) {
  return (
    <Link
      to={mapPathFor(dealCat)}
      className="shrink-0 flex items-center gap-2 h-8 pl-1 pr-3 rounded-full bg-brand-tint text-[13px] font-medium text-gray-900 dark:text-white hover:brightness-[0.97] transition"
    >
      <MiniMap />
      내 주변 지도
    </Link>
  )
}

/** 24×24 지도 조각 — 길 두 줄 + 핀. 색은 브랜드 토큰에서만 받는다(새 hex 를 만들지 않는다). */
function MiniMap() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 rounded-full">
      <rect width="24" height="24" rx="7" style={{ fill: 'var(--brand)', fillOpacity: 0.22 }} />
      <path d="M-2 17 L26 5" stroke="white" strokeOpacity="0.9" strokeWidth="3" />
      <path d="M7 -2 L13 26" stroke="white" strokeOpacity="0.9" strokeWidth="2" />
      <path d="M16 15.5c0 0-3.2-3-3.2-5.4a3.2 3.2 0 1 1 6.4 0c0 2.4-3.2 5.4-3.2 5.4z" style={{ fill: 'var(--brand)' }} />
      <circle cx="16" cy="10.1" r="1.2" fill="white" />
    </svg>
  )
}
