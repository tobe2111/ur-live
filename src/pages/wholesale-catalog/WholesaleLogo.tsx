// ──────────────────────────────────────────────────────────────
// 🏷️ UTONG START 브랜드 로고 — 대표 제공 PNG 이미지 (public/utong-start-logo.png).
//   ⚠️ 로고 교체 = public/utong-start-logo.png (+ 다크용 -white.png) 파일만 바꾸면
//      헤더·푸터·로그인 등 이 컴포넌트를 쓰는 전 화면이 동시에 반영됩니다.
// ──────────────────────────────────────────────────────────────
import { WT } from '../wholesale/wholesale-theme'

/** 브랜드 로고 이미지 경로 (public 정적). 교체 시 이 파일만 변경. */
export const WHOLESALE_LOGO_SRC = '/utong-start-logo.png'
/** 다크 배경용 흰색 로고. */
export const WHOLESALE_LOGO_SRC_DARK = '/utong-start-logo-white.png'

/** 폴백 마크 (파비콘/대체용 — 본 로고는 WholesaleWordmark 이미지). */
export function WholesaleMark({ size = 34, color = WT.brand }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <path d="M20 5 L33 30 L20 23 L7 30 Z" fill={color} />
    </svg>
  )
}

/** 브랜드 워드마크 = 대표 제공 UTONG START 로고 이미지(투명 PNG). height(px)로 크기 조절. dark=어두운 배경용 흰 로고. */
export function WholesaleWordmark({ height = 30, dark = false }: { height?: number; dark?: boolean }) {
  // 🏎️ 2026-06-19 (Lighthouse): 로고 종횡비(900:310 ≈ 2.903)로 width 명시 → CLS 0 + 디코딩 힌트.
  const width = Math.round(height * (900 / 310))
  return (
    <img
      src={dark ? WHOLESALE_LOGO_SRC_DARK : WHOLESALE_LOGO_SRC}
      alt="유통스타트 도매몰"
      draggable={false}
      width={width}
      height={height}
      decoding="async"
      className="block w-auto shrink-0 select-none"
      style={{ height }}
    />
  )
}
