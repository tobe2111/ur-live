/**
 * 🏬 2026-06-15 (사용자 요청 — sellpie형 제안/신고 게시판): 제안/신고 카테고리 SSOT.
 *   서버(검증/저장)·클라(탭/카드/뱃지)가 공유. report 계열은 type='report', 그 외 type='proposal'
 *   로 매핑(기존 admin 큐 호환). 라벨/이모지는 sellpie 게시판 시안 기준.
 */
export interface ProposalCategory {
  key: string
  label: string
  emoji: string
  /** 카드/상단 설명 (6개 아이콘 카드) */
  desc: string
  /** admin 호환 type: 신고 계열은 report, 나머지 proposal */
  type: 'proposal' | 'report'
}

export const PROPOSAL_CATEGORIES: readonly ProposalCategory[] = [
  { key: 'supply',   label: '상품 공급 제안',     emoji: '📦', desc: '상품을\n공급하고 싶어요!',              type: 'proposal' },
  { key: 'codev',    label: '상품 공동개발 제안', emoji: '🤝', desc: '상품 공동개발을\n제안해요!',           type: 'proposal' },
  { key: 'live',     label: '라이브커머스 제안',   emoji: '📱', desc: '라이브커머스를\n제안해요!',           type: 'proposal' },
  { key: 'sns',      label: 'SNS/공동구매 제안',  emoji: '🛍️', desc: 'SNS 공동구매·폐쇄몰\n파트너 할인 제안!', type: 'proposal' },
  { key: 'report',   label: '최저가 미준수 신고', emoji: '💰', desc: '최저가\n미준수 신고',                 type: 'report' },
  { key: 'inquiry',  label: '문의 및 불편사항',   emoji: '💬', desc: '기타\n문의사항',                     type: 'report' },
] as const

export const PROPOSAL_CATEGORY_KEYS = new Set(PROPOSAL_CATEGORIES.map(c => c.key))

export function categoryLabel(key: string | null | undefined): string {
  return PROPOSAL_CATEGORIES.find(c => c.key === key)?.label || '문의 및 불편사항'
}

/** 카테고리 → admin 호환 type. */
export function categoryToType(key: string): 'proposal' | 'report' {
  return PROPOSAL_CATEGORIES.find(c => c.key === key)?.type || 'proposal'
}
