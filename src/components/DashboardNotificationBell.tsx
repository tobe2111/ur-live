import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import api from '@/lib/api'
import { useTranslation } from 'react-i18next'

interface Notification {
  id: number
  type: string
  title: string
  message: string | null
  link: string | null
  is_read: number
  created_at: string
}

interface Props {
  tokenKey: 'admin_token' | 'seller_token' | 'agency_token'
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr + 'Z').getTime()
  const diff = Math.max(0, now - then)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function DashboardNotificationBell({ tokenKey }: Props) {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 지수 백오프 — 연속 실패 시 폴링 간격을 30s → 60s → 120s → 240s 최대로 증가
  // 성공하면 즉시 30s 로 복귀. 백엔드 장애 시 클라이언트 대량 호출로 인한 D1 quota 소진 방지.
  const fetchNotifications = useCallback(async (): Promise<boolean> => {
    if (!localStorage.getItem(tokenKey)) return true
    try {
      const res = await api.get('/api/dashboard-notifications?unread_only=false&limit=10')
      if (res.data?.notifications) {
        setNotifications(res.data.notifications)
        setUnreadCount(res.data.unread_count || 0)
      }
      return true
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[DashboardBell] fetch failed:', e)
      return false
    }
  }, [tokenKey])

  useEffect(() => {
    let cancelled = false
    let currentInterval = 30_000
    const BASE = 30_000
    const MAX = 240_000
    let timerId: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      if (cancelled) return
      timerId = setTimeout(async () => {
        if (cancelled) return
        if (!document.hidden) {
          const ok = await fetchNotifications()
          currentInterval = ok ? BASE : Math.min(currentInterval * 2, MAX)
        }
        scheduleNext()
      }, currentInterval)
    }

    fetchNotifications().then(ok => { if (!ok) currentInterval = 60_000 })
    scheduleNext()

    const onVisible = () => {
      if (!document.hidden) {
        fetchNotifications().then(ok => { if (ok) currentInterval = BASE })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    if (!localStorage.getItem(tokenKey)) return
    try {
      await api.put('/api/dashboard-notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  async function markRead(id: number) {
    if (!localStorage.getItem(tokenKey)) return
    try {
      await api.put(`/api/dashboard-notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  function handleNotificationClick(n: Notification) {
    if (!n.is_read) markRead(n.id)
    if (n.link) {
      // 🛡️ 2026-04-22: open redirect 방어 — 내부 경로만 허용
      // 알림 생성자가 악의적으로 외부 URL 을 넣어도 차단. scheme-relative (//evil.com) 도 차단.
      const link = String(n.link).trim()
      const isInternalPath = link.startsWith('/') && !link.startsWith('//') && !link.includes('\n') && !link.includes('\t')
      if (isInternalPath) {
        window.location.href = link
      } else {
        // dev 환경에서만 경고
        if (import.meta.env.DEV) console.warn('[Notification] blocked external link:', link)
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 있음` : '알림 열기'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden" role="dialog" aria-label={t('notifications.listAria', { defaultValue: '알림 목록' })}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                알림이 없습니다
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNotificationClick(n)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.title}${n.message ? ' — ' + n.message : ''} (${timeAgo(n.created_at)})${!n.is_read ? ' — 읽지 않음' : ''}`}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset transition-colors ${
                    !n.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
