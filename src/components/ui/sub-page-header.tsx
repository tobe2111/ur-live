/**
 * ← 소비자 하위 화면 머리줄 한 벌 (2026-10-19 대표 *"모두 다 가장 이상적으로 개선해줘"*).
 *
 * 마이에서 들어가는 화면(찜·쿠폰·리뷰·숙소 예약·탈퇴)의 머리줄이 **네 가지 모양**이었다 —
 * 회색 원 안의 `<`, 맨 `←`, 왼쪽 제목, 가운데 제목, 흰 바탕과 회색 바탕이 화면마다 갈렸다.
 * 하나하나는 멀쩡해서 아무도 신고하지 않지만, 마이에서 줄을 누를 때마다 다른 앱으로 넘어간 것처럼 보인다.
 *
 * 규칙: 바탕은 페이지와 같은 `bg-warm` · 뒤로는 `←`(조작 아이콘이라 lucide — CLAUDE.md 아이콘 경계) ·
 * 제목은 가운데 17px · 오른쪽 칸은 같은 폭으로 비워 제목이 늘 정중앙에 선다.
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/** 하위 화면 바탕 — 머리줄과 같은 톤이어야 머리줄이 떠 보이지 않는다. */
export const SUB_PAGE_CLS = 'min-h-[100dvh] bg-warm'

export const SUB_PAGE_HEADER_CLS = 'sticky top-0 md:top-14 z-40 bg-warm'

export default function SubPageHeader({ title, onBack, right, backLabel = '뒤로', wideSides = false }: {
  title: ReactNode
  /** 오른쪽에 글자 버튼('모두 읽음' 등)을 둘 때 — 양쪽 칸을 같이 넓혀 제목이 정중앙에 남는다. */
  wideSides?: boolean
  /** 기본은 브라우저 뒤로. 진입 기록이 없을 수 있는 화면은 목적지를 직접 준다. */
  onBack?: () => void
  right?: ReactNode
  backLabel?: string
}) {
  const navigate = useNavigate()
  return (
    <header className={SUB_PAGE_HEADER_CLS}>
      <div className={`ur-content-narrow grid ${wideSides ? 'grid-cols-[88px_1fr_88px]' : 'grid-cols-[44px_1fr_44px]'} items-center h-[52px] px-1`}>
        <button
          type="button"
          onClick={onBack ?? (() => navigate(-1))}
          aria-label={backLabel}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-wash"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" strokeWidth={1.6} />
        </button>
        <h1 className="text-center text-[17px] font-bold text-gray-900 dark:text-white truncate">{title}</h1>
        <div className={`h-11 flex items-center ${wideSides ? 'justify-end pr-3' : 'w-11 justify-center'}`}>{right}</div>
      </div>
    </header>
  )
}
