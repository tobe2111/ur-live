import { useEffect, useRef } from 'react'

/**
 * 🎬 2026-11-02 13차 ⑦ — 유어샵 진열대: **스크롤로 들어오는 줄만** 아래에서 살짝 떠오른다.
 *
 * 처음 열었을 때 이미 보이는 줄은 손대지 않는다 — 서버가 첫 화면(`curator-ssr-body`)을 그려 두므로,
 * 그 줄을 지웠다 다시 띄우면 첫 화면이 늦어 보이고 밀림 검사에도 걸린다.
 * CSS 0(Web Animations) · 동작 줄이기면 아무것도 안 한다 · 한 줄은 한 번만.
 * `deps` 가 바뀌면(분류·정렬·검색) 새로 그려진 줄을 다시 지켜본다.
 */
export function useRevealRows<T extends HTMLElement>(deps: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const box = ref.current
    if (!box || typeof IntersectionObserver === 'undefined') return
    try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { return }
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver((entries) => {
      let k = 0
      for (const e of entries) {
        const el = e.target as HTMLElement
        if (!seen.has(el)) { seen.add(el); if (e.isIntersecting) { io.unobserve(el); continue } }
        if (!e.isIntersecting || e.boundingClientRect.top <= 0) continue
        io.unobserve(el)
        el.animate?.([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
          { duration: 380, delay: Math.min(k++, 5) * 60, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' })
      }
    }, { threshold: 0.12 })
    for (const c of Array.from(box.children)) io.observe(c)
    return () => io.disconnect()
  }, [deps])
  return ref
}
