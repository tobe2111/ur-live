/**
 * 🎯 뷰포트 근처에 올 때만 자식을 mount — below-fold lazy 청크의 조기 로드 방지.
 *   (2026-08-26 `GroupBuyDetailPage` 에서 추출. 그 파일이 file-size 래칫 천장(992줄)이라,
 *    기능을 얹으려면 이런 자기완결 블록부터 뗀다. **동작은 byte-불변** — 옮기기만 했다.)
 *
 * ⚠️ 잠금 계약(CLAUDE.md 로딩 최적화): below-fold 섹션(지도/후기)은 lazy + 이 게이트를 **둘 다**
 *   거친다. 하나라도 빠지면 첫 paint 에 회색 Suspense 블록이 화면 밖에서 깜빡인다(2026-06-23 신고).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

// 🎯 2026-06-23 (대표 신고 — '불필요한 로딩들'): below-fold 섹션(지도/후기)의 lazy 청크가 첫 paint 에
//   즉시 로드돼 회색 Suspense 블록이 화면 밖에서 깜빡였음. 뷰포트 근처(300px)에 올 때만 mount → 그전엔
//   공간만 예약(중립, 로딩 표시 X). 스크롤해 도달하면 그때 로드(정상). RestaurantMiniMap 내부 SDK 게이트와 별개의 chunk 게이트.
export default function DeferUntilVisible({ minHeight, children }: { minHeight: number; children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])
  return <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>{visible ? children : null}</div>
}
