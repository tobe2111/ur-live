/**
 * 🛡️ 2026-04-29 v4 Wallet 공유 atoms — iOS-style inset grouped lists
 *
 * - LargeTitle: 32px 800 페이지 제목
 * - InsetGroup: rounded-2xl 카드 그룹 + 선택적 section title/footer
 * - ListRow: settings 형 행 (icon squircle + title + value/badge + chevron)
 * - StatGrid: 통계 N개 가로 row (구분선 1px)
 *
 * 4종 페이지 (MyPage/Orders/Wishlist/Vouchers) 에서 공유. 테마 토큰을 prop 으로 받음.
 */

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { walletTokens, type WalletTheme, type WalletTokens } from './walletTokens'

function tokens(theme: WalletTheme = 'dark'): WalletTokens {
  return walletTokens[theme]
}

// ──────────────────────────────────────────────────────────────
// LargeTitle — 32px 800 페이지 제목
// ──────────────────────────────────────────────────────────────
export function LargeTitle({ theme = 'dark', title, subtitle }: {
  theme?: WalletTheme; title: string; subtitle?: string
}) {
  const t = tokens(theme)
  return (
    <div className="px-4 pt-3 pb-3">
      <h1 style={{ fontSize: 32, fontWeight: 800, color: t.label, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 13, color: t.secondary, marginTop: 4 }}>{subtitle}</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// InsetGroup — rounded 카드 그룹 (UPPERCASE 섹션 제목 + footer)
// ──────────────────────────────────────────────────────────────
export function InsetGroup({ theme = 'dark', title, footer, children, className = '' }: {
  theme?: WalletTheme; title?: string; footer?: ReactNode; children: ReactNode; className?: string
}) {
  const t = tokens(theme)
  return (
    <div className={`px-4 mb-7 ${className}`}>
      {title && (
        <p className="px-1 mb-1.5 uppercase"
          style={{ fontSize: 12, color: t.secondary, fontWeight: 500, letterSpacing: '-0.01em' }}>
          {title}
        </p>
      )}
      <div className="overflow-hidden" style={{ background: t.card, borderRadius: 14 }}>
        {children}
      </div>
      {footer && (
        <p className="px-1 mt-1.5" style={{ fontSize: 11, color: t.secondary, lineHeight: 1.4 }}>
          {footer}
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// ListRow — settings 행 (icon + title + value/badge + chevron)
// ──────────────────────────────────────────────────────────────
export function ListRow({
  theme = 'dark',
  icon,
  iconBg,
  iconFg,
  title,
  subtitle,
  value,
  badge,
  last,
  onClick,
  href,
  danger,
  noChevron,
  rightSlot,
}: {
  theme?: WalletTheme
  icon?: ReactNode
  iconBg?: string
  iconFg?: string
  title: string
  subtitle?: string
  value?: string | number
  badge?: string | number
  last?: boolean
  onClick?: () => void
  href?: string
  danger?: boolean
  noChevron?: boolean
  rightSlot?: ReactNode
}) {
  const t = tokens(theme)
  const Tag = href ? 'a' : 'button'
  const props: Record<string, unknown> = href ? { href } : { onClick, type: 'button' }
  return (
    <Tag
      {...props}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-white/5 transition-colors"
      style={{ borderBottom: last ? 'none' : `0.5px solid ${t.separator}` }}
    >
      {icon && (
        <div className="rounded-[7px] flex items-center justify-center shrink-0"
          style={{ width: 28, height: 28, background: iconBg || t.accent, color: iconFg || '#FFF' }}>
          <span className="flex items-center justify-center" style={{ width: 16, height: 16 }}>{icon}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 15, color: danger ? t.danger : t.label, fontWeight: 400 }}>{title}</p>
        {subtitle && (
          <p className="truncate" style={{ fontSize: 12, color: t.secondary, marginTop: 1 }}>{subtitle}</p>
        )}
      </div>
      {badge != null && (
        <span className="rounded-full flex items-center justify-center px-1.5"
          style={{ minWidth: 20, height: 20, background: t.danger, color: '#FFF', fontSize: 11, fontWeight: 700 }}>
          {badge}
        </span>
      )}
      {value != null && (
        <p style={{ fontSize: 14, color: t.secondary, marginRight: 2 }}>{value}</p>
      )}
      {rightSlot}
      {!noChevron && (
        <ChevronRight className="shrink-0" style={{ width: 16, height: 16, color: t.tertiary }} />
      )}
    </Tag>
  )
}

// ──────────────────────────────────────────────────────────────
// StatGrid — N개 통계 가로 row (구분선)
// ──────────────────────────────────────────────────────────────
export function StatGrid({ theme = 'dark', items }: {
  theme?: WalletTheme
  items: { label: string; value: string | number; unit?: string; onClick?: () => void; muted?: boolean }[]
}) {
  const t = tokens(theme)
  return (
    <div className="rounded-2xl px-3 py-4 flex items-stretch" style={{ background: t.card }}>
      {items.map((s, i) => (
        <div key={`${s.label}-${i}`} className="flex flex-1 items-stretch">
          {i > 0 && <div style={{ width: 1, background: t.separator, margin: '4px 0' }} />}
          <button
            type="button"
            onClick={s.onClick}
            className="flex-1 text-center px-1 disabled:cursor-default"
            disabled={!s.onClick}
          >
            <p style={{ fontSize: 11, color: t.secondary, marginBottom: 4, fontWeight: 500 }}>{s.label}</p>
            <p style={{ fontSize: 19, fontWeight: 700, color: s.muted ? t.tertiary : t.label, letterSpacing: '-0.02em' }}>
              {s.value}
              {s.unit && <span style={{ fontSize: 11, color: t.secondary, fontWeight: 500, marginLeft: 2 }}>{s.unit}</span>}
            </p>
          </button>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// OrderStatusGrid — 주문 현황 5단계 (count + label)
// ──────────────────────────────────────────────────────────────
export function OrderStatusGrid({ theme = 'dark', items }: {
  theme?: WalletTheme
  items: { key: string; label: string; count: number; onClick?: () => void }[]
}) {
  const t = tokens(theme)
  return (
    <div className="px-4 py-3 flex items-center justify-around">
      {items.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={o.onClick}
          className="flex-1 text-center"
          aria-label={`${o.label} ${o.count}건`}
        >
          <p style={{ fontSize: 22, fontWeight: 700, color: o.count ? t.label : t.tertiary, letterSpacing: '-0.02em' }}>
            {o.count}
          </p>
          <p style={{ fontSize: 10, color: t.secondary, marginTop: 2, fontWeight: 500 }}>{o.label}</p>
        </button>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// WalletPageWrapper — 페이지 전체 래퍼 (배경색 + 하단 패딩)
// ──────────────────────────────────────────────────────────────
export function WalletPageWrapper({ theme = 'dark', children, className = '' }: {
  theme?: WalletTheme; children: ReactNode; className?: string
}) {
  const t = tokens(theme)
  return (
    <div className={className} style={{ background: t.bg, minHeight: '100dvh', paddingBottom: 28, color: t.label }}>
      {children}
    </div>
  )
}
