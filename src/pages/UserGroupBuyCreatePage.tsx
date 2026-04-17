import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MapPin, Phone, Loader2, AlertCircle } from 'lucide-react'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'

interface SelectedRestaurant {
  name: string
  address: string
  phone: string
  lat: string
  lng: string
}

export default function UserGroupBuyCreatePage() {
  const navigate = useNavigate()

  // Auth check
  const userType = localStorage.getItem('user_type')
  const userId = localStorage.getItem('user_id')
  const isLoggedIn = userType === 'user' && !!userId

  useEffect(() => {
    if (!isLoggedIn) {
      toast.error('로그인이 필요합니다')
      navigate('/login', { replace: true })
    }
  }, [isLoggedIn, navigate])

  // Step state
  const [restaurant, setRestaurant] = useState<SelectedRestaurant | null>(null)

  // Step 2 fields
  const [proposedPrice, setProposedPrice] = useState<number | ''>('')
  const [deposit, setDeposit] = useState<number>(5000)
  const [targetCount, setTargetCount] = useState<number>(10)

  // Step 3
  const [balance, setBalance] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const kakaoJsKey =
    import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  // Fetch balance when restaurant + settings ready
  useEffect(() => {
    if (!restaurant || !proposedPrice) return
    api
      .get('/api/points/balance')
      .then((r) => {
        const b = r.data?.balance ?? r.data?.data?.balance ?? 0
        setBalance(b)
      })
      .catch(() => setBalance(0))
  }, [restaurant, proposedPrice])

  function handlePlaceSelect(place: KakaoPlace) {
    setRestaurant({
      name: place.place_name,
      address: place.road_address_name || place.address_name || '',
      phone: place.phone || '',
      lat: place.y,
      lng: place.x,
    })
  }

  const totalRaised = targetCount * deposit
  const step2Valid = !!proposedPrice && proposedPrice > 0 && deposit >= 1000 && targetCount >= 3
  const canSubmit = !!restaurant && step2Valid && !submitting

  async function handleSubmit() {
    if (!canSubmit || !restaurant) return
    setSubmitting(true)
    try {
      const res = await api.post('/api/community-group-buy/create', {
        restaurant_name: restaurant.name,
        restaurant_address: restaurant.address,
        restaurant_phone: restaurant.phone,
        restaurant_lat: restaurant.lat,
        restaurant_lng: restaurant.lng,
        proposed_price: proposedPrice,
        deposit_per_person: deposit,
        target_count: targetCount,
      })
      const data = res.data?.data || res.data
      const inviteCode = data?.invite_code
      if (inviteCode) {
        toast.success('맛집 공구가 시작되었습니다!')
        navigate(`/community-group-buy/${inviteCode}`)
      } else {
        toast.error('공구 생성에 실패했습니다')
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      const msg = err_.response?.data?.message || '네트워크 오류가 발생했습니다'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) return null

  return (
    <div className="bg-white min-h-screen pb-24">
      <SEO
        title="맛집 공구 시작"
        description="내가 좋아하는 맛집의 식사권을 공동구매로 더 싸게! 맛집 공구를 시작해보세요."
        url="/community-group-buy/new"
      />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center h-12 px-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-1"
            aria-label="뒤로"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-[16px] font-extrabold text-gray-900 flex-1 text-center pr-8">
            맛집 공구 시작하기
          </h1>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-8">
        {/* ── Step 1: 맛집 선택 ── */}
        <section>
          <h2 className="text-[15px] font-bold text-gray-900 mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold mr-2">
              1
            </span>
            맛집 선택
          </h2>

          <KakaoMapPicker
            kakaoJsKey={kakaoJsKey}
            onSelect={handlePlaceSelect}
            selectedPlace={
              restaurant
                ? {
                    name: restaurant.name,
                    address: restaurant.address,
                    lat: restaurant.lat,
                    lng: restaurant.lng,
                  }
                : null
            }
          />

          {/* Selected restaurant card */}
          {restaurant && (
            <div className="mt-3 p-4 border border-gray-200 rounded-xl bg-gray-50">
              <p className="text-[14px] font-bold text-gray-900">
                {restaurant.name}
              </p>
              <p className="text-[12px] text-gray-600 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {restaurant.address}
              </p>
              {restaurant.phone && (
                <p className="text-[12px] text-gray-500 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {restaurant.phone}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Step 2: 공구 설정 ── */}
        <section>
          <h2 className="text-[15px] font-bold text-gray-900 mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold mr-2">
              2
            </span>
            공구 설정
          </h2>

          <div className="space-y-4">
            {/* 희망 식사권 가격 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1">
                희망 식사권 가격
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={proposedPrice}
                  onChange={(e) =>
                    setProposedPrice(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="예: 20000"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">
                  원
                </span>
              </div>
            </div>

            {/* 1인당 딜 예치금 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1">
                1인당 딜 예치금
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                  min={1000}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">
                  딜
                </span>
              </div>
              {deposit > 0 && deposit < 1000 && (
                <p className="text-[11px] text-red-500 mt-1">
                  최소 1,000딜 이상이어야 합니다
                </p>
              )}
            </div>

            {/* 목표 인원 */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1">
                목표 인원
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value) || 0)}
                  min={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">
                  명
                </span>
              </div>
              {targetCount > 0 && targetCount < 3 && (
                <p className="text-[11px] text-red-500 mt-1">
                  최소 3명 이상이어야 합니다
                </p>
              )}
            </div>

            {/* Calculation */}
            {step2Valid && (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[13px] text-gray-600">
                  목표 달성 시 총{' '}
                  <span className="font-bold text-pink-500">
                    {totalRaised.toLocaleString()}딜
                  </span>{' '}
                  모금
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Step 3: 확인 & 시작 ── */}
        {restaurant && step2Valid && (
          <section>
            <h2 className="text-[15px] font-bold text-gray-900 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold mr-2">
                3
              </span>
              확인 &amp; 시작
            </h2>

            {/* Summary card */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-[11px] text-gray-500 mb-0.5">맛집</p>
                <p className="text-[14px] font-bold text-gray-900">
                  {restaurant.name}
                </p>
                <p className="text-[12px] text-gray-500">{restaurant.address}</p>
              </div>

              <hr className="border-gray-100" />

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[11px] text-gray-500">희망 가격</p>
                  <p className="text-[14px] font-bold text-gray-900">
                    {Number(proposedPrice).toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">예치금</p>
                  <p className="text-[14px] font-bold text-gray-900">
                    {deposit.toLocaleString()}딜
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">목표 인원</p>
                  <p className="text-[14px] font-bold text-gray-900">
                    {targetCount}명
                  </p>
                </div>
              </div>
            </div>

            {/* Balance */}
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-[13px] text-gray-600">내 딜 잔액</span>
              <span className="text-[14px] font-bold text-pink-500">
                {balance !== null
                  ? `${balance.toLocaleString()}딜`
                  : '로딩중...'}
              </span>
            </div>

            {/* Warning */}
            <div className="mt-3 flex gap-2 bg-gray-50 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-gray-500 leading-relaxed">
                참여 시 <span className="font-semibold text-gray-700">{deposit.toLocaleString()}딜</span>이
                예치됩니다. 미달성 시 전액 환불됩니다.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Bottom CTA */}
      {restaurant && step2Valid && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-50">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3.5 bg-gray-900 text-white text-[15px] font-bold rounded-xl disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              '공구 시작하기'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
