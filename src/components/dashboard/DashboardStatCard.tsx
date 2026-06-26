/**
 * 🛡️ 2026-04-22 배치 127: KPI / 통계 카드
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface DashboardStatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  hint?: string
  trend?: { value: number; label?: string }
  accent?: 'blue' | 'green' | 'rose' | 'amber' | 'violet' | 'gray'
  loading?: boolean
  /** 지정 시 카드 전체가 해당 경로로 이동하는 링크가 된다(클릭 affordance + 우상단 화살표). */
  to?: string
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
  to,
}: DashboardStatCardProps) {
  const colors = ACCENT_MAP[accent]
  const inner = (
    <>
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
    </>
  )

  // to 지정 시 카드 전체를 Link 로 — 클릭 affordance(커서/hover 보더) + 우상단 화살표 표시.
  if (to) {
    return (
      <Link
        to={to}
        className="group relative block overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white p-4 shadow-sm transition-all hover:shadow hover:border-gray-300"
      >
        <span className="absolute bottom-2 right-3 text-[13px] text-gray-300 transition-colors group-hover:text-gray-600" aria-hidden>↗</span>
        {inner}
      </Link>
    )
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white p-4 shadow-sm transition-shadow hover:shadow">
      {inner}
    </div>
  )
}
