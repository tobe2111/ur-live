import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Users, Share2, Check, Clock, Gift, Copy } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'

interface ReferralGroup {
  id: number; product_id: number; invite_code: string; creator_name: string
  target_count: number; current_count: number; discount_percent: number
  discount_per_person: number; status: string; expires_at: string
  product: { id: number; name: string; price: number; image_url: string } | null
  members: { user_name: string; joined_at: string }[]
}

export default function ReferralPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<ReferralGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const userId = getUserIdSync()

  useEffect(() => {
    if (!code) return
    api.get(`/api/referral/${code}`)
      .then(r => { if (r.data.success) setGroup(r.data.data) })
      .catch(() => toast.error('초대 링크가 유효하지 않습니다'))
      .finally(() => setLoading(false))
  }, [code])

  const handleJoin = async () => {
    if (!userId) { toast.error('로그인이 필요합니다'); navigate('/login'); return }
    if (!code) return
    setJoining(true)
    try {
      const res = await api.post(`/api/referral/join/${code}`)
      if (res.data.success) {
        toast.success(res.data.data.achieved ? '목표 달성! 할인 혜택이 적용됩니다' : '참여 완료!')
        // 새로고침
        const r = await api.get(`/api/referral/${code}`)
        if (r.data.success) setGroup(r.data.data)
      } else {
        toast.error(res.data.error)
      }
    } catch (err: any) { toast.error(err?.response?.data?.error || '참여 실패') }
    finally { setJoining(false) }
  }

  const handleShare = () => {
    const url = `${window.location.origin}/referral/${code}`
    if (navigator.share) {
      navigator.share({ title: '친구 초대 공동구매', text: `함께 사면 ${group?.discount_percent}% 할인! 지금 참여하세요`, url })
    } else {
      navigator.clipboard.writeText(url)
      toast.success('링크가 복사되었습니다')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <Gift className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-900 font-bold text-lg">유효하지 않은 초대입니다</p>
        <Link to="/" className="mt-4 text-blue-600 text-sm font-medium">홈으로 돌아가기</Link>
      </div>
    )
  }

  const isAchieved = group.status === 'achieved'
  const isExpired = group.status === 'expired' || new Date(group.expires_at) < new Date()
  const progressPct = Math.min(100, (group.current_count / group.target_count) * 100)
  const remaining = group.target_count - group.current_count
  const discountPrice = group.product
    ? Math.round(group.product.price * (100 - group.discount_percent) / 100)
    : 0
  const expiresDate = new Date(group.expires_at)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900">친구 초대 공동구매</h1>
          <button onClick={handleShare} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 pb-28">
        {/* 상태 배너 */}
        <div className={`rounded-2xl p-5 text-center ${
          isAchieved ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
          isExpired ? 'bg-gray-200 text-gray-600' :
          'bg-gradient-to-r from-pink-500 to-red-500 text-white'
        }`}>
          {isAchieved ? (
            <>
              <Check className="w-10 h-10 mx-auto mb-2" />
              <p className="text-xl font-bold">목표 달성!</p>
              <p className="text-sm mt-1 opacity-90">{group.discount_percent}% 할인이 적용됩니다</p>
            </>
          ) : isExpired ? (
            <>
              <Clock className="w-10 h-10 mx-auto mb-2" />
              <p className="text-xl font-bold">마감된 공동구매</p>
            </>
          ) : (
            <>
              <Users className="w-10 h-10 mx-auto mb-2" />
              <p className="text-xl font-bold">{remaining}명 더 모이면 할인!</p>
              <p className="text-sm mt-1 opacity-90">{group.discount_percent}% 할인 적용</p>
            </>
          )}
        </div>

        {/* 상품 카드 */}
        {group.product && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex gap-3">
              {group.product.image_url && (
                <img src={group.product.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{group.product.name}</p>
                <div className="mt-2">
                  <span className="text-xs text-gray-400 line-through mr-2">{group.product.price.toLocaleString()}원</span>
                  <span className="text-lg font-bold text-red-500">{discountPrice.toLocaleString()}원</span>
                  <span className="ml-1 text-xs text-red-500 font-bold">-{group.discount_percent}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 진행 상황 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900">참여 현황</span>
            <span className="text-sm text-pink-500 font-bold">{group.current_count}/{group.target_count}명</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-pink-500 to-red-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>

          {/* 멤버 목록 */}
          <div className="space-y-2">
            {group.members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-pink-500">{i + 1}</span>
                </div>
                <span className="text-sm text-gray-700">{m.user_name}</span>
                {i === 0 && <span className="text-[10px] bg-pink-50 text-pink-500 px-1.5 py-0.5 rounded-full font-medium">방장</span>}
              </div>
            ))}
            {/* 빈 슬롯 */}
            {Array.from({ length: remaining }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
                  <span className="text-xs text-gray-300">?</span>
                </div>
                <span className="text-sm text-gray-300">초대 대기 중</span>
              </div>
            ))}
          </div>
        </div>

        {/* 만료 시간 */}
        {!isExpired && !isAchieved && (
          <p className="text-center text-xs text-gray-400">
            마감: {expiresDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* 하단 고정 버튼 */}
      {!isExpired && !isAchieved && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
          <div className="flex gap-2 max-w-md mx-auto">
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 px-5 py-3.5 bg-gray-100 rounded-xl text-gray-700 font-bold text-sm shrink-0"
            >
              <Copy className="w-4 h-4" />
              초대 링크 복사
            </button>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 py-3.5 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-xl font-bold text-sm active:scale-[0.98] disabled:opacity-50"
            >
              {joining ? '참여 중...' : '공동구매 참여하기'}
            </button>
          </div>
        </div>
      )}

      {isAchieved && group.product && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
          <button
            onClick={() => navigate(`/products/${group.product!.id}`)}
            className="w-full max-w-md mx-auto block py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm text-center active:scale-[0.98]"
          >
            {discountPrice.toLocaleString()}원에 구매하기 ({group.discount_percent}% 할인 적용)
          </button>
        </div>
      )}
    </div>
  )
}
