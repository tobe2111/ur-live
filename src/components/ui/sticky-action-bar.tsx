import * as React from "react"

import { cn } from "@/lib/utils"

// SSR-safe layout effect — 프리렌더 트리에 들어가도 경고 없이, 클라에선 페인트 전 측정(깜빡임 0).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

interface StickyActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * spacer + bar 양쪽에 함께 적용할 반응형/가시성 클래스 (예: "lg:hidden").
   * 데스크톱 인라인 CTA 가 따로 있으면 "lg:hidden" 으로 모바일만 — spacer 도 같이 숨겨 데스크톱 여백 0.
   */
  responsiveClassName?: string
}

/**
 * 🛡️ 2026-06-27 (함정 제거): 하단 고정 CTA 바 + **자동 spacer**.
 *
 *   `position:fixed bottom-0` 바를 두고 본문에 `pb-28` 같은 **고정 숫자 여백**을 손으로 맞추면,
 *   바 높이(수량줄·버튼·iOS safe-area)가 바뀔 때마다 여백과 어긋나 본문 하단이 바에 가려
 *   끝까지 스크롤되지 않는다 (2026-06-27 `/wholesale/product/:id` 모바일 하단 잘림 사건).
 *
 *   이 컴포넌트는 바 높이를 ResizeObserver 로 측정해 **정확히 같은 높이의 in-flow spacer** 를
 *   함께 렌더한다 → 여백이 구조적으로 절대 드리프트할 수 없다(safe-area 포함 자동 반영).
 *
 * 사용: 스크롤 본문의 **맨 끝**에 배치.
 *   <Screen>                              // min-h-[100dvh] (pb-NN 불필요)
 *     …content…
 *     <StickyActionBar responsiveClassName="lg:hidden" className="bg-white border-t px-5 pt-2.5">
 *       <button>주문</button>
 *     </StickyActionBar>
 *   </Screen>
 */
function StickyActionBar({
  className,
  responsiveClassName,
  style,
  children,
  ...props
}: StickyActionBarProps) {
  const barRef = React.useRef<HTMLDivElement>(null)
  const [h, setH] = React.useState(0)

  useIsoLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = () => setH(el.offsetHeight)
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    }
    // 브레이크포인트 교차(예: lg:hidden 토글)는 size 변화로 RO 가 못 잡을 수 있어 backstop.
    window.addEventListener("resize", measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  return (
    <>
      {/* in-flow spacer = 측정된 바 높이(safe-area 포함). 데스크톱(lg:hidden)이면 함께 숨어 여백 0. */}
      <div aria-hidden className={responsiveClassName} style={{ height: h }} />
      <div
        ref={barRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40",
          responsiveClassName,
          className,
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))", ...style }}
        {...props}
      >
        {children}
      </div>
    </>
  )
}
StickyActionBar.displayName = "StickyActionBar"

export { StickyActionBar }
