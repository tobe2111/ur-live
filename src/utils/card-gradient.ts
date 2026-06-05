/**
 * 🏭 2026-06-04 (사용자 요청): 상품 카드 그라데이션 디자인 헬퍼.
 *
 *   목적: 사진에서 미리 뽑아둔 dominant_color(대표색)를 카드 배경 그라데이션으로 사용 →
 *         사진이 아래쪽에서 카드색으로 자연스럽게 "번지고", 그 색 블록 위에 제목/가격/평점이 올라감.
 *         (토스/네이버 쇼핑 추천 카드 같은 룩)
 *
 *   가독성: 대표색의 지각 밝기(perceived luminance)를 계산해 글자색을 자동으로 검정/흰색 대비 →
 *           밝은 사진(베이지 등)은 검정 글씨, 어두운 사진(갈색 등)은 흰 글씨.
 *
 *   주의: 가격/평점 등 "내용"은 바꾸지 않음 — 순수 디자인(색/배경)만 제공.
 */

export interface CardGradient {
  /** 카드 전체 배경 (대표색 → 살짝 어두운 세로 그라데이션) */
  background: string
  /** 사진 하단 → 카드색으로 번지는 fade 오버레이 (이미지 위에 absolute 로 덮음) */
  imageFade: string
  /** 본문 기본 글자색 (대표색 밝기 대비) */
  text: string
  /** 보조 글자색 (평점/구매수 등) */
  sub: string
  /** 할인율 강조색 (밝은 배경=진한 빨강 / 어두운 배경=밝은 빨강) */
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

// 대표색이 없을 때(아직 미백필) — 중립 다크 그라데이션 fallback.
const FALLBACK: CardGradient = {
  background: 'linear-gradient(180deg, #242424 0%, #161616 100%)',
  imageFade: 'linear-gradient(to bottom, rgba(0,0,0,0) 55%, #242424 100%)',
  text: '#ffffff',
  sub: 'rgba(255,255,255,0.66)',
  accent: '#ff5a5f',
  isLight: false,
}

export function cardGradient(dominant?: string | null): CardGradient {
  const rgb = dominant ? parseHex(dominant) : null
  if (!rgb) return FALLBACK
  const [r, g, b] = rgb
  // 지각 밝기 0~1 (sRGB 가중치)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const isLight = lum > 0.6
  const base = `rgb(${r}, ${g}, ${b})`
  const dark = `rgb(${Math.round(r * 0.78)}, ${Math.round(g * 0.78)}, ${Math.round(b * 0.78)})`
  return {
    background: `linear-gradient(180deg, ${base} 0%, ${dark} 100%)`,
    imageFade: `linear-gradient(to bottom, rgba(0,0,0,0) 52%, ${base} 100%)`,
    text: isLight ? '#1a1a1a' : '#ffffff',
    sub: isLight ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.68)',
    accent: isLight ? '#e11d48' : '#ff5a5f',
    isLight,
  }
}
