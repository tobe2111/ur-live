import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import api from '@/lib/api'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ChevronLeft, Bell } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/queries/useNotifications'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query. 읽음 처리 시 벨 배지(unreadCount) 자동 갱신.
  const { data: firstPage = [], isLoading: loading, isError } = useNotifications()
  // 🏁 2026-06-12 (감사 🟢 — 50개 고정): '더 보기' 페이지네이션. 첫 페이지는 기존 RQ 훅
  //   (캐시/벨 동기 보존), 추가분만 로컬 append — 훅/캐시 동작 불변(additive).
  const [extra, setExtra] = useState<typeof firstPage>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const notifications = [...firstPage, ...extra.filter(e => !firstPage.some(f => f.id === e.id))]
  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const r = await api.get(`/api/social/notifications?limit=50&offset=${notifications.length}`)
      const rows = (r.data?.data || []) as typeof firstPage
      setExtra(prev => [...prev, ...rows])
      setHasMore(Boolean(r.data?.has_more) && rows.length > 0)
    } catch { setHasMore(false) } finally { setLoadingMore(false) }
  }
  const markAllMut = useMarkAllNotificationsRead()
  const markReadMut = useMarkNotificationRead()
  const error = isError ? t('notifications.loadError') : ''

  function markAllRead() {
    markAllMut.mutate(undefined, {
      onError: () => toast.error(t('notifications.markAllReadFailed', { defaultValue: '읽음 처리에 실패했습니다' })),
    })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-safe-nav md:pb-20">
      <SEO title={t('notifications.seoTitle', { defaultValue: '알림 - 유어딜' })} description={t('notifications.seoDesc', { defaultValue: '새로운 알림을 확인하세요' })} url="/notifications" noindex />
      {/* Header */}
      <div className="sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-5 lg:px-8 py-3">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('notifications.back')} className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <h1 className="text-gray-900 dark:text-white font-bold text-[15px]">{t('notifications.title')}</h1>
          <button type="button" onClick={markAllRead} className="text-xs text-pink-400 font-medium">{t('notifications.markAllRead')}</button>
        </div>
      </div>

      <div className="ur-content-narrow px-4 lg:px-8 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 text-gray-600 dark:text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-900 dark:text-white font-bold">{error}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('notifications.retryLater')}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 text-gray-600 dark:text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-900 dark:text-white font-bold">{t('notifications.empty')}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('notifications.emptyDesc')}</p>
          </div>
        ) : (
          <div>
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markReadMut.mutate(n.id)
                  if (n.link) navigate(safeInternalPath(n.link, '/'))
                }}
                className={`w-full flex items-start gap-3 p-4 text-left border-b border-gray-100 dark:border-[#1A1A1A] ${n.is_read ? 'opacity-50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-pink-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</p>
                  {n.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                    {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </button>
            ))}
            {hasMore && notifications.length >= 50 && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full py-3.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">
                {loadingMore ? t('common.loading', { defaultValue: '불러오는 중…' }) : t('notifications.loadMore', { defaultValue: '더 보기' })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
