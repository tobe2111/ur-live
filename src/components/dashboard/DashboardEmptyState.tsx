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
    <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-50 dark:bg-white/[0.03] px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
