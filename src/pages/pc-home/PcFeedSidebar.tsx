import { Link } from 'react-router-dom'
import { DEAL_CATS, type DealCategory } from './PcHomeRail'
import PcHomeLocationBar, { type HomeRegion } from './PcHomeLocationBar'
import { DISTANCE_CHOICES, PRICE_BANDS, type FeedFilters } from '@/shared/home-feed-filters'

/**
 * 🎚️ PC 홈 탐색 왼쪽 필터 (2026-10-14 대표 확정 "시안 4" — 시안 2 의 왼쪽 열).
 *
 * 위치 선택(지역 고르기 | 현 위치)은 종전 히어로 안에 있던 **같은 부품**(`PcHomeLocationBar`)을 옮겨 왔다 —
 * 히어로가 배너로 바뀌면서 그 칩이 갈 곳이 여기다. 두 벌로 두면 어느 쪽이 진짜인지 갈린다.
 *
 * 숫자(종류별 개수)는 **안 붙인다** — 서버가 종류별 총수를 주지 않는다. 시안의 338·214 는 자리표시였다.
 * 거리는 위치가 잡혔을 때만 보인다(내 위치를 모르면 "1km 안" 은 판정할 수 없다).
 * 선택 = 브랜드 블루 면(서비스 공통 — 2026-09-07 "선택됨은 한 색").
 */
const chip = (on: boolean) =>
  `px-3 h-8 rounded-full text-[13px] font-medium transition-colors ${
    on ? 'bg-brand text-white' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
  }`

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 first:pt-0">
      <p className="mb-2 text-[12px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      {children}
    </div>
  )
}

export default function PcFeedSidebar({
  region, onRegionChange, onLocate, located, locatedLabel,
  category, onCategoryChange, filters, onFiltersChange,
}: {
  region: HomeRegion
  onRegionChange: (r: HomeRegion) => void
  onLocate: (loc: { lat: number; lng: number }) => void
  located: boolean
  locatedLabel?: string
  category: DealCategory
  onCategoryChange: (c: DealCategory) => void
  filters: FeedFilters
  onFiltersChange: (f: FeedFilters) => void
}) {
  return (
    // 🧱 2026-10-14 대표 신고("이렇게 잘려서 보이네") — `sticky` 는 자기 쌓임 맥락을 연다. 그래서 안쪽 지역
    //    드롭다운(z-[10500])이 이 열 **안에서만** 겨루고, 뒤에 그려지는 오른쪽 목록 카드가 그 위를 덮었다.
    //    열 자체를 목록보다 위 층(z-20)에 둔다 — 상단 네비(z-9999)보다는 아래라 스크롤 때 네비를 안 덮는다.
    <aside aria-label="이용권 필터" className="sticky top-24 z-20 self-start w-[248px] shrink-0 rounded-2xl bg-gray-50 dark:bg-white/[0.04] p-4">
      <Group label="지역">
        <PcHomeLocationBar value={region} onChange={onRegionChange} onLocate={onLocate} located={located} locatedLabel={locatedLabel} />
      </Group>
      <Group label="종류">
        <ul className="flex flex-col gap-1">
          {DEAL_CATS.map(({ key, label }) => {
            const on = key === category
            return (
              <li key={key}>
                <button type="button" onClick={() => onCategoryChange(key)} aria-pressed={on}
                  className={`w-full text-left px-3 h-9 rounded-lg text-[15px] transition-colors ${
                    on ? 'bg-brand-tint text-brand-text font-bold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                  }`}>
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </Group>
      {located && (
        <Group label="거리">
          {/* 🧱 2026-10-17 (대표 신고): `flex-wrap` 이라 '전국' 하나만 다음 줄로 떨어졌다 → 네 칸 고정 격자. */}
          <div className="grid grid-cols-4 gap-1">
            {DISTANCE_CHOICES.map(({ km, label }) => {
              const on = (filters.maxKm ?? null) === km
              return <button key={label} type="button" aria-pressed={on} onClick={() => onFiltersChange({ ...filters, maxKm: km })} className={`${chip(on)} !px-0 w-full whitespace-nowrap`}>{label}</button>
            })}
          </div>
        </Group>
      )}
      <Group label="가격">
        <div className="flex flex-wrap gap-1">
          {PRICE_BANDS.map(({ key, label }) => {
            const on = filters.price === key
            return <button key={key} type="button" aria-pressed={on} onClick={() => onFiltersChange({ ...filters, price: on ? null : key })} className={chip(on)}>{label}</button>
          })}
        </div>
      </Group>
      <Link to="/map" className="mt-5 flex items-center justify-center h-11 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/[0.1]">
        지도로 크게 보기 ›
      </Link>
    </aside>
  )
}
