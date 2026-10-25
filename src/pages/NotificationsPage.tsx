import { useNavigate } from 'react-router-dom'
import { BellIcon } from '@/components/icons/urdeal-icons'
import { useState } from 'react'
import { safeDate } from '@/utils/safe-date'
import api from '@/lib/api'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import Udal from '@/components/mascot/Udal'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'
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

  // 🛡️ 2026-07-03: min-h-screen(100vh) → min-h-[100dvh] — 인앱/웹뷰 하단 네비 실종 방지(룰 #8, /vouchers 와 동일).
  return (
    <div className={`${SUB_PAGE_CLS} pb-safe-nav md:pb-20`}>
      <SEO title={t('notifications.seoTitle', { defaultValue: '알림 - 유어딜' })} description={t('notifications.seoDesc', { defaultValue: '새로운 알림을 확인하세요' })} url="/notifications" noindex />
      {/* ← 2026-10-19: 마이 하위 화면 공용 머리줄. '모두 읽음' 은 안 읽은 게 있을 때만(누를 것이 없으면 안 선다). */}
      <SubPageHeader
        title={t('notifications.title')}
        backLabel={t('notifications.back')}
        wideSides
        right={notifications.some(n => !n.is_read) ? (
          <button type="button" onClick={markAllRead} className="text-[13px] font-medium text-brand-text whitespace-nowrap">{t('notifications.markAllRead')}</button>
        ) : null}
      />

      <div className="ur-content-narrow px-4 lg:px-8 py-2">
        {loading ? (
          <BrandLoader />
        ) : error ? (
          <div className="text-center py-20">
            <BellIcon className="w-12 h-12 text-gray-600 dark:text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-900 dark:text-white font-bold">{error}</p>
            <p className="text-[15px] text-gray-600 dark:text-gray-400 mt-1">{t('notifications.retryLater')}</p>
          </div>
        ) : notifications.length === 0 ? (
          // 🦦 2026-10-09 (대표 확정 시안 ⑤-a "모두 해줘"): 빈 알림함 = 갸웃하는 유달이 + 할 일 하나.
          //   종 아이콘은 "알림이 없다" 만 말하고 끝났다 — 무엇을 하면 소식이 오는지와 그 입구를 준다.
          <div className="text-center py-16 px-6">
            <Udal mood="notFound" size={128} className="mx-auto" />
            <p className="mt-5 text-[17px] text-gray-900 dark:text-white font-bold">{t('notifications.empty')}</p>
            <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-400 mt-2">{t('notifications.emptyDesc')}</p>
            <button type="button" onClick={() => navigate('/')} className="ur-btn ur-btn-md ur-btn-primary mt-6">
              {t('notifications.emptyCta', { defaultValue: '내 주변 이용권 보기' })}
            </button>
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
                className={`w-full flex items-start gap-3 p-4 text-left border-b border-rule ${n.is_read ? 'opacity-50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-brand'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-gray-900 dark:text-white">{n.title}</p>
                  {n.message && <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{n.message}</p>}
                  <p className="text-[12px] text-gray-500 dark:text-gray-500 mt-1">
                    {/* 🛡️ 2026-06-26 (소비자 감사): safeDate — 사파리가 D1 datetime 을 Invalid Date 로 파싱하던 것 보정. */}
                    {safeDate(n.created_at)?.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? ''}
                  </p>
                </div>
              </button>
            ))}
            {hasMore && notifications.length >= 50 && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full py-4 text-[15px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">
                {loadingMore ? t('common.loading', { defaultValue: '불러오는 중…' }) : t('notifications.loadMore', { defaultValue: '더 보기' })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
