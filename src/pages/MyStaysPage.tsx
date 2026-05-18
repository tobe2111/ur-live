/**
 * 🛡️ 2026-05-18 (PR 6/6): 사용자 본인 숙소 예약 목록 + 취소 + 리뷰 작성.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Building2, Calendar, MapPin, Star, MessageCircle, X as XIcon, ChevronLeft } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface MyBooking {
  id: number
  product_id: number
  product_name: string
  room_id: number
  room_name: string
  image_url: string | null
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
  total_amount: number
  status: string
  check_in_code: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '결제 대기', color: 'bg-gray-700 text-gray-300' },
  confirmed: { label: '예약 확정', color: 'bg-blue-500/20 text-blue-300' },
  checked_in: { label: '체크인 완료', color: 'bg-emerald-500/20 text-emerald-300' },
  checked_out: { label: '이용 완료', color: 'bg-purple-500/20 text-purple-300' },
  cancelled: { label: '취소됨', color: 'bg-gray-700 text-gray-400' },
  no_show: { label: '노쇼', color: 'bg-red-500/20 text-red-300' },
  refunded: { label: '환불됨', color: 'bg-amber-500/20 text-amber-300' },
  dispute: { label: '분쟁 중', color: 'bg-orange-500/20 text-orange-300' },
}

export default function MyStaysPage() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<MyBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewModalFor, setReviewModalFor] = useState<MyBooking | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function token() {
    return localStorage.getItem('access_token') || localStorage.getItem('firebase_token') || ''
  }

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/api/group-buy/stays/my-bookings', { headers: { Authorization: `Bearer ${token()}` } })
      if (r.data?.success) setBookings(r.data.data || [])
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number } }
      if (ax.response?.status === 401) navigate('/login?returnUrl=/my-stays')
    } finally { setLoading(false) }
  }

  async function cancel(b: MyBooking) {
    const reason = prompt('취소 사유 (선택):')
    if (reason === null) return
    try {
      const r = await api.patch(`/api/group-buy/stays/bookings/${b.id}/cancel`, { reason: reason || '' }, { headers: { Authorization: `Bearer ${token()}` } })
      if (r.data?.success) {
        const { refund_amount, refund_rate } = r.data.data
        toast.success(`취소됨 — 환불 ${(refund_rate * 100).toFixed(0)}% (₩${formatNumber(refund_amount)})`)
        load()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '취소 실패')
    }
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white pb-safe-nav">
      <SEO title="내 숙소 예약 - 유어딜" description="숙소 예약 내역" url="/my-stays" />

      <div className="sticky top-0 z-30 bg-[#020202]/95 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="ur-content-wide px-4 lg:px-8 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-base font-bold flex-1">내 숙소 예약</h1>
        </div>
      </div>

      <div className="ur-content-wide px-4 lg:px-8 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">로딩 중...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">예약 내역이 없습니다</p>
            <Link to="/stays" className="inline-flex items-center gap-1 px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg">
              숙소 둘러보기 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const st = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-gray-700' }
              const canCancel = ['confirmed', 'pending'].includes(b.status)
              const canReview = b.status === 'checked_out'
              return (
                <div key={b.id} className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Link to={`/stays/${b.product_id}`} className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-[#1A1A1A]">
                      {b.image_url ? <img src={b.image_url} alt={b.product_name} className="w-full h-full object-cover" /> : null}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Link to={`/stays/${b.product_id}`} className="text-sm font-bold line-clamp-1 hover:underline">{b.product_name}</Link>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${st.color}`}>{st.label}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">{b.room_name}</p>
                      <div className="flex items-center gap-1 text-[11px] text-gray-300 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{b.check_in_date} ~ {b.check_out_date}</span>
                        <span className="text-gray-500">({b.nights}박 · {b.guest_count}명)</span>
                      </div>
                      {b.check_in_code && b.status === 'confirmed' && (
                        <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-blue-500/20 rounded">
                          <span className="text-[10px] text-blue-300">체크인 코드</span>
                          <span className="text-xs font-mono font-bold text-blue-200">{b.check_in_code}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1A1A1A]">
                        <p className="text-sm font-extrabold text-pink-400">₩{formatNumber(b.total_amount)}</p>
                        <div className="flex gap-1">
                          {canCancel && (
                            <button onClick={() => cancel(b)} className="px-2.5 py-1 bg-white/[0.06] text-gray-300 text-[11px] font-semibold rounded hover:bg-white/[0.1]">
                              <XIcon className="w-3 h-3 inline mr-0.5" />취소
                            </button>
                          )}
                          {canReview && (
                            <button onClick={() => setReviewModalFor(b)} className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-bold rounded hover:bg-amber-600">
                              <Star className="w-3 h-3 inline mr-0.5" />리뷰 작성
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {reviewModalFor && (
        <ReviewModal
          booking={reviewModalFor}
          token={token()}
          onClose={() => setReviewModalFor(null)}
          onSubmitted={() => { setReviewModalFor(null); load() }}
        />
      )}
    </div>
  )
}

function ReviewModal({ booking, token, onClose, onSubmitted }: {
  booking: MyBooking; token: string; onClose: () => void; onSubmitted: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [ratings, setRatings] = useState({
    overall: 5, cleanliness: 5, location: 5, service: 5, facility: 5, value: 5,
  })
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')

  async function submit() {
    if (comment.trim().length < 10) { toast.error('코멘트는 10자 이상 입력해주세요'); return }
    setSubmitting(true)
    try {
      const r = await api.post(`/api/group-buy/stays/bookings/${booking.id}/review`, {
        rating_overall: ratings.overall,
        rating_cleanliness: ratings.cleanliness,
        rating_location: ratings.location,
        rating_service: ratings.service,
        rating_facility: ratings.facility,
        rating_value: ratings.value,
        title: title.trim(),
        comment: comment.trim(),
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) { toast.success('리뷰가 등록되었습니다'); onSubmitted() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '등록 실패')
    } finally { setSubmitting(false) }
  }

  function StarRow({ label, val, onChange }: { label: string; val: number; onChange: (n: number) => void }) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-xs text-gray-300">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => onChange(n)} type="button">
              <Star className={`w-4 h-4 ${n <= val ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-[#0A0A0A] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-[#1A1A1A] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0A0A0A] px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-base font-bold">리뷰 작성</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{booking.product_name}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-white/[0.04] rounded-lg p-3 space-y-1">
            <StarRow label="전체 평점" val={ratings.overall} onChange={(n) => setRatings({ ...ratings, overall: n })} />
            <StarRow label="청결도" val={ratings.cleanliness} onChange={(n) => setRatings({ ...ratings, cleanliness: n })} />
            <StarRow label="위치" val={ratings.location} onChange={(n) => setRatings({ ...ratings, location: n })} />
            <StarRow label="서비스" val={ratings.service} onChange={(n) => setRatings({ ...ratings, service: n })} />
            <StarRow label="시설" val={ratings.facility} onChange={(n) => setRatings({ ...ratings, facility: n })} />
            <StarRow label="가성비" val={ratings.value} onChange={(n) => setRatings({ ...ratings, value: n })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">제목 (선택)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="예) 깨끗하고 조용한 펜션" className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">코멘트 *</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={5} maxLength={5000} placeholder="이용 경험을 자세히 알려주세요 (10자 이상)" className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-sm resize-none" />
            <p className="text-[10px] text-gray-500 mt-1">{comment.length}/5000</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-3 bg-white/[0.06] text-sm font-semibold rounded-lg disabled:opacity-50">취소</button>
            <button onClick={submit} disabled={submitting} className="flex-1 py-3 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50">
              {submitting ? '등록 중...' : '리뷰 등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
