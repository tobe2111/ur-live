import { LayoutGrid, Utensils, Scissors, BedDouble, Shapes } from 'lucide-react'
import { DEAL_CAT_LABELS, type DealCategory } from '@/shared/deal-cats'

/**
 * 🖥️ 2026-07-19 (대표 요청 — "왼쪽 카테고리보단 위에"): 좌측 세로 레일 → **상단 가로 카테고리 바**로 전환.
 *   동네딜 카테고리(전체/식사/미용/숙소/기타) → 홈 GroupBuyFeed 필터 구동(controlled).
 *   (기존 좌측 레일의 지도 썸네일·바로가기는 상단 네비 DesktopTopNav 카테고리 바/액션이 대체 — 중복 제거.)
 *   순수 프레젠테이션 — 카테고리는 props 로 controlled. 라이트 기본 + dark: 대응(홈 테마 정합).
 *   🧭 2026-07-20 (대표 신고 "카테고리 클릭하면 가끔 저절로 동네딜로 넘어감" 전수조사): 카테고리 클릭은
 *   **절대 페이지 이동하지 않는다(제자리 필터)** — 숙소도 navigate('/stays') 대신 필터로 통일.
 *   날짜·인원 숙소 검색(/stays)은 숙소 카테고리 활성 시 PcHomePage 가 배너 링크로 안내(명시적 이동만).
 */

export type { DealCategory } from '@/shared/deal-cats'

/**
 * 🏷️ 카테고리 라벨 SSOT — 레일 칩과 홈 제목이 **같은 표**를 읽는다(문구가 갈리면 반드시 어긋난다).
 *
 * ⚠️ 2026-10-08: 라벨·순서는 `@/shared/deal-cats`(순수)로 내렸고 여기서는 **아이콘만** 붙인다.
 *   이 파일은 `lucide-react` 를 import 하므로 워커가 읽을 수 없는데(번들 gzip 게이트),
 *   홈 첫 화면을 서버가 그릴 때 같은 라벨이 필요하다. 그 파일 머리말에 사유가 있다.
 */
const CAT_ICON: Record<DealCategory, typeof LayoutGrid> = {
  all: LayoutGrid,
  meal_voucher: Utensils,
  beauty_voucher: Scissors,
  stay_voucher: BedDouble,
  etc_voucher: Shapes,
}
export const DEAL_CATS: { key: DealCategory; label: string; icon: typeof LayoutGrid }[] =
  DEAL_CAT_LABELS.map(({ key, label }) => ({ key, label, icon: CAT_ICON[key] }))

export default function PcHomeRail({
  category,
  onCategory,
}: {
  category: DealCategory
  onCategory: (c: DealCategory) => void
}) {
  return (
    <nav aria-label="동네딜 카테고리" className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {DEAL_CATS.map(({ key, label, icon: Icon }) => {
        const active = category === key
        return (
          <button
            key={key}
            onClick={() => onCategory(key)}
            aria-current={active ? 'true' : undefined}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[15px] font-bold border transition-colors ${
              active
                ? 'bg-brand text-white border-brand'
                : 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2C2F35] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
