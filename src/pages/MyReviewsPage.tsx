import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Star, AlertCircle, MessageSquare } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { requireLogin, isLoggedInSync } from '@/utils/auth'
import type { Order } from '@/types/order'

export default function MyReviewsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedInSync()) {
      requireLogin(navigate, t('myReviews.loginRequired'))
      return
    }
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadOrders() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/orders')
      if (res.data.success) {
        const d = res.data.data
        const list = Array.isArray(d) ? d : (d?.items || d?.orders || [])
        const reviewable = (list as Order[]).filter(o => {
          const s = o.status?.toLowerCase()
          return s === 'delivered' || s === 'done'
        })
        setOrders(reviewable)
      } else {
        setError(res.data.error || t('myReviews.loadFailed'))
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError(t('myReviews.sessionExpired'))
      } else {
        setError(t('myReviews.loadFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <SEO title={t('myReviews.seoTitle')} description={t('myReviews.seoDesc')} url="/my-reviews" noindex />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-4 h-[52px]">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center"
            aria-label={t('myReviews.back')}
          >
            <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('myReviews.title')}</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 py-4 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-[14px] text-gray-900 dark:text-white mb-4">{error}</p>
            <button
              onClick={loadOrders}
              className="px-5 py-2 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
            >
              {t('myReviews.retry')}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] py-16 text-center">
            <div className="w-20 h-20 bg-gray-50 dark:bg-[#121212] rounded-full flex items-center justify-center mx-auto mb-5">
              <MessageSquare className="h-10 w-10 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-[16px] font-bold text-gray-900 dark:text-white mb-1.5">{t('myReviews.empty')}</h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{t('myReviews.emptySub')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[12px] text-gray-500 dark:text-gray-400">{t('myReviews.deliveredCount', { count: orders.length })}</p>
              <span className="text-[11px] text-amber-600 font-semibold">{t('myReviews.rewardHint')}</span>
            </div>
            {orders.flatMap(order => {
              // v32 audit FIX: API가 items를 array 대신 단일 object로 반환할 수도 있음 — 방어적 처리
              const rawItems = order.items
              const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems as any] : [])
              return items.map((item: any, idx: number) => (
                <article
                  key={`${order.id}-${idx}`}
                  className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4"
                >
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    {t('myReviews.purchaseDate', { date: new Date(order.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) })}
                  </p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
                    {item.product_name}
                  </p>
                  {item.option_value && (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-2">{t('myReviews.optionLabel', { value: item.option_value })}</p>
                  )}
                  <button
                    onClick={() => navigate(`/products/${item.product_id}#review`)}
                    className="w-full mt-2 py-2.5 bg-amber-50 text-amber-700 text-[13px] font-semibold rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Star className="h-3.5 w-3.5" fill="currentColor" />
                    {t('myReviews.writeReview')}
                  </button>
                </article>
              ))
            })}
          </div>
        )}
      </main>
    </div>
  )
}
