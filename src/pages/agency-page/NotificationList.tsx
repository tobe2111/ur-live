/**
 * 🛡️ 2026-05-02: TD-018 분할 — AgencyPage 알림 목록 (최대 5건).
 */
import { useTranslation } from 'react-i18next'
import { useApiQuery } from '@/hooks/queries/useApiQuery'

interface NotificationRow {
  title: string
  created_at: string
}

export default function NotificationList() {
  const { t } = useTranslation()
  // 🛡️ 2026-05-31: 수동 fetch → useApiQuery (RQ). 인증=인터셉터 자동(agency_token).
  const { data: notifs = [] } = useApiQuery<NotificationRow[]>(
    ['agency', 'notifications'],
    '/api/agency/notifications',
    { select: (raw) => ((raw as { success?: boolean; data?: NotificationRow[] })?.success ? ((raw as { data: NotificationRow[] }).data || []).slice(0, 5) : []) },
  )
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
