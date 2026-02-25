import React, { useState, useEffect } from 'react'
import { Bell, X, Check } from 'lucide-react'
import api from '@/lib/api'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link_url?: string
  is_read: number
  created_at: string
}

interface NotificationDropdownProps {
  userId: string
}

/**
 * KREAM-style Notification Dropdown
 * 
 * Clean, minimal design with:
 * - Unread badge on bell icon
 * - Dropdown with smooth animation
 * - Card-based notification items
 * - Mark as read on click
 * - Empty state illustration
 */
export default function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen && userId) {
      loadNotifications()
    }
  }, [isOpen, userId])

  // Load notifications on mount (for badge count)
  useEffect(() => {
    if (userId) {
      loadNotifications()
    }
  }, [userId])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/notifications?userId=${userId}&limit=20`)
      
      if (response.data.success) {
        setNotifications(response.data.data.notifications || [])
        setUnreadCount(response.data.data.unread_count || 0)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: number) => {
    try {
      await api.patch(`/api/notifications/${notificationId}/read`, { userId })
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: 1 } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notifications/read-all', { userId })
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const deleteNotification = async (notificationId: number) => {
    try {
      await api.delete(`/api/notifications/${notificationId}?userId=${userId}`)
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (notifications.find(n => n.id === notificationId && n.is_read === 0)) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.is_read === 0) {
      markAsRead(notification.id)
    }
    
    if (notification.link_url) {
      window.location.href = notification.link_url
    }
    
    setIsOpen(false)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return '방금 전'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="알림"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 top-12 z-50 w-96 max-h-[600px] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 animate-slide-down">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">알림</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  모두 읽음
                </button>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[500px]">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                // Empty State
                <div className="py-16 px-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <Bell className="w-16 h-16 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium mb-1">알림이 없습니다</p>
                  <p className="text-sm text-gray-400">새로운 알림이 오면 여기에 표시됩니다</p>
                </div>
              ) : (
                // Notification List
                <div className="divide-y divide-gray-100">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer relative ${
                        notification.is_read === 0 ? 'bg-blue-50/30' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Unread Indicator */}
                      {notification.is_read === 0 && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full" />
                      )}

                      {/* Content */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {notification.message}
                          </p>
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                          className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
                          aria-label="삭제"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer (optional) */}
            {notifications.length > 0 && (
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-3 text-center">
                <button
                  onClick={() => {
                    window.location.href = '/notifications'
                    setIsOpen(false)
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  모든 알림 보기
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
