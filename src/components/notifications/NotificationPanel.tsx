/**
 * 🔔 알림 패널 — **PC 드롭다운과 모바일 시트가 같은 몸통을 쓴다** (2026-10-11).
 *
 * 대표: *"알림 버튼을 눌렀을 때 알림 페이지가 별도로 나오는게 아니라 위에서 올라오는 형태로?
 * 나타나면 좋을 것 같고"* — PC 는 2026-07-18 에 이미 그 자리에서 열리게 바꿨는데(`NotificationDropdown`,
 * 대표 *"PC에서 알림 버튼 누르면 바로 보이게"*) **모바일만 페이지로 보내고 있었다.**
 *
 * ## 왜 몸통을 나눴나
 * 고치기 전엔 같은 목록이 **세 벌**이었다 — `/notifications` 페이지 · PC 드롭다운 · (이번에 만들
 * 모바일 시트). 세 벌이면 반드시 갈린다. 실제로 이미 갈려 있었다:
 *   · 시각 표기 — 페이지는 `10월 9일 14:03`, 드롭다운은 `3시간 전`
 *   · 못 불러왔을 때 — 드롭다운만 "불러오지 못했어요" 를 따로 말한다(페이지는 큰 빈 화면)
 * ⇒ **목록·행·빈 화면·오류·"모두 읽음"·"전체 보기" 는 전부 여기 한 곳**이고, 바깥 셸(드롭다운/시트)은
 *   *어디에 뜨는가*만 정한다. `/notifications` 페이지는 그대로 남는다 — 거긴 **50개 이상 더 보기**
 *   (페이지네이션)와 딥링크가 있어 패널과 역할이 다르다.
 *
 * ## ⚠️ 이 패널은 더 받지 않는다
 * `useNotifications()` 가 돌려주는 첫 페이지만 그린다. 더 보려면 `전체 보기 →`. 패널에서
 * 무한스크롤을 하면 페이지와 같은 것이 둘이 되고, 그러면 또 갈린다.
 */
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { BellIcon } from '@/components/icons/urdeal-icons'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/queries/useNotifications'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { parseUTCDate } from '@/utils/date'

/**
 * ⏱️ "방금 / 12분 전 / 3시간 전" — **상대 시각 SSOT**.
 * 🩸 `parseUTCDate` 를 꼭 거친다: D1 의 `created_at` 은 `Z` 없는 UTC 문자열이라 `new Date()` 로
 *   읽으면 브라우저가 로컬로 오해해 **방금 온 알림이 '9시간 전'** 이 된다(CLAUDE.md 의 그 룰).
 */
export function timeLabel(iso: string): string {
  const d = parseUTCDate(iso)
  if (isNaN(d.getTime())) return ''
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

/** 패널 최대 표시 개수 — 그 이상은 `전체 보기` 가 맡는다. */
export const PANEL_MAX = 20

export function NotificationPanelHeader({ onClose, title = '알림', closeLabel = '닫기' }: {
  onClose?: () => void
  title?: string
  closeLabel?: string
}) {
  const { data: items = [] } = useNotifications()
  const markAll = useMarkAllNotificationsRead()
  const hasUnread = items.some((n) => !n.is_read)
  return (
    <div className="flex items-center justify-between px-4 h-14 border-b border-rule shrink-0">
      <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">{title}</h3>
      <div className="flex items-center gap-1">
        {hasUnread && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" /> 모두 읽음
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label={closeLabel} className="w-9 h-9 -mr-2 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
    </div>
  )
}

/** 목록 몸통 — 로딩·오류·빈 화면·행. 높이는 바깥 셸이 정한다. */
export function NotificationPanelBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { data: items = [], isLoading, isError } = useNotifications()
  const markRead = useMarkNotificationRead()

  if (isLoading && items.length === 0) {
    return <div className="py-12 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</div>
  }
  /* 🩸 2026-09-15: 못 불러온 것을 "새 알림이 없어요" 로 말하지 않는다 — 놓친 알림이 있는데
     없다고 하면 사용자는 다시 안 열어 본다. */
  if (isError) {
    return (
      <div className="py-12 flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
        <BellIcon className="w-8 h-8 opacity-40" aria-hidden="true" />
        <p className="text-[13px]">알림을 불러오지 못했어요</p>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
        <BellIcon className="w-8 h-8 opacity-40" aria-hidden="true" />
        <p className="text-[13px]">새 알림이 없어요</p>
      </div>
    )
  }
  return (
    <>
      {items.slice(0, PANEL_MAX).map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => {
            if (!n.is_read) markRead.mutate(n.id)
            if (n.link) navigate(safeInternalPath(n.link, '/'))
            onClose()
          }}
          className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-rule hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${n.is_read ? 'opacity-60' : ''}`}
        >
          <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-brand'}`} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-gray-900 dark:text-white truncate">{n.title}</span>
            {n.message && <span className="block text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{n.message}</span>}
            <span className="block text-[12px] text-gray-500 dark:text-gray-500 mt-1">{timeLabel(n.created_at)}</span>
          </span>
        </button>
      ))}
    </>
  )
}

/** 바닥 — 전체 목록(페이지네이션·딥링크)으로 가는 유일한 문. */
export function NotificationPanelFooter({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => { navigate('/notifications'); onClose() }}
      className="w-full py-3 text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.03] border-t border-rule shrink-0"
    >
      전체 보기 →
    </button>
  )
}
