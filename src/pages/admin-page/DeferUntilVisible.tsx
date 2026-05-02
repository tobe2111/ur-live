/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminPage 의 IntersectionObserver 기반 지연 마운트 헬퍼.
 *   차트/피드 같은 무거운 위젯의 API 호출/렌더를 스크롤 진입 시점까지 지연.
 */
import { useEffect, useRef, useState } from 'react'

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
  return <div ref={ref}>{visible ? children : fallback}</div>
}
