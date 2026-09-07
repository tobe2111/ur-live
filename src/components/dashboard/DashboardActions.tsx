/**
 * 🎛️ 대시보드 액션 체계 (2026-08-31 — 대표 *"버튼 배치가 중구난방이고 체계적이지 않다"*)
 *
 * ■ 무엇이 문제였나 (세어 본 값)
 *   셀러 62페이지 · 버튼 280개 · 버튼 체계(`.ur-btn`) 채택 **0개**.
 *   주 행동 색이 세 갈래(`bg-gray-900` 127 · `bg-black` 19 · `bg-brand` 20),
 *   모서리가 다섯 종(`lg` 331 · `xl` 233 · `2xl` 105 · `full` 104 · `md` 3).
 *   `SellerProductsPage` 가 그 축소판이었다 — 버튼 넷이
 *   [에메랄드 아웃라인][오렌지 아웃라인][검정 solid][검정 solid] 였다.
 *   ⓐ 에메랄드·오렌지는 **아무 뜻도 없다**(성공도 경고도 아니다)
 *   ⓑ **검정이 둘**이라 무엇이 주 행동인지 화면이 말하지 못한다.
 *
 * ■ 규칙 — 한 페이지에 주 행동은 **정확히 하나**
 *   primary   그 페이지가 존재하는 이유 (상품 등록 / 정산 신청)   잉크 solid   1개
 *   secondary 자주 쓰지만 주가 아닌 것 (빠른 공구)               테두리       0~2개
 *   overflow  가끔 쓰는 것 (대량등록·양식 다운로드·내보내기)      ⋯ 메뉴       1개
 *   danger    삭제·취소                                        빨강 텍스트   확인 뒤
 *
 *   색은 **뜻이 있을 때만** 쓴다. 장식으로 쓰면 진짜 신호(빨강=위험)가 안 보인다.
 *
 * ⚠️ 이 컴포넌트는 "무엇이 주 행동인가"를 정해 주지 않는다 — 그건 페이지가 정한다.
 *    다만 **둘 이상을 주 행동으로 둘 수 없게** 구조로 막는다(primary 는 단수 prop).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface OverflowItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
}

export default function DashboardActions({
  primary,
  secondary,
  overflow,
}: {
  /** 그 페이지가 존재하는 이유. **하나만** — 타입이 단수인 것이 규칙이다. */
  primary?: ReactNode
  /** 자주 쓰지만 주가 아닌 것. 0~2개. */
  secondary?: ReactNode
  /** 가끔 쓰는 것 — ⋯ 메뉴로 접는다. 화면에서 자리를 차지하지 않는다. */
  overflow?: OverflowItem[]
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasOverflow = !!overflow?.length
  if (!primary && !secondary && !hasOverflow) return null

  return (
    <div className="flex items-center gap-2">
      {secondary}
      {hasOverflow && (
        <div ref={boxRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="더 보기"
            className="ur-btn ur-btn-md ur-btn-icon border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-[10500] min-w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
            >
              {overflow.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); it.onClick() }}
                  className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-semibold transition-colors hover:bg-gray-50 ${
                    it.danger ? 'text-red-600' : 'text-gray-700'
                  }`}
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {primary}
    </div>
  )
}
