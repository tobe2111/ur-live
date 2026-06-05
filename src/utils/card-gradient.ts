/**
 * 🏭 2026-06-04 (사용자 요청): 상품 카드 그라데이션 디자인 헬퍼.
 *
 *   목적: 사진에서 뽑은 대표색을 카드 배경(단색)으로 쓰고, 사진 하단을 "같은 색"으로 자연스럽게
 *         번지게(투명→불투명) 해서 사진이 카드색 블록으로 녹아들도록. (토스/네이버 추천 카드 룩)
 *
 *   핵심: 번짐(imageFade)을 `rgba(r,g,b,0) → rgb(r,g,b)` 로 같은 색의 투명→불투명으로 처리 →
 *         검정/회색 안개 없이 사진과 텍스트 블록 사이 경계가 사라짐.
 *
 *   가독성: 대표색 밝기로 글자색을 검정/흰색 자동 대비.
 *   주의: 가격/평점 등 "내용"은 안 바꿈 — 색/배경만.
 */

export interface CardGradient {
  /** 카드 배경 단색 */
  base: string
  /** 사진 하단 → base 로 번지는 오버레이 (같은 색 투명→불투명) */
  imageFade: string
  /** 본문 기본 글자색 (대표색 밝기 대비) */
  text: string
  /** 보조 글자색 */
  sub: string
  /** 할인율 강조색 */
  accent: string
  /** 대표색이 밝은지 여부 */
  isLight: boolean
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function build(r: number, g: number, b: number): CardGradient {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const isLight = lum > 0.6
  return {
    base: `rgb(${r}, ${g}, ${b})`,
    // 같은 색의 투명 → 불투명 → 경계 없는 자연스러운 번짐.
    imageFade: `linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, 0.6) 55%, rgb(${r}, ${g}, ${b}) 100%)`,
    text: isLight ? '#1a1a1a' : '#ffffff',
    sub: isLight ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.70)',
    accent: isLight ? '#e11d48' : '#ff6b6b',
    isLight,
  }
}

// 대표색이 아직 없을 때(이미지 로드 전) — 중립 다크.
const FALLBACK = build(0x24, 0x24, 0x24)

export function cardGradient(dominant?: string | null): CardGradient {
  const rgb = dominant ? parseHex(dominant) : null
  if (!rgb) return FALLBACK
  return build(rgb[0], rgb[1], rgb[2])
}
