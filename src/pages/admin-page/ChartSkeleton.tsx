/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminPage 차트 자리 placeholder.
 */

const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

export default function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-2" style={{ minHeight: 160 }}>
        <Skel className="h-4 w-2/3" />
        <Skel className="h-4 w-5/6" />
        <Skel className="h-4 w-1/2" />
        <Skel className="h-4 w-3/4" />
        <Skel className="h-4 w-2/3" />
      </div>
    </div>
  )
}
