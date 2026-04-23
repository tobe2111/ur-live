/**
 * 🛡️ 2026-04-22 배치 127: 셀러/에이전시 대시보드 공통 디자인 시스템
 *
 * 일관된 페이지 헤더 — 제목 + 부제 + 우측 액션 슬롯.
 * 전 대시보드 페이지가 동일한 시각 언어를 가지도록.
 */
import type { ReactNode } from 'react'

interface DashboardPageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export default function DashboardPageHeader({
  title,
  subtitle,
  icon,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
