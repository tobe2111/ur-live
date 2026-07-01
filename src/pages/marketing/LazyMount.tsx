import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 🆕 2026-06-30 유어애즈 — 뷰포트 진입 시 마운트(off-screen 패널 지연 로드).
 *   대시보드 패널 다수가 각자 마운트 시 외부 API 를 호출 → 진입 즉시 동시 다발 fetch.
 *   화면 밖 패널을 IntersectionObserver 로 근접 시에만 마운트해 초기 부하/쿼터 절감.
 *   앵커 id 는 항상 렌더(네비 스크롤·스크롤스파이가 로드 전에도 대상 찾도록). rootMargin 200px.
 */
export default function LazyMount({ id, children, minHeight = 160 }: { id?: string; children: ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return } // SSR/미지원 → 즉시
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  return (
    <section id={id} ref={ref} style={{ scrollMarginTop: 76, ...(shown ? null : { minHeight }) }}>
      {shown ? children : <div className="mt-3 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" style={{ height: minHeight }} />}
    </section>
  )
}
