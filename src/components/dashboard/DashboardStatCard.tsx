/**
 * 🛡️ 2026-04-22 배치 127: KPI / 통계 카드
 */
import type { ReactNode } from 'react'

interface DashboardStatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  hint?: string
  trend?: { value: number; label?: string }
  accent?: 'blue' | 'green' | 'rose' | 'amber' | 'violet' | 'gray'
  loading?: boolean
}

const ACCENT_MAP: Record<NonNullable<DashboardStatCardProps['accent']>, { icon: string; bar: string }> = {
  blue:   { icon: 'bg-blue-50 text-blue-600',     bar: 'bg-blue-500' },
  green:  { icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  rose:   { icon: 'bg-rose-50 text-rose-600',     bar: 'bg-rose-500' },
  amber:  { icon: 'bg-amber-50 text-amber-600',   bar: 'bg-amber-500' },
  violet: { icon: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
  gray:   { icon: 'bg-gray-100 text-gray-600',    bar: 'bg-gray-400' },
}

export default function DashboardStatCard({
  label,
  value,
  icon,
  hint,
  trend,
  accent = 'blue',
  loading = false,
}: DashboardStatCardProps) {
  const colors = ACCENT_MAP[accent]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white p-4 shadow-sm transition-shadow hover:shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-gray-500">{label}</p>
          {loading ? (
            <div className="mt-1 h-7 w-20 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="mt-1 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{value}</p>
          )}
          {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
          {trend && (
            <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>{trend.value >= 0 ? '▲' : '▼'}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="font-normal text-gray-400">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.bar}`} />
    </div>
  )
}
