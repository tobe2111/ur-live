// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-15 도매몰 리디자인 (Claude Design 핸드오프 — 유통스타트 도매몰.dc.html)
//   확정 로고 = "A1 솔리드 셰브론(런치 마크)" 배경 사각형 없이 마크 단독.
//   워드마크 = 유통스타트 Pretendard ExtraBold, 자간 -5% + UTONGSTART 캡션.
//   path/viewBox 는 시안과 byte-identical (M20 5 L33 30 L20 23 L7 30 Z / 0 0 40 40).
// ──────────────────────────────────────────────────────────────
import { WT } from '../wholesale/wholesale-theme'

/** 셰브론 마크 단독 (배경 없음). color 기본 = 브랜드 레드. 모노/역상은 color 로. */
export function WholesaleMark({ size = 34, color = WT.brand }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <path d="M20 5 L33 30 L20 23 L7 30 Z" fill={color} />
    </svg>
  )
}

/** 가로 락업: 마크 + 워드마크(+ '도매몰' 보조 + UTONGSTART 캡션). dark=다크 배경용 흰 글자. */
export function WholesaleWordmark({ name = '유통스타트', markSize = 34, dark = false, showSub = true }: { name?: string; markSize?: number; dark?: boolean; showSub?: boolean }) {
  const ink = dark ? '#fff' : WT.ink
  const isDefault = name === '유통스타트'
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <WholesaleMark size={markSize} />
      <div style={{ lineHeight: 1.05 }}>
        <div className="font-extrabold whitespace-nowrap" style={{ fontSize: 18, letterSpacing: '-0.055em', color: ink }}>
          {name}
          {showSub && <span style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#AEB4BC', fontWeight: 600, fontSize: 11, marginLeft: 5, letterSpacing: 0 }}>도매몰</span>}
        </div>
        {isDefault && (
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em', color: dark ? 'rgba(255,255,255,0.4)' : '#C4C9D0', marginTop: 2 }}>UTONGSTART</div>
        )}
      </div>
    </div>
  )
}
