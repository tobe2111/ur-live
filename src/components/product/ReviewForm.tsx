import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SharePrompt from '@/components/SharePrompt'

export function ReviewForm({ productId, onSubmitted }: { productId: string | number; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-2.5 mt-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
        리뷰 작성하기
      </button>
    )
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-1">리뷰 작성</h3>
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 bg-pink-50">
        <span className="text-sm">🎁</span>
        <span className="text-[11px] font-semibold text-pink-700">텍스트 50딜 · 사진 100딜 · 영상 200딜 리워드</span>
      </div>
      {/* 별점 */}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => setRating(s)} className={`text-xl ${s <= rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
        ))}
      </div>
      {/* 내용 */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="상품은 어떠셨나요? 최소 10자 이상 작성해주세요."
        rows={3}
        maxLength={2000}
        aria-label="리뷰 내용"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:border-blue-400"
      />
      <div className="flex gap-2 mt-3">
        <button onClick={() => setOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg font-medium">취소</button>
        <button
          disabled={content.length < 10 || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              const res = await api.post('/api/reviews', { product_id: Number(productId), rating, content })
              if (res.data.success) {
                setOpen(false); setContent(''); setRating(5)
                onSubmitted()
                if (res.data.reward) setShowSharePrompt(true)
              } else {
                // ✅ UX H11 FIX: native alert() → toast 헬퍼
                toast.error(res.data.error || '리뷰 작성 실패')
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : '리뷰 작성에 실패했습니다'
              // ✅ UX H11 FIX: native alert() → toast 헬퍼
              toast.error(msg)
            } finally { setSubmitting(false) }
          }}
          className="flex-[2] py-2 bg-blue-600 text-white text-sm rounded-lg font-bold disabled:opacity-40"
        >
          {submitting ? '등록 중...' : '리뷰 등록'}
        </button>
      </div>
      {showSharePrompt && (
        <SharePrompt
          title="리뷰가 등록되었습니다! 🎁"
          message="딜 포인트가 지급되었어요. 이 상품을 친구에게 추천해보세요!"
          shareTitle="이 상품 추천해요!"
          shareDescription="유어딜에서 좋은 상품을 발견했어요"
          shareLink={`/products/${productId}`}
          shareButtonText="상품 보러가기"
          onClose={() => setShowSharePrompt(false)}
        />
      )}
    </div>
  )
}
