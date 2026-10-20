/**
 * 본 사이트 `src/utils/card-gradient.ts` 1:1 이식 (순수 함수 — SSR 안전).
 * 대표색(dominant_color)을 카드 배경 단색으로, 사진 하단을 같은 색 투명→불투명으로
 * 번지게 해 경계를 제거. 밝기 기반 글자색 자동 대비. 본체 변경 시 함께 갱신할 것.
 */

export interface CardGradient {
  base: string
  imageFade: string
  text: string
  sub: string
  accent: string
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
    imageFade: `linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, 0.6) 55%, rgb(${r}, ${g}, ${b}) 100%)`,
    text: isLight ? '#1a1a1a' : '#ffffff',
    sub: isLight ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.70)',
    accent: isLight ? '#e11d48' : '#ff6b6b',
    isLight,
  }
}

const FALLBACK = build(0x24, 0x24, 0x24)

export function cardGradient(dominant?: string | null): CardGradient {
  const rgb = dominant ? parseHex(dominant) : null
  if (!rgb) return FALLBACK
  return build(rgb[0], rgb[1], rgb[2])
}
