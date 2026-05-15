import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, Phone, Clock, Users, Sparkles, CheckCircle2, AlertCircle, Share2 } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import KakaoShareButton from '@/components/KakaoShareButton'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

// 🛡️ 2026-05-15: 전용 공구 상세 페이지 (`/group-buy/:id`)
//   - 카운트다운 ring + 티어 진행 바 + 참여자 아바타 + 마감 timer + share CTA
//   - 일반 ProductDetailPage 와 분리: 공구 특화 UX (참여 후 voucher 발급 강조)

interface GroupBuyDetail {
  id: number
  name: string
  description?: string
  image_url?: string
  price: number
  original_price?: number
  category: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_phone?: string
  restaurant_lat?: number
  restaurant_lng?: number
  voucher_expiry?: string
  voucher_terms?: string
  group_buy_target: number
  group_buy_current: number
  group_buy_deadline?: string
  group_buy_status: 'active' | 'achieved' | 'expired' | 'cancelled' | string
  group_buy_tiers?: string | null
  current_discount_pct: number
  next_tier?: { min: number; discount_pct: number } | null
  next_tier_remaining?: number | null
  seller_id?: number
  seller_name?: string
  seller_avatar?: string
}

interface Participant {
  masked_name: string
  avatar?: string
  created_at: string
  quantity: number
}

function CategoryEmoji({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    meal_voucher: '🍽️', beauty_voucher: '💇', health_voucher: '💪',
    pet_voucher: '🐶', stay_voucher: '🏨', activity_voucher: '🎯',
  }
  return <span>{map[cat] || '🎫'}</span>
}

function CountdownRing({ deadline }: { deadline?: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!deadline) return null
  const end = new Date(deadline).getTime()
  const diff = Math.max(0, end - now)
  if (diff === 0) return <span className="text-red-500 font-bold">마감됨</span>
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const urgent = diff < 24 * 3600000
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${urgent ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-amber-50 text-amber-700'}`}>
      <Clock className="w-3 h-3" />
      {days > 0 ? `${days}일 ${hours}시간 남음` : `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} 남음`}
    </div>
  )
}

export default function GroupBuyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [detail, setDetail] = useState<GroupBuyDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const productId = Number(id)
  const isLoggedIn = !!localStorage.getItem('user_id') || !!localStorage.getItem('uid')

  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      toast.error('잘못된 ID')
      navigate('/group-buy')
      return
    }
    let cancelled = false
    Promise.all([
      api.get(`/api/group-buy/products/${productId}`),
      api.get(`/api/group-buy/products/${productId}/participants`).catch(() => ({ data: { data: [] } })),
    ]).then(([detailRes, partRes]) => {
      if (cancelled) return
      if (detailRes.data?.success) setDetail(detailRes.data.data)
      else toast.error(detailRes.data?.error || '상품을 찾을 수 없습니다')
      setParticipants(partRes.data?.data || [])
    }).catch(() => toast.error('네트워크 오류'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [productId, navigate])

  const tiers = useMemo(() => {
    if (!detail?.group_buy_tiers) return []
    try {
      const arr = JSON.parse(detail.group_buy_tiers) as Array<{ min: number; discount_pct: number }>
      return Array.isArray(arr) ? arr.sort((a, b) => a.min - b.min) : []
    } catch { return [] }
  }, [detail?.group_buy_tiers])

  const progress = detail && detail.group_buy_target > 0
    ? Math.min(100, (detail.group_buy_current / detail.group_buy_target) * 100)
    : 0
  const unitPrice = detail ? Math.round(detail.price * (1 - (detail.current_discount_pct || 0) / 100)) : 0
  const total = unitPrice * quantity
  const isJoinable = detail?.group_buy_status === 'active' || detail?.group_buy_status === 'achieved'

  async function handleJoin() {
    if (!detail) return
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    if (!window.confirm(`${detail.name}\n${quantity}장 × ${unitPrice.toLocaleString('ko-KR')}딜 = ${total.toLocaleString('ko-KR')}딜\n\n${detail.current_discount_pct > 0 ? `🎉 티어 할인 ${detail.current_discount_pct}% 적용\n\n` : ''}딜로 결제하고 바우처를 발급받습니다. 진행할까요?`)) return

    setJoining(true)
    try {
      const res = await api.post(`/api/group-buy/join/${productId}`, { quantity, payment_method: 'deal' })
      if (res.data?.success) {
        toast.success(res.data.message || '공구 참여 완료!')
        navigate('/my-vouchers')
      } else {
        toast.error(res.data?.error || '참여 실패')
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
      const code = e?.response?.data?.code
      if (code === 'INSUFFICIENT_POINTS') {
        if (window.confirm('딜이 부족합니다. 충전 페이지로 이동할까요?')) {
          localStorage.setItem('loginReturnUrl', window.location.pathname)
          navigate('/points/charge')
        }
        return
      }
      if (e?.response?.status === 429) {
        toast.error('잠시 후 다시 시도해주세요.')
        return
      }
      toast.error(e?.response?.data?.error || '참여 실패')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900">
        <p className="font-bold mb-3">상품을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/group-buy')} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold">공구 목록으로</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={`${detail.name} - 공동구매`}
        description={`${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}/${detail.group_buy_target}명 참여 중`}
        url={`/group-buy/${productId}`}
        image={detail.image_url}
      />

      {/* 상단 chrome */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100 px-3 py-2.5 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <KakaoShareButton
          title={`${detail.name} 공구 참여하기`}
          description={`${detail.restaurant_name ? detail.restaurant_name + ' · ' : ''}${detail.group_buy_current}/${detail.group_buy_target}명 참여 중 · ${detail.current_discount_pct > 0 ? `${detail.current_discount_pct}% 할인` : '단계별 할인'}`}
          imageUrl={detail.image_url}
          link={`/group-buy/${productId}`}
          buttonText="나도 참여하기"
          compact
          className="w-9 h-9 rounded-full bg-[#FEE500] flex items-center justify-center"
        />
      </div>

      <div className="ur-content-narrow mx-auto px-4 lg:px-8 py-4 space-y-4">
        {/* 이미지 + 상태 */}
        <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-100">
          {detail.image_url ? (
            <img src={detail.image_url} alt={detail.name} className="w-full aspect-[4/3] object-cover" />
          ) : (
            <div className="w-full aspect-[4/3] bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center text-6xl">
              <CategoryEmoji cat={detail.category} />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <CategoryEmoji cat={detail.category} />
              <span className="text-gray-700">{detail.category.replace('_voucher', '')}</span>
            </span>
            {detail.group_buy_status === 'achieved' && (
              <span className="bg-green-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 달성
              </span>
            )}
            {detail.group_buy_status === 'expired' && (
              <span className="bg-gray-700 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">마감</span>
            )}
            {detail.group_buy_status === 'cancelled' && (
              <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">취소</span>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <CountdownRing deadline={detail.group_buy_deadline} />
          </div>
        </div>

        {/* 제품 정보 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
          <h1 className="text-xl font-bold text-gray-900">{detail.name}</h1>
          {detail.restaurant_name && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-700">{detail.restaurant_name}</p>
                {detail.restaurant_address && <p className="text-xs text-gray-500 mt-0.5">{detail.restaurant_address}</p>}
              </div>
            </div>
          )}
          {detail.restaurant_phone && (
            <a href={`tel:${detail.restaurant_phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-pink-500">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{detail.restaurant_phone}</span>
            </a>
          )}

          {/* 가격 */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-baseline gap-2">
              {detail.current_discount_pct > 0 && (
                <span className="text-xs text-gray-400 line-through">{formatNumber(detail.price)}딜</span>
              )}
              <span className="text-2xl font-extrabold text-pink-500">{formatNumber(unitPrice)}</span>
              <span className="text-sm font-bold text-pink-500">딜</span>
              {detail.current_discount_pct > 0 && (
                <span className="ml-auto bg-pink-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                  🎉 {detail.current_discount_pct}% OFF
                </span>
              )}
            </div>
            {detail.original_price && detail.original_price > detail.price && (
              <p className="text-[11px] text-gray-400 mt-1">정가 {formatNumber(detail.original_price)}원 → 공구가 {formatNumber(detail.price)}딜</p>
            )}
          </div>
        </div>

        {/* 진행 현황 + 티어 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-500" />
              <span className="text-sm font-bold text-gray-900">진행 현황</span>
            </div>
            <span className="text-2xl font-extrabold text-pink-500">{Math.round(progress)}%</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
              <span><span className="font-bold text-gray-900">{detail.group_buy_current}</span>명 참여</span>
              <span>목표 {detail.group_buy_target}명</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  detail.group_buy_status === 'achieved' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  progress >= 80 ? 'bg-gradient-to-r from-pink-500 to-rose-500' :
                  'bg-gradient-to-r from-pink-400 to-rose-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {detail.next_tier_remaining && detail.next_tier_remaining > 0 && (
              <p className="text-[11px] text-pink-600 mt-2 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" />
                {detail.next_tier_remaining}명 더 모이면 {detail.next_tier?.discount_pct}% 할인 시작!
              </p>
            )}
            {detail.group_buy_target - detail.group_buy_current === 1 && (
              <p className="text-[11px] text-red-600 mt-2 font-bold animate-pulse">🔥 1명만 더 모이면 공구 성공!</p>
            )}
          </div>

          {/* 티어 시각화 */}
          {tiers.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-2">🎯 단계별 할인</p>
              <div className="space-y-1.5">
                {tiers.map((tier, idx) => {
                  const reached = detail.group_buy_current >= tier.min
                  return (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg ${reached ? 'bg-pink-50 border border-pink-200' : 'bg-gray-50'}`}>
                      <span className={`text-xs ${reached ? 'text-pink-700 font-bold' : 'text-gray-500'}`}>
                        {reached ? '✅ ' : ''}{tier.min}명 모이면
                      </span>
                      <span className={`text-sm font-bold ${reached ? 'text-pink-600' : 'text-gray-400'}`}>
                        -{tier.discount_pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 참여자 아바타 */}
        {participants.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-bold text-gray-700 mb-3">최근 참여자 ({participants.length}명)</p>
            <div className="flex flex-wrap gap-1.5">
              {participants.slice(0, 12).map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-full text-[10px] text-gray-600"
                  title={`${p.masked_name} · ${p.quantity}장`}
                >
                  {p.avatar ? (
                    <img src={p.avatar} alt="" className="w-4 h-4 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-300 to-rose-300" />
                  )}
                  <span>{p.masked_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 셀러 정보 */}
        {detail.seller_name && (
          <button
            onClick={() => detail.seller_id && navigate(`/profile/${detail.seller_id}`)}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 hover:bg-gray-50"
          >
            {detail.seller_avatar ? (
              <img src={detail.seller_avatar} alt="" className="w-10 h-10 rounded-full object-cover" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-rose-400" />
            )}
            <div className="flex-1 text-left">
              <p className="text-xs text-gray-500">판매자</p>
              <p className="text-sm font-bold text-gray-900">{detail.seller_name}</p>
            </div>
            <span className="text-xs text-gray-400">프로필 →</span>
          </button>
        )}

        {/* 사용 안내 */}
        {detail.voucher_terms && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> 사용 안내
            </p>
            <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">{detail.voucher_terms}</p>
          </div>
        )}

        {detail.voucher_expiry && (
          <p className="text-[11px] text-gray-500 text-center">
            바우처 사용 기한: {new Date(detail.voucher_expiry).toLocaleDateString('ko-KR')}
          </p>
        )}

        <div style={{ height: 100 }} />
      </div>

      {/* sticky 하단 결제 영역 */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-3 z-30 lg:max-w-[720px] lg:left-1/2 lg:-translate-x-1/2 lg:rounded-t-2xl lg:shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={!isJoinable || quantity <= 1}
              className="w-9 h-9 flex items-center justify-center text-gray-700 disabled:text-gray-400"
            >−</button>
            <span className="w-10 text-center text-sm font-bold text-gray-900">{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              disabled={!isJoinable || quantity >= 10}
              className="w-9 h-9 flex items-center justify-center text-gray-700 disabled:text-gray-400"
            >+</button>
          </div>
          <button
            onClick={handleJoin}
            disabled={!isJoinable || joining}
            className={`flex-1 h-11 rounded-lg text-sm font-bold text-white transition-all ${
              isJoinable
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 active:scale-[0.98]'
                : 'bg-gray-300'
            }`}
          >
            {joining ? '처리 중…' :
              !isJoinable ? '참여 불가' :
              `${formatNumber(total)}딜 참여하기`}
          </button>
        </div>
      </div>
    </div>
  )
}
