/**
 * 🧱 2026-08-30 (file-size 래칫): VouchersPage 에서 상수만 분리 — 동작 불변, 이동뿐이다.
 *
 *   이모지를 선 아이콘으로 바꾸면서 import 와 필드가 늘어 990줄이 됐고(cap 987),
 *   래칫이 잡았다. CLAUDE.md 규칙대로 **rebaseline 이 아니라 추출**로 줄인다.
 */
import {
  ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Flame, Shirt, Smartphone,
  Sofa, Soup, Sparkle, Tag, type LucideIcon,
} from 'lucide-react'
import type { SortOptionItem } from '@/components/ui/sort-menu'

// 🛡️ 2026-05-21: 교환권 정렬 옵션 (사용자 요청).
export type SortKey = 'popular' | 'newest' | 'price_low' | 'price_high' | 'discount' | 'rating'

// 🖊️ 2026-08-30: 라벨에 붙어 있던 이모지(🔥 🆕 💰 💎 🏷️) → 선 아이콘.
//   SortMenu 는 커스텀 드롭다운이라 SVG 가 들어간다(네이티브 <select> 가 아니다).
export const SORT_OPTIONS: Array<SortOptionItem<SortKey>> = [
  { key: 'popular',    label: '인기순',      Icon: Flame },
  { key: 'newest',     label: '최신순',      Icon: Clock },
  { key: 'price_low',  label: '낮은 가격순', Icon: ArrowDownWideNarrow },
  { key: 'price_high', label: '높은 가격순', Icon: ArrowUpWideNarrow },
  { key: 'discount',   label: '할인율순',    Icon: Tag },
  // 🎫 2026-06-21 (대표 요청): 교환권 별점 미표시 → '평점순' 정렬 옵션 제거(숨은 필드 정렬 방지).
]

// 🛒 2026-06-23 (대표 — '쇼핑도 카테고리 전에 짜뒀잖아'): /browse 와 동일한 쇼핑 카테고리.
//   ⚠️ key 는 products.category 의 **실제 저장값**(셀러/어드민/CSV 폼 SSOT) — alias 없는
//   정확일치 필터라 키가 어긋나면 0개. 저장값: fashion/beauty/food/electronics/lifestyle.
export const SHOP_CATEGORIES: Array<{ key: string; label: string; Icon: LucideIcon | null }> = [
  { key: 'all',         label: '전체',   Icon: null },
  { key: 'food',        label: '식품',   Icon: Soup },
  { key: 'fashion',     label: '패션',   Icon: Shirt },
  { key: 'beauty',      label: '뷰티',   Icon: Sparkle },
  { key: 'lifestyle',   label: '리빙',   Icon: Sofa },
  { key: 'electronics', label: '디지털', Icon: Smartphone },
]
