import { useEffect, useRef, useState } from 'react'

/**
 * 자식을 뷰포트에 들어왔을 때만 마운트 (IntersectionObserver).
 */
export default function DeferUntilVisible({ children, fallback, rootMargin = '200px' }: { children: React.ReactNode; fallback: React.ReactNode; rootMargin?: string }) {
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
  return <div ref={ref} style={{ width: '100%', height: '100%' }}>{visible ? children : fallback}</div>
}
