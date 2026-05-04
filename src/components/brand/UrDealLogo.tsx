/**
 * UR·DEAL wordmark — single source of truth.
 *
 * By default the colors auto-toggle via the global `dark:` Tailwind variant:
 * - light surface: UR=black, DEAL=black (monochrome)
 * - dark surface:  UR=red,   DEAL=white
 *
 * Pass `forceDark` when the surface is always dark (e.g. live video
 * overlay, color CTA buttons) regardless of the global theme.
 *
 * The U has a tiny ▶ play marker baked in to hint at the live identity.
 */
interface UrDealLogoProps {
  size?: number
  /** Force dark-surface coloring (UR=red, DEAL=white) regardless of theme. */
  forceDark?: boolean
  /** Force light-surface coloring (all black) regardless of theme. */
  forceLight?: boolean
  className?: string
}

export default function UrDealLogo({ size = 20, forceDark = false, forceLight = false, className = '' }: UrDealLogoProps) {
  // Three modes: forceDark (always red+white), forceLight (always black), auto (theme-driven).
  const urClass = forceDark
    ? 'text-[#EF4444]'
    : forceLight
    ? 'text-[#0A0A0A]'
    : 'text-[#0A0A0A] dark:text-[#EF4444]'

  const dealClass = forceDark
    ? 'text-white'
    : forceLight
    ? 'text-[#0A0A0A]'
    : 'text-[#0A0A0A] dark:text-white'

  return (
    <span
      aria-label="UR·DEAL"
      className={`inline-flex items-center select-none ${className}`}
      style={{
        fontFamily: "'Pretendard Variable', system-ui, sans-serif",
        fontWeight: 900,
        fontSize: size,
        letterSpacing: '-0.055em',
        lineHeight: 1,
        fontStyle: 'italic',
      }}
    >
      {/* UR with embedded ▶ play marker */}
      <span className={`relative inline-flex items-baseline ${urClass}`}>
        <span>UR</span>
        <span
          aria-hidden
          className={urClass}
          style={{
            position: 'absolute',
            left: size * 0.18,
            top: size * 0.28,
            width: 0,
            height: 0,
            borderLeft: `${size * 0.14}px solid currentColor`,
            borderTop: `${size * 0.09}px solid transparent`,
            borderBottom: `${size * 0.09}px solid transparent`,
            opacity: 0.85,
          }}
        />
      </span>
      {/* Middle dot — picks accent color */}
      <span
        aria-hidden
        className={urClass}
        style={{
          display: 'inline-block',
          width: size * 0.14,
          height: size * 0.14,
          background: 'currentColor',
          borderRadius: '50%',
          margin: `0 ${size * 0.08}px`,
          transform: `translateY(-${size * 0.06}px)`,
        }}
      />
      <span className={dealClass}>DEAL</span>
    </span>
  )
}
