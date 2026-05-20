import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check } from 'lucide-react'
import api from '@/lib/api'
import { isLoggedInSync } from '@/utils/auth'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { safeInternalPath } from '@/utils/safe-internal-path'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link?: string
  is_read: boolean
  created_at: string
}

interface NotificationBellProps {
  userType: 'seller' | 'user' | 'admin'
}

export default function NotificationBell({ userType }: NotificationBellProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorCount, setErrorCount] = useState(0) // 🔧 연속 에러 카운트
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 알림 조회
  async function loadNotifications() {
    // 🛡️ 2026-04-23 배치 175: 비로그인 상태에서 호출 시 401 → Sentry 스팸.
    //   로그인 여부 먼저 체크.
    if (!isLoggedInSync()) { setUnreadCount(0); setNotifications([]); return }
    try {
      setLoading(true)
      const response = await api.get('/api/notifications')
      
      if (response.data.success) {
        setNotifications(response.data.data || [])
        setUnreadCount(response.data.unread_count || 0)
        setErrorCount(0) // 🔧 성공 시 에러 카운트 리셋
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Notifications] Load error:', err)
      setErrorCount(prev => prev + 1) // 🔧 에러 카운트 증가
      
      // 🔧 3번 이상 연속 에러 시 polling 중지 (console에 경고)
      if (errorCount >= 2) {
        if (import.meta.env.DEV) console.warn('[Notifications] ⚠️ Too many errors, stopping auto-refresh')
      }
    } finally {
      setLoading(false)
    }
  }

  // 알림 읽음 처리
  async function markAsRead(notificationId: number) {
    try {
      await api.put(`/api/notifications/${notificationId}/read`)
      
      // 로컬 상태 업데이트
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Notifications] Mark as read error:', err)
    }
  }

  // 모두 읽음 처리
  async function markAllAsRead() {
    try {
      await api.put('/api/notifications/read-all')
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
      setUnreadCount(0)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Notifications] Mark all as read error:', err)
    }
  }

  // 알림 클릭
  function handleNotificationClick(notification: Notification) {
    // 읽음 처리
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    // 링크 이동 — 🛡️ open-redirect 방어: 내부 path 만 허용
    if (notification.link) {
      navigate(safeInternalPath(notification.link, '/'))
    }

    // 드롭다운 닫기
    setIsOpen(false)
  }

  // 초기 로드 + visibility 기반 즉시 갱신
  useEffect(() => {
    loadNotifications()
    const onVisible = () => { if (!document.hidden) loadNotifications() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // 30s 폴링 — hidden 탭 skip, 연속 에러 3회 시 중지
  useEffect(() => {
    if (errorCount >= 3) return
    const interval = setInterval(() => {
      if (!document.hidden) loadNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [errorCount])

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 시간 포맷
  function formatTime(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 벨 아이콘 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 (읽지 않음)` : '알림'}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 dark:border-[#2A2A2A] z-50">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2A2A2A]">
            <h3 className="text-lg font-semibold text-gray-900">알림</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  모두 읽음
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('common.close')}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                로딩 중...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                알림이 없습니다
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    w-full text-left px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A] hover:bg-gray-50 transition-colors
                    ${!notification.is_read ? 'bg-blue-50' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* 아이콘 */}
                    <div className={`
                      flex-shrink-0 w-2 h-2 mt-2 rounded-full
                      ${!notification.is_read ? 'bg-blue-500' : 'bg-gray-300'}
                    `} />

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <p className={`
                        text-sm font-medium truncate
                        ${!notification.is_read ? 'text-gray-900' : 'text-gray-600'}
                      `}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>

                    {/* 읽음 표시 */}
                    {notification.is_read && (
                      <Check className="flex-shrink-0 w-4 h-4 text-gray-400 mt-2" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 푸터 */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-[#2A2A2A] text-center">
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate(`/${userType}/notifications`)
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                모든 알림 보기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
