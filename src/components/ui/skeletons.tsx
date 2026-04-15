/**
 * 공통 스켈레톤 로딩 컴포넌트
 */

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function GridSkeleton({ cols = 2, count = 4 }: { cols?: number; count?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <GridSkeleton />
      <CardSkeleton />
    </div>
  )
}
