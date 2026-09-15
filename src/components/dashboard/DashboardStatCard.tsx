/**
 * 🛡️ 2026-04-22 배치 127: KPI / 통계 카드
 *
 * 🎨 2026-09-14 (대표 Rinda 시안 — docs/design/dashboard-rinda-2026-09.md §1):
 *   Rinda 통계 카드는 [작은 점 + 라벨] → [큰 숫자] → [작은 회색 설명] 세 줄이다. 그에 맞춰 둘을 걷어냈다:
 *     ① **하단 액센트 막대**(`absolute bottom-0 … h-0.5 bg-*-500`) — 카드 8장이면 무지개 줄 8개가
 *        깔렸다. 아무 정보도 없는데 화면에서 가장 채도가 높았다.
 *     ② **컬러 아이콘 칩**(`bg-blue-50 text-blue-600` 류) — 같은 이유. 아이콘은 남기되 회색으로,
 *        라벨 앞 **점**이 accent 를 대신한다(면적이 1/40 이라 색이 정보로만 남는다).
 *   `accent` prop 은 그대로 받는다 — 호출부 3곳을 건드리지 않기 위해서다. 뜻만 '칩 색' → '점 색'.
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

/** accent → 라벨 앞 점 색. 종전의 칩 배경 + 막대 두 벌을 이 한 값이 대신한다. */
const DOT: Record<NonNullable<DashboardStatCardProps['accent']>, string> = {
  blue: 'bg-brand',
  green: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  gray: 'bg-gray-300',
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
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[accent]}`} aria-hidden />
          <p className="truncate text-[12px] font-medium text-gray-500">{label}</p>
        </div>
        {icon && <span className="shrink-0 text-gray-300">{icon}</span>}
      </div>

      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="mt-1.5 text-[24px] font-extrabold leading-tight tracking-tight text-gray-900">{value}</p>
      )}

      {hint && <p className="mt-1 text-[12px] text-gray-400">{hint}</p>}
      {trend && (
        <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          <span>{trend.value >= 0 ? '▲' : '▼'}</span>
          <span>{Math.abs(trend.value)}%</span>
          {trend.label && <span className="font-normal text-gray-400">{trend.label}</span>}
        </div>
      )}
    </>
  )

  const base = 'relative block rounded-2xl border border-rule bg-white p-4'

  // to 지정 시 카드 전체를 Link 로 — 클릭 affordance(커서/hover) + 우상단 화살표 표시.
  if (to) {
    return (
      <Link to={to} className={`${base} group transition-colors hover:border-rule-strong`}>
        <span className="absolute bottom-2 right-3 text-[13px] text-gray-300 transition-colors group-hover:text-gray-600" aria-hidden>↗</span>
        {inner}
      </Link>
    )
  }
  return <div className={base}>{inner}</div>
}
