/**
 * 💗 찜 목록 부품 — 정렬 칩 · 카드 위 신호 배지 · PC 요약 레일 (2026-09-03 안 B).
 *
 * 표면 규칙을 그대로 따른다: 카드 테두리 0(흰 면 + `shadow-lift`), 강조색은 브랜드 하나,
 * 숫자가 주인공. 배지는 **색깔 정보상자를 만들지 않는다** — 글자 색 하나로만 말한다.
 */
import { ArrowDown, Clock } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { dealCategoryMeta } from '@/shared/deal-category-icon'
import type { WishlistSort, WishlistSummary } from './wishlist-signals'
import { SOON_DAYS } from './wishlist-signals'

const SORTS: { key: WishlistSort; label: string; pcOnly?: boolean }[] = [
  { key: 'recent', label: '최근 찜순' },
  { key: 'drop', label: '가격 내림' },
  { key: 'deadline', label: '마감 임박' },
  { key: 'discount', label: '할인율', pcOnly: true },
]

export function WishlistSortChips({ value, onChange }: { value: WishlistSort; onChange: (v: WishlistSort) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="정렬">
      {SORTS.map((s) => (
        <button
          key={s.key}
          type="button"
          role="tab"
          aria-selected={value === s.key}
          onClick={() => onChange(s.key)}
          className={`shrink-0 h-9 px-4 rounded-full text-[13.5px] transition-colors ${s.pcOnly ? 'hidden lg:inline-flex items-center' : ''} ${
            value === s.key
              ? 'bg-brand text-white font-bold'
              : 'bg-white dark:bg-[#1D1F29] text-gray-700 dark:text-gray-300 shadow-lift dark:shadow-none'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

/** 카드 본문 맨 위 한 줄. 둘 다 해당하면 **가격 인하를 먼저** 보여준다(행동을 더 강하게 만든다). */
export function WishlistFlag({ drop, days }: { drop: number | null; days: number | null }) {
  if (drop != null) {
    return (
      <p className="flex items-center gap-0.5 text-[11px] font-bold leading-none mb-1 text-brand-text">
        <ArrowDown className="w-3 h-3" aria-hidden="true" />
        {formatNumber(drop)}원 내림
      </p>
    )
  }
  if (days != null && days <= SOON_DAYS) {
    return (
      <p className="flex items-center gap-1 text-[11px] font-bold leading-none mb-1 text-gray-900 dark:text-gray-100">
        <Clock className="w-3 h-3" aria-hidden="true" />
        {days === 0 ? '오늘 마감' : `${days}일 남음`}
      </p>
    )
  }
  return null
}

/**
 * PC 왼쪽 레일 — "지금 결정해야 할 것이 몇 개인지".
 *
 * ⚠️ 큰 숫자는 **0 을 띄우지 않는다.** 인하가 없으면 마감 임박으로, 그것도 없으면 전체 개수로
 *    내려간다. 텅 빈 화면에 커다란 0 을 세우는 것은 정보가 아니라 실망이다.
 */
export function WishlistSummaryRail({ s }: { s: WishlistSummary }) {
  const headline =
    s.drops > 0
      ? { n: s.drops, cap: '찜한 뒤 가격이 내렸어요' }
      : s.soon > 0
        ? { n: s.soon, cap: `마감이 ${SOON_DAYS}일 안에 다가와요` }
        : { n: s.total, cap: '찜한 상품' }

  const rows: { label: string; value: number; strong?: boolean }[] = []
  if (s.drops > 0 && headline.cap !== '찜한 뒤 가격이 내렸어요') rows.push({ label: '가격 내림', value: s.drops, strong: true })
  if (s.soon > 0 && !headline.cap.startsWith('마감')) rows.push({ label: `마감 ${SOON_DAYS}일 이내`, value: s.soon, strong: true })
  for (const c of s.byCategory) rows.push({ label: dealCategoryMeta(c.category).label || c.category, value: c.count })

  return (
    <aside className="hidden lg:block rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift dark:shadow-none p-5 self-start sticky top-20">
      <div className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-gray-900 dark:text-white">
        {headline.n}
      </div>
      <p className="mt-1.5 text-[12.5px] text-gray-500 dark:text-gray-400">{headline.cap}</p>
      {rows.length > 0 && (
        <>
          <hr className="my-4 border-0 border-t border-rule" />
          <dl className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 text-[13px]">
                <dt className="text-gray-500 dark:text-gray-400 truncate">{r.label}</dt>
                <dd className={`tabular-nums ${r.strong ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </aside>
  )
}
