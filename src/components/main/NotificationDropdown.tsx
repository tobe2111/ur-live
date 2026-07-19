/**
 * 🖥️ 2026-07-18 (대표 요청 — "PC에서 알림 버튼 누르면 바로 보이게"): PC 상단 네비의 알림 벨을
 *   `/notifications` 페이지로 이동시키지 않고, 그 자리에서 드롭다운 패널로 알림 목록을 바로 표시.
 *   모바일은 기존대로 페이지 이동(HomeTopHeader/BottomNav) — 이 컴포넌트는 DesktopTopNav 전용.
 *
 * - 목록 fetch 는 드롭다운이 열릴 때만(이 컴포넌트가 open 시에만 마운트) → 상시 폴링 낭비 0.
 * - 항목 클릭 = 읽음 처리 + 링크 이동 + 닫기. '모두 읽음' + '전체 보기(→ /notifications)' 제공.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/queries/useNotifications'
import { safeInternalPath } from '@/utils/safe-internal-path'

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface Props {
  onClose: () => void
}

export default function NotificationDropdown({ onClose }: Props) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const { data: items = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

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

  const hasUnread = items.some((n) => !n.is_read)

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[360px] max-w-[92vw] rounded-2xl bg-white dark:bg-[#0F0F0F] border border-gray-100 dark:border-[#2A3446] shadow-[0_12px_40px_rgba(0,0,0,0.16)] overflow-hidden z-[10001]"
      role="dialog"
      aria-label="알림"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2A3446]">
        <h3 className="text-[14px] font-extrabold text-gray-900 dark:text-white">알림</h3>
        {hasUnread && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Check className="w-3.5 h-3.5" /> 모두 읽음
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="max-h-[420px] overflow-y-auto">
        {isLoading && items.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-gray-400 dark:text-gray-500">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
            <Bell className="w-8 h-8 opacity-40" />
            <p className="text-[13px]">새 알림이 없어요</p>
          </div>
        ) : (
          items.slice(0, 20).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.is_read) markRead.mutate(n.id)
                if (n.link) navigate(safeInternalPath(n.link, '/'))
                onClose()
              }}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 dark:border-[#151515] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${n.is_read ? 'opacity-60' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-pink-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                {n.message && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.message}</p>
                )}
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{timeLabel(n.created_at)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 전체 보기 */}
      <button
        type="button"
        onClick={() => { navigate('/notifications'); onClose() }}
        className="w-full py-3 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.03] border-t border-gray-100 dark:border-[#2A3446]"
      >
        전체 보기 →
      </button>
    </div>
  )
}
