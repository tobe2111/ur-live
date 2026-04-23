/**
 * 🛡️ 2026-04-22 배치 127: 일반 카드 — 섹션 그룹화
 */
import type { ReactNode } from 'react'

interface DashboardCardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  noPadding?: boolean
  className?: string
}

export default function DashboardCard({
  title,
  subtitle,
  actions,
  children,
  noPadding = false,
  className = '',
}: DashboardCardProps) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </section>
  )
}
