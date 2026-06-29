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
  // 🏬 2026-06-29 (대표 요청): 라이브커머스 제안(live)·SNS/공동구매 제안(sns) 카드 제거
  //   (라이브커머스 영구중단 LIVE_COMMERCE_SUSPENDED — 제안 카드 부적합). 기존 티켓은 categoryLabel 폴백.
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

/**
 * 🏬 2026-06-21 (필터 탭 3개 축소: 전체/제안/신고): kind('proposal'|'report') 별 카테고리 key 목록.
 *   클라(탭 fetch)·서버(WHERE category IN (...)) 공용 SSOT. 하드코딩 금지 — 이 배열에서 파생.
 */
export function categoryKeysByType(type: 'proposal' | 'report'): string[] {
  return PROPOSAL_CATEGORIES.filter(c => c.type === type).map(c => c.key)
}

/** 게시판 필터 kind 화이트리스트 (그 외는 전체). */
export const PROPOSAL_KINDS = ['proposal', 'report'] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]
export function isProposalKind(v: unknown): v is ProposalKind {
  return v === 'proposal' || v === 'report'
}
