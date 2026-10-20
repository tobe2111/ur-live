/**
 * 🖥️ 2026-07-18 (대표 요청 — "PC에서 알림 버튼 누르면 바로 보이게"): PC 상단 네비의 알림 벨을
 *   `/notifications` 페이지로 이동시키지 않고, 그 자리에서 드롭다운 패널로 알림 목록을 바로 표시.
 *
 * 🔁 2026-10-11 — **몸통을 `components/notifications/NotificationPanel` 로 옮겼다.**
 *   대표 지시로 모바일에도 같은 패널(시트)이 생기면서, 목록이 세 벌이 될 참이었다. 실제로 PC 와
 *   페이지는 이미 갈려 있었다(시각 표기 `3시간 전` ↔ `10월 9일 14:03`). 이 파일에 남은 것은
 *   **어디에 뜨는가**(위치·바깥 클릭)뿐이고, 무엇을 그리는가는 공유 패널이 정한다.
 *
 * - 목록 fetch 는 드롭다운이 열릴 때만(이 컴포넌트가 open 시에만 마운트) → 상시 폴링 낭비 0.
 * - 항목 클릭 = 읽음 처리 + 링크 이동 + 닫기. '모두 읽음' + '전체 보기(→ /notifications)' 제공.
 */
import { useEffect, useRef } from 'react'
import {
  NotificationPanelBody,
  NotificationPanelFooter,
  NotificationPanelHeader,
} from '@/components/notifications/NotificationPanel'

interface Props {
  onClose: () => void
}

export default function NotificationDropdown({ onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // 다음 틱에 등록 — 벨 클릭 이벤트가 바로 닫아버리는 것 방지
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[360px] max-w-[92vw] rounded-2xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.16)] overflow-hidden z-[10001]"
      role="dialog"
      aria-label="알림"
    >
      <NotificationPanelHeader />
      <div className="max-h-[420px] overflow-y-auto">
        <NotificationPanelBody onClose={onClose} />
      </div>
      <NotificationPanelFooter onClose={onClose} />
    </div>
  )
}
