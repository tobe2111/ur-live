/**
 * urdeal. 워드마크 — single source of truth.
 *
 * 🎨 2026-07-19 대표 확정 로고(Ur Deal 로고 Final 핸드오프) 반영:
 *   - 소문자 "urdeal" + 로즈 원 마침표(베이스라인 위, 지름 = 획 굵기) — 이전 "UR·DEAL"(이탤릭+▶) 폐기
 *   - Poppins 800 · 자간 −3.5% · 플랫(이탤릭/장식 없음)
 *   - 색: 라이트=네이비 #16181C / 다크=웜화이트 #F8F7FC, 점은 항상 로즈 #1C69EF
 *   - 원본 규정: docs/design/brand-assets/ (핸드오프 납품본 아카이브)
 *
 * Poppins 는 index.html 에서 urdeal 6글자 서브셋(&text=)만 로드 — 미로딩/폴백 시 Pretendard 800.
 */
interface UrDealLogoProps {
  size?: number
  /** Force dark-surface coloring (웜화이트 텍스트) regardless of theme. */
  forceDark?: boolean
  /** Force light-surface coloring (네이비 텍스트) regardless of theme. */
  forceLight?: boolean
  className?: string
}

export default function UrDealLogo({ size = 20, forceDark = false, forceLight = false, className = '' }: UrDealLogoProps) {
  const textClass = forceDark
    ? 'text-[#F8F7FC]'
    : forceLight
    ? 'text-[#16181C]'
    : 'text-[#16181C] dark:text-[#F8F7FC]'

  return (
    <span
      aria-label="urdeal — 유어딜"
      className={`inline-flex items-baseline select-none ${textClass} ${className}`}
      style={{
        fontFamily: "'Poppins', 'Pretendard Variable', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.035em',
        lineHeight: 1,
      }}
    >
      urdeal
      {/* 로즈 원 마침표 — 베이스라인 위(items-baseline 로 점 하단 = 베이스라인) */}
      <span
        aria-hidden
        className="bg-brand"
        style={{
          display: 'inline-block',
          width: Math.max(2, size * 0.18),
          height: Math.max(2, size * 0.18),
          borderRadius: '50%',
          marginLeft: size * 0.08,
        }}
      />
    </span>
  )
}
