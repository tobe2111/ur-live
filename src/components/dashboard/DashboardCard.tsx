/**
 * 🛡️ 2026-04-22 배치 127: 일반 카드 — 섹션 그룹화
 *
 * 🎨 2026-09-14 (대표 Rinda 시안 — docs/design/dashboard-rinda-2026-09.md §3):
 *   `shadow-lift` → **헤어라인 테두리**. 소비자 표면은 "카드 테두리 0 + 그림자 한 값"(🎫)이 정본이지만
 *   대시보드는 한 화면에 카드가 10장 넘게 깔린다 — 그림자 10개는 화면을 뿌옇게 만들고 시선이 안 잡힌다.
 *   ⚠️ 이 규칙을 소비자 카드로 옮기지 말 것(🎫 절이 그쪽 정본이다).
 *   덤으로 `dark:border-[#2C2F35]` 도 사라졌다 — 대시보드는 라이트 고정이라 닿지 않는 죽은 값이었다.
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
    <section className={`overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-rule px-[var(--dash-pad-x,20px)] py-[var(--dash-pad-y,16px)]">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={noPadding ? '' : 'px-[var(--dash-pad-x,20px)] py-[var(--dash-pad-y,16px)]'}>{children}</div>
    </section>
  )
}
