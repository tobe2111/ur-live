import * as React from "react"

import { cn } from "@/lib/utils"

interface ScreenProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * true  = 고정 높이 `h-[100dvh]` (풀스크린 앱 레이아웃 — 지도처럼 내부가 absolute/bottom-0).
   * false = `min-h-[100dvh]` (기본 — 스크롤되는 일반 페이지 루트).
   */
  fixed?: boolean
}

/**
 * 🛡️ 2026-06-22 (함정 제거): 모바일 안전 풀높이 컨테이너.
 *   `h-screen`/`min-h-screen`(=100vh) 대신 **100dvh** 를 내장 → 모바일 100vh(주소창 포함)가
 *   실제 화면보다 커서 `bottom-0` 콘텐츠가 잘리던 함정을 구조적으로 제거.
 *   풀스크린/고정바 페이지 루트에 `<Screen>` / `<Screen fixed>` 로 사용.
 */
const Screen = React.forwardRef<HTMLDivElement, ScreenProps>(
  ({ className, fixed = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(fixed ? "h-[100dvh]" : "min-h-[100dvh]", className)}
      {...props}
    />
  )
)
Screen.displayName = "Screen"

export { Screen }
