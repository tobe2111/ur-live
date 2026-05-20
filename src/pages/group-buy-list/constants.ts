/**
 * 🛡️ 2026-05-02: TD-018 분할 — GroupBuyListPage 정렬/상태 상수.
 */
import type { SortOption } from './types'

export const SORT_LABELS: Record<SortOption, string> = {
  popular: '인기순',
  deadline: '마감임박순',
  newest: '신규순',
  // 🛡️ 2026-05-20: SortOption 에 'discount' 추가됨 — Record 완전성 유지.
  discount: '할인율순',
}

export const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  proposed: { label: '모집중', className: 'bg-pink-500 text-white' },
  negotiating: { label: '협상중', className: 'bg-amber-500 text-white' },
  confirmed: { label: '확정', className: 'bg-emerald-500 text-white' },
  achieved: { label: '달성', className: 'bg-blue-500 text-white' },
  failed: { label: '마감', className: 'bg-gray-400 text-white' },
  refunded: { label: '환불됨', className: 'bg-gray-400 text-white' },
}
