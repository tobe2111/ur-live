import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * ↔️ PC 홈 섹션 줄 — 한 번에 네 장, 넘치면 좌우 화살표 (2026-10-14 대표 확정 "시안 6").
 *   시안은 다섯 장이었지만 섹션 상품 수는 어드민 값(`limit_count`, 기본 4)이라 다섯 칸이면 한 칸이 빈다.
 *   네 칸이면 아래 목록(4열)과 열이 맞는다. 어드민이 늘리면 화살표가 생긴다.
 *
 * 모바일은 같은 섹션을 2·3·4열 그리드로 그린다(`HomeSections` 기본). PC 에서만 이 줄을 쓴다 —
 * 마우스에는 가로 스와이프가 없어 화살표가 있어야 다음 장을 볼 수 있다(2026-10-13 배너에서 정한 규칙).
 * 화살표는 넘칠 때(다섯 장 이상)만 보인다 — 다 보이는데 화살표가 있으면 눌러도 아무 일이 없다.
 */
export default function SectionRail({ count, children }: { count: number; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const page = (d: number) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: d * el.clientWidth, behavior: 'smooth' })
  }
  return (
    <div className="relative">
      <div ref={scroller} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain scrollbar-hide [&>*]:snap-start [&>*]:shrink-0 [&>*]:w-[calc((100%-48px)/4)]">
        {children}
      </div>
      {count > 4 && (
        <>
          <button type="button" onClick={() => page(-1)} aria-label="이전"
            className="absolute -left-5 top-[36%] -translate-y-1/2 z-[3] w-10 h-10 rounded-full bg-surface text-gray-900 dark:text-white flex items-center justify-center shadow-lift">
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => page(1)} aria-label="다음"
            className="absolute -right-5 top-[36%] -translate-y-1/2 z-[3] w-10 h-10 rounded-full bg-surface text-gray-900 dark:text-white flex items-center justify-center shadow-lift">
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
