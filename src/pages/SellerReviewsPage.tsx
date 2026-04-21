import { useState, useEffect } from 'react'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { Star, MessageCircle, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function SellerReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [replyId, setReplyId] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

  useEffect(() => {
    api.get('/api/seller/analytics/reviews', getAuthHeaders())
      .then(r => { if (r.data.success) setReviews(r.data.data || []) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const submitReply = async (reviewId: number) => {
    if (!replyText.trim()) return
    try {
      await api.post(`/api/seller/analytics/reviews/${reviewId}/reply`, { reply: replyText.trim() }, getAuthHeaders())
      toast.success('답글이 등록되었습니다')
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, seller_reply: replyText.trim(), seller_reply_at: new Date().toISOString() } : r))
      setReplyId(null); setReplyText('')
    } catch { toast.error('답글 등록 실패') }
  }

  return (
    <SellerLayout title="리뷰 관리">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">리뷰 관리</h1>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : reviews.length === 0 ? (
          <p className="text-center py-12 text-gray-500">받은 리뷰가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.product_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">{r.user_name || '고객'}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <p className="text-sm text-gray-700">{r.content}</p>
                {r.seller_reply ? (
                  <div className="mt-3 bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium mb-1">셀러 답글</p>
                    <p className="text-sm text-gray-700">{r.seller_reply}</p>
                  </div>
                ) : replyId === r.id ? (
                  <div className="mt-3 flex gap-2">
                    <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="답글 작성..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                    <button onClick={() => submitReply(r.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">등록</button>
                    <button onClick={() => setReplyId(null)} className="px-3 py-2 text-gray-500 text-sm">취소</button>
                  </div>
                ) : (
                  <button onClick={() => { setReplyId(r.id); setReplyText('') }}
                    className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> 답글 작성
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
