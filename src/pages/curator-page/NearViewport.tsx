import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 📦 사람이 화면을 움직인 뒤 그 자리가 화면 근처(아래 120px 안)에 오면 자식을 그린다 — 2026-11-03 유어샵 SNS 최근 게시물.
 *   첫 화면에 지연 부품을 그냥 두면 그 코드 파일을 **첫 화면에서** 받는다(유어샵 26 → 27, CI 래칫 빨간불).
 *   🩸 처음엔 "근처에 오면" 만 봤는데, 진열 바로 아래라 키 큰 화면(측정기 1200px)에선 처음부터 보여서
 *   여전히 첫 화면에 실렸다 ⇒ **첫 스크롤·터치 뒤에만** 지켜본다. 진열 아래의 덤이라 그때 받아도 늦지 않다.
 *   IntersectionObserver 가 없는 환경(구형·시험)은 바로 그린다.
 */
export default function NearViewport({ children }: { children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (near || armed) return
    const arm = () => setArmed(true)
    const opts = { passive: true, once: true } as const
    window.addEventListener('scroll', arm, opts)
    window.addEventListener('touchstart', arm, opts)
    window.addEventListener('wheel', arm, opts)
    return () => {
      window.removeEventListener('scroll', arm)
      window.removeEventListener('touchstart', arm)
      window.removeEventListener('wheel', arm)
    }
  }, [near, armed])
  useEffect(() => {
    if (near || !armed || !ref.current) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '120px 0px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [near, armed])
  return near ? <>{children()}</> : <div ref={ref} aria-hidden="true" />
}
