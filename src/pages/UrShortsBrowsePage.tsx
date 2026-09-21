import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { URSHORTS_BROWSE_PATH, type UrShortItem } from '@/shared/urshorts'
import BrowseCard from './urshorts/BrowseCard'
import {
  cityFacets, categoryFacets, filterShorts, pruneFilter,
  MIN_FACETS_TO_SHOW, type Facet, type ShortsFilter,
} from './urshorts/facets'

/**
 * 🎬 `/urshorts` — 유어쇼츠 전체 보기 (2026-09-21 대표 확정 **시안 A + 카테고리**).
 *
 * ## 왜 생겼나
 * 대표: *"유어쇼츠 전체보기 하면 도시별로 선택하는 … 페이지가 안나오는데?"* → 전 히스토리를
 * 뒤졌더니 **그런 화면은 만들어진 적이 없었다**(레일의 「전체 보기」가 세로 뷰어로 바로 갔다).
 * 그래서 시안 3종을 그려 대표가 A(칩 + 2열 그리드)를 골랐고, *"카테고리도 붙히면 좋겠다"* 를 얹었다.
 * 설계·실측: `docs/design/urshorts-browse-2026-09.md`.
 *
 * ## 🔴 뷰어와 다른 화면이다
 * `/videos` 는 한 편씩 넘기는 **몰입** 화면(다크 고정·네비 없음)이고, 여기는 **목록**이다.
 * 그래서 테마를 따르고 하단 네비를 남긴다 — 고르다 말고 나갈 수 있어야 한다.
 *
 * ## 🔴 칩은 데이터가 만든다
 * 도시·카테고리 칩은 **지금 올라온 영상에서 세어서** 만든다(`facets.ts`). 값이 한 종류뿐이면
 * 그 줄을 아예 안 그린다 — `[전체 10] [식사 10]` 은 같은 목록을 보여 주는 버튼 둘이라 소음이다.
 * 오늘은 10편이 전부 식사라 **카테고리 줄이 안 보이는 것이 정상**이고, 미용·숙소가 한 편이라도
 * 들어오면 그날 바로 뜬다.
 *
 * ## 🔴 한 번만 받는다
 * `?all=1` 로 전부 받아 **거르기는 화면에서** 한다. 칩을 누를 때마다 서버를 부르면 D1 읽기가
 * 칩 클릭 수만큼 늘어나는데(2026-09-01 에 일일 한도를 넘겨 소비자 API 가 멈춘 적이 있다),
 * 지금 전량이 열 편이고 서버 상한도 100편이라 받아서 거르는 편이 싸다.
 * ⚠️ 영상이 100편을 넘기면 이 전제가 깨진다 — 그때는 서버 필터·페이지네이션으로 옮길 것.
 */
export default function UrShortsBrowsePage() {
  const [items, setItems] = useState<UrShortItem[] | null>(null)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    fetch('/api/urshorts?all=1')
      .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
      .then((r) => { if (alive) setItems(r?.success && Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [])

  const all = items ?? []
  const cities = useMemo(() => cityFacets(all), [all])
  const cats = useMemo(() => categoryFacets(all), [all])

  // 🔗 고른 값은 주소에 싣는다 — 공유·뒤로가기가 그냥 된다.
  //    ⚠️ 목록에 없는 값(내려간 도시의 옛 링크)은 조용히 '전체' 로 — 빈 화면을 주지 않는다.
  const filter: ShortsFilter = pruneFilter(
    { si: params.get('si'), category: params.get('cat') }, cities, cats,
  )
  const shown = useMemo(() => filterShorts(all, filter), [all, filter.si, filter.category])

  const setFilter = (next: Partial<ShortsFilter>) => {
    const f = { ...filter, ...next }
    const p = new URLSearchParams()
    if (f.si) p.set('si', f.si)
    if (f.category) p.set('cat', f.category)
    setParams(p, { replace: true })
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)]">
      <SEO
        title="유어쇼츠 - 유어딜"
        description="영상으로 먼저 보고 바로 사는 동네 이용권. 도시·종류로 골라 보세요."
        url={URSHORTS_BROWSE_PATH}
      />

      {/* 상단 — 뒤로 + 제목 + 지금 보이는 편수 */}
      <header className="sticky top-0 z-10 flex items-center gap-1 bg-[var(--bg)]/95 px-2 py-2.5 backdrop-blur">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-full text-gray-700 dark:text-gray-200"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white">
          유어쇼츠
          <span aria-hidden="true" className="-ml-[3px] text-brand-text">.</span>
        </h1>
        {items && (
          <span className="ml-1.5 text-[12.5px] font-medium text-gray-500 dark:text-gray-400">
            {shown.length}편
          </span>
        )}
      </header>

      {items === null ? (
        <BrandLoader fullScreen />
      ) : (
        <div className="px-3 pb-10">
          <ChipRow
            label="도시"
            facets={cities}
            total={all.length}
            value={filter.si}
            onPick={(si) => setFilter({ si })}
          />
          <ChipRow
            label="종류"
            facets={cats}
            total={all.length}
            value={filter.category}
            onPick={(category) => setFilter({ category })}
          />

          {shown.length === 0 ? (
            <p className="py-20 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
              {all.length === 0 ? '아직 올라온 영상이 없어요' : '고른 조건에 맞는 영상이 없어요'}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-2.5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((it, i) => (
                <li key={it.id}>
                  {/* 첫 줄만 즉시 로드 — 아래는 스크롤할 때. 2열이면 두 장이 첫 화면이다. */}
                  <BrowseCard item={it} eager={i < 2} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 칩 한 줄. **고를 것이 둘 이상일 때만** 그린다(`MIN_FACETS_TO_SHOW`).
 *
 * 모양은 교환권·지도와 같은 그림이다 — 흰 알약 + 선택은 브랜드 블루 면. 새로 배울 게 없다.
 */
function ChipRow({
  label, facets, total, value, onPick,
}: {
  label: string
  facets: readonly Facet[]
  total: number
  value: string | null
  onPick: (v: string | null) => void
}) {
  if (facets.length < MIN_FACETS_TO_SHOW) return null
  const on = 'bg-brand text-white'
  const off = 'bg-surface text-gray-800 dark:text-gray-100 shadow-lift'
  return (
    <div className="-mx-3 mb-2.5 flex gap-1.5 overflow-x-auto px-3 py-1 scrollbar-hide" aria-label={label}>
      <Chip active={!value} className={!value ? on : off} onClick={() => onPick(null)}>
        전체 <Count n={total} active={!value} />
      </Chip>
      {facets.map((f) => (
        <Chip
          key={f.key}
          active={value === f.key}
          className={value === f.key ? on : off}
          onClick={() => onPick(value === f.key ? null : f.key)}
        >
          {f.label} <Count n={f.count} active={value === f.key} />
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  active, className, onClick, children,
}: { active: boolean; className: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1 h-9 px-3.5 rounded-full text-[13px] font-bold transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

/** 개수는 항상 칩 안에 — "부산에 몇 편 있나" 가 누르기 전에 보여야 고를 수 있다. */
function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={`tabular-nums text-[11.5px] font-semibold ${active ? 'text-white/75' : 'text-gray-400 dark:text-gray-500'}`}>
      {n}
    </span>
  )
}
