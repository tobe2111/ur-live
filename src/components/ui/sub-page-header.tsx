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
import { useEffect, useState, type ReactNode } from 'react'
import { useSafeBack } from '@/hooks/useSafeBack'
import { ArrowLeft } from 'lucide-react'

/** 하위 화면 바탕 — 머리줄과 같은 톤이어야 머리줄이 떠 보이지 않는다. */
export const SUB_PAGE_CLS = 'min-h-[100dvh] bg-warm'

export const SUB_PAGE_HEADER_CLS = 'sticky top-0 md:top-14 z-40 bg-warm'

export default function SubPageHeader({ title, onBack, right, backLabel = '뒤로', wideSides = false, fallback = '/user/profile' }: {
  title: ReactNode
  /** 오른쪽에 글자 버튼('모두 읽음' 등)을 둘 때 — 양쪽 칸을 같이 넓혀 제목이 정중앙에 남는다. */
  wideSides?: boolean
  /** 기본은 브라우저 뒤로. 진입 기록이 없을 수 있는 화면은 목적지를 직접 준다. */
  onBack?: () => void
  /** 앱 안에 돌아갈 칸이 없을 때(링크로 바로 들어옴) ← 가 갈 곳. 하위 화면 대부분이 마이 아래라 기본은 마이. */
  fallback?: string
  right?: ReactNode
  backLabel?: string
}) {
  const goBack = useSafeBack(fallback)
  // 🎬 2026-11-03 21차 ③ (대표 승인) — 들어오면 제목이 아래에 **크게** 있고, 내리면 작아지며 머리줄 가운데로 올라간다.
  //   머리줄의 h1 은 그대로 하나다(읽기 프로그램용). 큰 제목은 그림일 뿐이라 aria-hidden.
  const [collapsed, setCollapsed] = useState(false)
  const [k, setK] = useState(0)
  useEffect(() => {
    let raf = 0
    const read = () => { raf = 0; const y = Math.max(0, window.scrollY); setK(Math.min(1, y / 44)); setCollapsed(y > 40) }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return (
    <>
    <header className={`${SUB_PAGE_HEADER_CLS} transition-shadow ${collapsed ? 'shadow-[0_1px_0_var(--rule)]' : ''}`}>
      <div className={`ur-content-narrow grid ${wideSides ? 'grid-cols-[88px_1fr_88px]' : 'grid-cols-[44px_1fr_44px]'} items-center h-[52px] px-1`}>
        <button
          type="button"
          onClick={onBack ?? goBack}
          aria-label={backLabel}
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-wash"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" strokeWidth={1.6} />
        </button>
        <h1 className={`text-center text-[17px] font-bold text-gray-900 dark:text-white truncate transition-[opacity,transform] duration-200 ${collapsed ? 'opacity-100' : 'opacity-0 translate-y-2'}`}>{title}</h1>
        <div className={`h-11 flex items-center ${wideSides ? 'justify-end pr-3' : 'w-11 justify-center'}`}>{right}</div>
      </div>
    </header>
    <div aria-hidden="true" className="ur-content-narrow px-4 pt-1 pb-3 overflow-hidden">
      <p
        className="origin-left text-[28px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white truncate"
        style={{ transform: `scale(${1 - k * 0.35}) translateY(${-k * 10}px)`, opacity: 1 - k }}
      >{title}</p>
    </div>
    </>
  )
}
