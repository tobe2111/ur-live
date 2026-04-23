/**
 * 🛡️ 2026-04-22 배치 127: 로딩 상태 (스켈레톤 + 스피너)
 */
import { Loader2 } from 'lucide-react'

interface DashboardLoadingProps {
  text?: string
  variant?: 'spinner' | 'skeleton'
  rows?: number
}

export default function DashboardLoading({ text = '불러오는 중...', variant = 'spinner', rows = 3 }: DashboardLoadingProps) {
  if (variant === 'skeleton') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-xs">{text}</p>
    </div>
  )
}
