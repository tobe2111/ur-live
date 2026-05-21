import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SharePrompt from '@/components/SharePrompt'

function ReviewForm({ productId, onSubmitted }: { productId: string | number; onSubmitted: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  // 🛡️ 2026-05-21: 리뷰 사진 첨부 (max 5). compress 후 upload-image → URL 저장.
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-2.5 mt-3 border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:bg-[#121212]">
        {t('reviews.writeBtn', { defaultValue: '리뷰 작성하기' })}
      </button>
    )
  }

  return (
    <div className="mt-3 border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{t('reviews.title', { defaultValue: '리뷰 작성' })}</h3>
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 bg-pink-50">
        <span className="text-sm">🎁</span>
        <span className="text-[11px] font-semibold text-pink-700">{t('reviews.rewardBanner', { defaultValue: '텍스트 50딜 · 사진 100딜 · 영상 200딜 리워드' })}</span>
      </div>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => setRating(s)} className={`text-xl ${s <= rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={t('reviews.placeholder', { defaultValue: '상품은 어떠셨나요? 최소 10자 이상 작성해주세요.' })}
        rows={3}
        maxLength={2000}
        aria-label={t('reviews.contentLabel', { defaultValue: '리뷰 내용' })}
        className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:border-blue-400"
      />

      {/* 🛡️ 2026-05-21: 사진 업로드 — 최대 5장, 5MB/장. 리워드 100딜 (사진 첨부 시). */}
      <div className="mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {images.map((url, idx) => (
            <div key={idx} className="relative w-16 h-16">
              <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
              <button
                type="button"
                onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 text-white rounded-full text-[10px] font-bold flex items-center justify-center"
                aria-label="삭제"
              >×</button>
            </div>
          ))}
          {images.length < 5 && (
            <label className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-[#2A2A2A] rounded-md flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:border-gray-500 active:scale-95 transition">
              {uploading ? (
                <span className="text-[10px]">업로드 중</span>
              ) : (
                <>
                  <span className="text-xl">+</span>
                  <span className="text-[9px]">{images.length}/5</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하만 가능'); return }
                  setUploading(true)
                  try {
                    const { compressForThumbnail } = await import('@/lib/image-compress')
                    const compressed = await compressForThumbnail(file)
                    const fd = new FormData()
                    fd.append('image', compressed)
                    const res = await api.post('/api/seller/upload-image', fd)
                    if (res.data?.success && res.data.url) {
                      setImages(prev => [...prev, res.data.url])
                    } else {
                      toast.error(res.data?.error || '업로드 실패')
                    }
                  } catch (err: unknown) {
                    toast.error((err as Error).message || '업로드 실패')
                  } finally {
                    setUploading(false)
                    e.target.value = ''
                  }
                }}
              />
            </label>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => setOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 text-sm rounded-lg font-medium">{t('common.cancel', { defaultValue: '취소' })}</button>
        <button
          disabled={content.length < 10 || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              const res = await api.post('/api/reviews', { product_id: Number(productId), rating, content, images })
              if (res.data.success) {
                setOpen(false); setContent(''); setRating(5); setImages([])
                onSubmitted()
                if (res.data.reward) setShowSharePrompt(true)
              } else {
                toast.error(res.data.error || t('reviews.writeFailed', { defaultValue: '리뷰 작성 실패' }))
              }
            } catch (err: unknown) {
              // 🛡️ 2026-05-21: 백엔드 응답 형식 분기 — 구매자 전용 403 등 상세 메시지 노출.
              const ax = err as { response?: { status?: number; data?: { error?: string; error_code?: string } } }
              const status = ax.response?.status
              const code = ax.response?.data?.error_code
              const serverMsg = ax.response?.data?.error
              if (code === 'NOT_PURCHASED' || status === 403) {
                toast.error(serverMsg || '리뷰는 해당 상품을 구매하신 분만 작성하실 수 있어요', { duration: 5000 })
              } else {
                const msg = serverMsg || (err instanceof Error ? err.message : t('reviews.writeError', { defaultValue: '리뷰 작성에 실패했습니다' }))
                toast.error(msg)
              }
            } finally { setSubmitting(false) }
          }}
          className="flex-[2] py-2 bg-blue-600 text-white text-sm rounded-lg font-bold disabled:opacity-40"
        >
          {submitting ? t('reviews.submitting', { defaultValue: '등록 중...' }) : t('reviews.submit', { defaultValue: '리뷰 등록' })}
        </button>
      </div>
      {showSharePrompt && (
        <SharePrompt
          title={t('reviews.sharedTitle', { defaultValue: '리뷰가 등록되었습니다! 🎁' })}
          message={t('reviews.sharedMessage', { defaultValue: '딜 포인트가 지급되었어요. 이 상품을 친구에게 추천해보세요!' })}
          shareTitle={t('reviews.sharedShareTitle', { defaultValue: '이 상품 추천해요!' })}
          shareDescription={t('reviews.sharedShareDesc', { defaultValue: '유어딜에서 좋은 상품을 발견했어요' })}
          shareLink={`/products/${productId}`}
          shareButtonText={t('reviews.sharedShareBtn', { defaultValue: '상품 보러가기' })}
          onClose={() => setShowSharePrompt(false)}
        />
      )}
    </div>
  )
}

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

export default function ProductReviews({ productId }: { productId: number | string }) {
  const { t } = useTranslation()
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
      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
        {t('reviews.heading', { defaultValue: '리뷰' })} {totalCount > 0 && <span className="text-gray-500 dark:text-gray-400 font-normal">({totalCount})</span>}
      </h2>

      {totalCount > 0 ? (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{avgRating}</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-sm ${s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map(s => {
              const count = summary?.[`star_${s}`] ?? 0
              const pct = totalCount > 0 ? (count / totalCount) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 w-3">{s}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">{t('reviews.noReviews', { defaultValue: '아직 리뷰가 없습니다.' })}</p>
      )}

      <ReviewForm productId={productId} onSubmitted={() => {
        api.get(`/api/reviews/product/${productId}?limit=5`).then(r => { if (r.data.success) setReviews(r.data.data.reviews) })
        api.get(`/api/reviews/product/${productId}/summary`).then(r => { if (r.data.success) setSummary(r.data.data) })
      }} />

      {reviews.length > 0 && (
        <div className="space-y-3 mt-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-200 dark:border-[#2A2A2A]/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={`text-xs ${s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{r.user_name}</span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.content && <p className="text-xs text-gray-900 dark:text-white leading-relaxed">{r.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
