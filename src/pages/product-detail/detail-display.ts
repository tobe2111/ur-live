/**
 * 🧭 2026-06-22: 상품 상세 정보 노출 결정 SSOT (pure helper — 테스트 가능).
 *
 * 배경: ProductDetailPage 의 '상세정보 펼쳐보기' 버튼이 onClick 없이 dead 였음 →
 *   접힌 상태에서 첫 이미지 1장 + 설명 200자만 보이고 나머지에 영구 도달 불가.
 *   토글 동작을 살리면서, "무엇을 보여줄지" 결정 로직을 순수 함수로 분리해 회귀를 잠금.
 */

/** 접힘 상태에서 미리보기로 노출할 설명 길이(자). */
export const DETAIL_PREVIEW_LEN = 200

export interface DetailDisplay {
  /** 노출할 상세 이미지 목록 (접힘: 첫 1장 / 펼침: 전체). */
  images: string[]
  /** 노출할 설명 텍스트 (접힘: 200자 슬라이스 / 펼침: 전문). */
  text: string
  /** 설명이 잘렸는지 (… 표시 여부 — 접힘 + 200자 초과일 때만). */
  truncated: boolean
  /** '펼쳐보기' 버튼을 보여줄 여지가 있는지 (이미지 2장+ 또는 설명 200자 초과). */
  canExpand: boolean
}

/**
 * 상세 이미지/설명 + 펼침 여부 → 실제 노출 내용 결정.
 * @param detailImages 파싱된 상세 이미지 URL 배열
 * @param longDescription 상품 상세 설명 (없을 수 있음)
 * @param expanded 사용자가 '펼쳐보기'를 눌렀는지
 */
export function resolveDetailDisplay(
  detailImages: string[],
  longDescription: string | null | undefined,
  expanded: boolean,
): DetailDisplay {
  const imgs = Array.isArray(detailImages) ? detailImages : []
  const desc = longDescription || ''
  const overLen = desc.length > DETAIL_PREVIEW_LEN
  return {
    images: expanded ? imgs : imgs.slice(0, 1),
    text: expanded ? desc : desc.slice(0, DETAIL_PREVIEW_LEN),
    truncated: !expanded && overLen,
    canExpand: imgs.length > 1 || overLen,
  }
}
