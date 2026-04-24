import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'

export function NotificationList() {
  const { t } = useTranslation()
  const [notifs, setNotifs] = useState<any[]>([])
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }
  useEffect(() => {
    api.get('/api/agency/notifications', { headers })
      .then(r => { if (r.data.success) setNotifs((r.data.data || []).slice(0, 5)) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])
  if (notifs.length === 0) return <p className="text-xs text-gray-400">{t('agency.noNewNotifications')}</p>
  return (
    <div className="space-y-1.5">
      {notifs.map((n, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 shrink-0" />
          <div>
            <p className="text-gray-700 font-medium">{n.title}</p>
            <p className="text-gray-400">{new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
