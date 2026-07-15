import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Utensils, Scissors, BedDouble, Shapes, Gift, Map, Sparkles, Store, ChevronRight } from 'lucide-react'

/**
 * 🖥️ 2026-07-15 (대표 — PC 홈 당근 스타일): 좌측 카테고리/바로가기 레일.
 *   - 동네딜 카테고리(전체/식사/미용/숙소/기타) → 우측 GroupBuyFeed 필터 구동(controlled).
 *     숙소(stay_voucher)는 상품 price=0 + 객실 별도 테이블이라 그리드 카드가 깨짐 →
 *     CategoryTabs 와 동일하게 전용 /stays 로 이동(그리드 필터 대신).
 *   - 바로가기: 교환권(/vouchers) · 지도로 동네딜(/map) · 링크샵(/u/me) · 판매자센터(/seller).
 *   순수 프레젠테이션 — 카테고리는 props 로 controlled. 라이트 기본 + dark: 대응(홈 테마 정합).
 */

export type DealCategory = 'all' | 'meal_voucher' | 'beauty_voucher' | 'stay_voucher' | 'etc_voucher'

const DEAL_CATS: { key: DealCategory; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'all',            label: '전체', icon: LayoutGrid },
  { key: 'meal_voucher',   label: '식사', icon: Utensils },
  { key: 'beauty_voucher', label: '미용', icon: Scissors },
  { key: 'stay_voucher',   label: '숙소', icon: BedDouble },
  { key: 'etc_voucher',    label: '기타', icon: Shapes },
]

const railBtn =
  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-colors text-left'
const railIdle =
  'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white'
const railActive =
  'bg-gray-900 text-white dark:bg-white dark:text-gray-900'

export default function PcHomeRail({
  category,
  onCategory,
}: {
  category: DealCategory
  onCategory: (c: DealCategory) => void
}) {
  const navigate = useNavigate()

  return (
    <aside className="w-[220px] shrink-0 sticky top-[72px] self-start hidden lg:flex flex-col gap-5">
      {/* 지역 — 내 주변 진입(지도 near-me). 당근식 '동네' 표현/인증 없음(대표 지시). */}
      <button
        onClick={() => navigate('/map')}
        className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-4 py-3.5 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">지역</p>
        <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-gray-900 dark:text-white">
          <Map className="w-4 h-4 text-gray-900 dark:text-white" strokeWidth={2.2} />
          내 주변 딜 찾기
        </p>
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">지도에서 가까운 딜 보기 →</p>
      </button>

      {/* 동네딜 카테고리 — 우측 그리드 필터 */}
      <nav>
        <p className="px-3 mb-2 text-[11px] font-extrabold uppercase tracking-wide text-gray-400 dark:text-gray-500">카테고리</p>
        <div className="flex flex-col gap-0.5">
          {DEAL_CATS.map(({ key, label, icon: Icon }) => {
            const active = category === key
            return (
              <button
                key={key}
                onClick={() => { if (key === 'stay_voucher') navigate('/stays'); else onCategory(key) }}
                aria-current={active ? 'true' : undefined}
                className={`${railBtn} ${active ? railActive : railIdle}`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* 바로가기 */}
      <nav>
        <div className="h-px bg-gray-100 dark:bg-white/[0.08] mb-3 mx-2" />
        <div className="flex flex-col gap-0.5">
          {[
            { label: '교환권 · 기프티콘', icon: Gift, to: '/vouchers' },
            { label: '지도로 동네딜 보기', icon: Map, to: '/map' },
            { label: '내 링크샵', icon: Sparkles, to: '/u/me' },
            { label: '판매자센터', icon: Store, to: '/seller' },
          ].map(({ label, icon: Icon, to }) => (
            <button key={to} onClick={() => navigate(to)} className={`${railBtn} ${railIdle}`}>
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
            </button>
          ))}
        </div>
      </nav>
    </aside>
  )
}
