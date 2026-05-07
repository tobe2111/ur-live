import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Star, Eye, EyeOff, Trash2, MessageSquare, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Review {
  id: number
  product_id: number
  product_name?: string
  user_id: number
  user_name: string
  rating: number
  content: string
  image_urls?: string
  is_visible: number
  created_at: string
}

interface ReviewStats {
  total: number
  average_rating: number
  hidden_count: number
  rating_1: number
  rating_2: number
  rating_3: number
  rating_4: number
  rating_5: number
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  )
}

export default function AdminReviewModerationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({ status: 'all', rating: '', sort: 'newest', product_id: '' })

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadStats()
  }, [])

  useEffect(() => { loadReviews() }, [page, filters])

  async function loadStats() {
    try {
      const res = await api.get('/api/admin/reviews/stats', h)
      if (res.data.success) setStats(res.data.data)
    } catch {}
  }

  async function loadReviews() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20', ...filters })
      const res = await api.get(`/api/admin/reviews/list?${params}`, h)
      if (res.data.success) {
        setReviews(res.data.data || [])
        setTotalPages(res.data.pagination?.totalPages || 1)
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '리뷰 로드 실패')
    } finally { setLoading(false) }
  }

  async function toggleVisibility(review: Review) {
    const newVal = review.is_visible ? 0 : 1
    try {
      await api.patch(`/api/admin/reviews/${review.id}/visibility`, { is_visible: newVal }, h)
      toast.success(newVal ? '리뷰가 표시됩니다' : '리뷰가 숨겨졌습니다')
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, is_visible: newVal } : r))
      loadStats()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '변경 실패')
    }
  }

  async function deleteReview(review: Review) {
    if (!confirm('이 리뷰를 삭제하시겠습니까? 복구할 수 없습니다.')) return
    try {
      await api.delete(`/api/admin/reviews/${review.id}`, h)
      toast.success('리뷰가 삭제되었습니다')
      loadReviews()
      loadStats()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '삭제 실패')
    }
  }

  function parseImages(imageUrls?: string): string[] {
    if (!imageUrls) return []
    try { return JSON.parse(imageUrls) } catch { return [] }
  }

  return (
    <AdminLayout title={t('admin.pages.reviewModeration')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.reviewModeration')}
          subtitle={t('admin.reviewModeration.subtitle', { defaultValue: '상품 리뷰 승인/숨김/삭제 · 부적절 리뷰 모더레이션' })}
          icon={<MessageSquare className="h-5 w-5" />}
        />
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{t('admin.reviewModeration.cardTotal', { defaultValue: '전체 리뷰' })}</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(stats.total)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{t('admin.reviewModeration.cardAvgRating', { defaultValue: '평균 평점' })}</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-gray-900">{stats.average_rating.toFixed(1)}</p>
              <Stars rating={Math.round(stats.average_rating)} />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{t('admin.reviewModeration.cardHidden', { defaultValue: '숨김 처리' })}</p>
            <p className="text-xl font-bold text-red-500">{stats.hidden_count}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{t('admin.reviewModeration.cardRatingDist', { defaultValue: '평점 분포' })}</p>
            <div className="flex items-end gap-1 h-8">
              {[stats.rating_1, stats.rating_2, stats.rating_3, stats.rating_4, stats.rating_5].map((count, i) => {
                const max = Math.max(stats.rating_1, stats.rating_2, stats.rating_3, stats.rating_4, stats.rating_5, 1)
                return <div key={i} className="flex-1 bg-amber-400 rounded-t" style={{ height: `${Math.max(4, (count / max) * 32)}px` }} title={`${i + 1}점: ${count}개`} />
              })}
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filters.status} onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1) }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900">
          <option value="all">{t('admin.reviewModeration.filterAll', { defaultValue: '전체' })}</option>
          <option value="visible">{t('admin.reviewModeration.filterVisible', { defaultValue: '표시' })}</option>
          <option value="hidden">{t('admin.reviewModeration.filterHidden', { defaultValue: '숨김' })}</option>
        </select>
        <select value={filters.rating} onChange={e => { setFilters(p => ({ ...p, rating: e.target.value })); setPage(1) }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900">
          <option value="">{t('admin.reviewModeration.allRatings', { defaultValue: '모든 평점' })}</option>
          {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r}점</option>)}
        </select>
        <select value={filters.sort} onChange={e => { setFilters(p => ({ ...p, sort: e.target.value })); setPage(1) }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900">
          <option value="newest">{t('admin.reviewModeration.newestSort', { defaultValue: '최신순' })}</option>
          <option value="oldest">{t('admin.reviewModeration.oldestSort', { defaultValue: '오래된순' })}</option>
          <option value="rating_high">{t('admin.reviewModeration.ratingHighSort', { defaultValue: '평점 높은순' })}</option>
          <option value="rating_low">{t('admin.reviewModeration.ratingLowSort', { defaultValue: '평점 낮은순' })}</option>
        </select>
      </div>

      {/* 리뷰 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <MessageSquare className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">{t('admin.reviewModeration.noReviews', { defaultValue: '리뷰가 없습니다' })}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => {
            const images = parseImages(review.image_urls)
            return (
              <div key={review.id} className={`bg-white rounded-xl shadow-sm p-4 ${!review.is_visible ? 'opacity-60 border-l-4 border-red-300' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Stars rating={review.rating} />
                      <span className="text-xs text-gray-500">{review.user_name}</span>
                      <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString('ko-KR')}</span>
                      {!review.is_visible && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">{t('admin.reviewModeration.hiddenBadge', { defaultValue: '숨김' })}</span>
                      )}
                    </div>
                    {review.product_name && (
                      <p className="text-[11px] text-gray-400 mb-1">{t('admin.reviewModeration.productLabel', { defaultValue: '상품' })}: {review.product_name}</p>
                    )}
                    <p className="text-sm text-gray-700 whitespace-pre-line">{review.content}</p>
                    {images.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {images.slice(0, 4).map((url, i) => (
                          <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" loading="lazy" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleVisibility(review)}
                      className={`p-1.5 rounded-lg transition-colors ${review.is_visible ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-green-50 text-green-500'}`}
                      title={review.is_visible ? t('admin.reviewModeration.hideReview', { defaultValue: '숨기기' }) : t('admin.reviewModeration.showReview', { defaultValue: '표시하기' })}>
                      {review.is_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteReview(review)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={t('admin.reviewModeration.deleteBtn', { defaultValue: '삭제' })}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg bg-white shadow-sm disabled:opacity-40 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg bg-white shadow-sm disabled:opacity-40 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
