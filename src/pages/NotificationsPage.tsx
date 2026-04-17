import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Bell, Check } from 'lucide-react'
import api from '@/lib/api'

interface Notification {
  id: number; type: string; title: string; message?: string; link?: string
  is_read: number; created_at: string
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/social/notifications')
      .then(r => { if (r.data.success) setNotifications(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function markAllRead() {
    await api.put('/api/social/notifications/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO title="알림 - 유어딜" description="새로운 알림을 확인하세요" url="/notifications" />
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900">알림</h1>
          <button onClick={markAllRead} className="text-xs text-blue-600 font-medium">모두 읽음</button>
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-bold">알림이 없습니다</p>
            <p className="text-sm text-gray-500 mt-1">새로운 소식이 있으면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div>
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={async () => {
                  if (!n.is_read) {
                    await api.put(`/api/social/notifications/${n.id}/read`)
                    setNotifications(prev => prev.map(nn => nn.id === n.id ? { ...nn, is_read: 1 } : nn))
                  }
                  if (n.link) navigate(n.link)
                }}
                className={`w-full flex items-start gap-3 p-4 text-left border-b border-gray-100 ${n.is_read ? 'opacity-60' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  {n.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
