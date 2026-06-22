import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 🛡️ 2026-06-22 (함정 제거): flex 컨테이너 안의 스크롤 영역.
 *   `flex-1 min-h-0 overflow-y-auto` 를 내장 → **min-h-0 누락 함정**을 구조적으로 제거.
 *   (min-h-0 없으면 flex 자식이 콘텐츠보다 안 줄어듦 → 스크롤 불가 + 형제(footer/적용버튼)가 밀려
 *    화면 밖. 2026-06-22 동네딜 지도/필터 하단 잘림 사건.)
 *
 * 사용: 바텀시트/모달/패널 등 `flex flex-col` 부모 안에서 "남는 공간 채우며 스크롤"되는 영역.
 *   <div className="flex flex-col h-...">
 *     <Header/>            // shrink-0
 *     <ScrollArea>{list}</ScrollArea>
 *     <Footer/>            // shrink-0 — 항상 보임(스크롤은 ScrollArea 안에서만)
 *   </div>
 */
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 min-h-0 overflow-y-auto", className)}
    {...props}
  />
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
