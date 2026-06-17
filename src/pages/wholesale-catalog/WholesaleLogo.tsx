// ──────────────────────────────────────────────────────────────
// 🏷️ 2026-06-17 (사용자 제공 시안) — UTONG START 브랜드 로고 (벡터).
//   네이비 U + 오렌지 상승 화살표 마크 + "TONG"(네이비) "START"(오렌지) 워드마크.
//   벡터(inline SVG/HTML)라 모든 height 에서 선명 + dark 배경(네이비→흰색) 자동 대응.
//   ⚠️ 픽셀 정확한 래스터 PNG 를 쓰려면: public/utong-start-logo.png(+ -white.png) 교체 후
//      WholesaleWordmark 를 <img src={WHOLESALE_LOGO_SRC}> 로 되돌리면 됩니다(아래 상수 보존).
// ──────────────────────────────────────────────────────────────
import { WT } from '../wholesale/wholesale-theme'

/** (레거시/대체용) 래스터 로고 경로 — PNG 로 되돌릴 때 사용. 현재 워드마크는 벡터. */
export const WHOLESALE_LOGO_SRC = '/utong-start-logo.png'
export const WHOLESALE_LOGO_SRC_DARK = '/utong-start-logo-white.png'

/** 🔼 브랜드 마크 — 네이비 U + 오렌지 상승 화살표(성장/유통). dark=어두운 배경(네이비→흰색). */
export function WholesaleMark({ size = 34, dark = false, navy, orange }: { size?: number; dark?: boolean; navy?: string; orange?: string }) {
  const ink = navy || (dark ? '#FFFFFF' : WT.ink) // 네이비 #0C2454 (dark 시 흰색)
  const acc = orange || WT.brand                  // 오렌지 #FC5424
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0, display: 'block' }} aria-hidden>
      {/* 네이비 U — 왼쪽 기둥 + 아래 보울 */}
      <path d="M13 9 L13 24 A10 10 0 0 0 33 24" fill="none" stroke={ink} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 오렌지 스우시→상승 화살표 — 좌하단에서 U 아래를 쓸어 우측으로 솟구침 */}
      <path d="M6 32 C14 41 27 39 31 24 L35 11" fill="none" stroke={acc} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {/* 화살촉 (위쪽) */}
      <path d="M30.5 11.5 L38 5 L43 15 Z" fill={acc} />
    </svg>
  )
}

/** 브랜드 워드마크 = [U 마크] TONG START. height(px)로 크기 조절. dark=어두운 배경용(네이비→흰색). */
export function WholesaleWordmark({ height = 30, dark = false }: { height?: number; dark?: boolean }) {
  const ink = dark ? '#FFFFFF' : WT.ink
  const acc = WT.brand
  return (
    <span
      className="inline-flex items-center select-none"
      style={{ height, lineHeight: 1, gap: Math.round(height * 0.08) }}
      aria-label="유통스타트 도매몰"
      role="img"
    >
      <WholesaleMark size={Math.round(height * 1.22)} dark={dark} />
      <span
        style={{
          fontSize: Math.round(height * 0.84),
          fontWeight: 800,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          fontFamily: "'Pretendard', system-ui, -apple-system, sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: ink }}>TONG</span>
        <span style={{ color: acc, marginLeft: '0.16em' }}>START</span>
      </span>
    </span>
  )
}
