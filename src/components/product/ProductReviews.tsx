import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { ReviewForm } from '@/components/product/ReviewForm'

interface ReviewSummary {
  avg_rating: number
  total_count: number
  star_1?: number
  star_2?: number
  star_3?: number
  star_4?: number
  star_5?: number
  [key: string]: number | undefined
}

interface Review {
  id: number | string
  rating: number
  content?: string
  user_name?: string
  created_at: string
}

export function ProductReviews({ productId }: { productId: number | string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    Promise.all([
      api.get(`/api/reviews/product/${productId}/summary`).catch(() => null),
      api.get(`/api/reviews/product/${productId}?limit=5`).catch(() => null),
    ]).then(([sumRes, listRes]) => {
      if (sumRes?.data?.success) setSummary(sumRes.data.data)
      if (listRes?.data?.success) setReviews(listRes.data.data.reviews)
    })
  }, [productId])

  const avgRating = summary?.avg_rating ?? 0
  const totalCount = summary?.total_count ?? 0

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-4">
        리뷰 {totalCount > 0 && <span className="text-gray-500 font-normal">({totalCount})</span>}
      </h2>

      {/* 평점 요약 */}
      {totalCount > 0 ? (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{avgRating}</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-sm ${s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`}>
                  ★
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map(s => {
              const count = summary?.[`star_${s}`] ?? 0
              const pct = totalCount > 0 ? (count / totalCount) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-3">{s}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 py-6 text-center">아직 리뷰가 없습니다.</p>
      )}

      {/* 리뷰 작성 */}
      <ReviewForm productId={productId} onSubmitted={() => {
        api.get(`/api/reviews/product/${productId}?limit=5`).then(r => { if (r.data.success) setReviews(r.data.data.reviews) })
        api.get(`/api/reviews/product/${productId}/summary`).then(r => { if (r.data.success) setSummary(r.data.data) })
      }} />

      {/* 리뷰 목록 */}
      {reviews.length > 0 && (
        <div className="space-y-3 mt-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-200/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={`text-xs ${s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-500">{r.user_name}</span>
                </div>
                <span className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.content && <p className="text-xs text-gray-900 leading-relaxed">{r.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
