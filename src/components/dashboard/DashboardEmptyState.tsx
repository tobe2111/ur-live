/**
 * 🛡️ 2026-04-22 배치 127: 빈 상태 컴포넌트
 *
 * 🧹 2026-08-31: `border-2 border-dashed` 제거. 점선은 "여기 뭔가 들어올 자리"라는 뜻인데
 *   바로 안의 문구가 이미 그 말을 하고 있었다 — **같은 말을 두 번**. 그리고 점선 테두리는
 *   화면을 미완성으로 읽히게 한다(대표: "AI가 만든 티"). 실선 없이 톤 차이로만 구분한다.
 */
import type { ReactNode } from 'react'

interface DashboardEmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function DashboardEmptyState({ icon, title, description, action }: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--dash-radius,16px)] bg-gray-50 px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-300">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
