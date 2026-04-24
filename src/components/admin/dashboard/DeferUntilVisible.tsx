import { useEffect, useState, useRef } from 'react'

// Inline skeleton placeholder
export const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

/**
 * 자식을 뷰포트에 들어왔을 때만 마운트 (IntersectionObserver).
 * 차트/피드 같은 무거운 위젯의 API 호출/렌더를 스크롤 진입 시점까지 지연.
 */
export function DeferUntilVisible({ children, fallback, rootMargin = '200px' }: { children: React.ReactNode; fallback: React.ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (visible) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, rootMargin])
  return <div ref={ref}>{visible ? children : fallback}</div>
}

export function ChartSkeleton({ title }: { title: string }) {
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
