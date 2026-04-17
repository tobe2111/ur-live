import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin, Phone, Users, Utensils, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

export default function SellerMealVoucherNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    original_price: 0,
    image_url: '',
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    restaurant_lat: '',
    restaurant_lng: '',
    voucher_expiry: '',
    voucher_terms: '',
    group_buy_target: 10,
    group_buy_deadline: '',
    store_verify_pin: '',
    stock: 100,
  })

  const [placeSelected, setPlaceSelected] = useState(false)

  if (!isSellerAuthenticated()) { redirectToLogin(navigate); return null }

  const token = getSellerToken()
  const headers = { Authorization: `Bearer ${token}` }

  const KAKAO_REST_KEY = (import.meta as any).env?.VITE_KAKAO_REST_API_KEY || ''
  const KAKAO_JS_KEY = (import.meta as any).env?.VITE_KAKAO_JAVASCRIPT_KEY || '975a2e7f97254b08f15dba4d177a2865'

  // 카카오맵 URL에서 place ID 추출
  function extractKakaoPlaceId(url: string): string | null {
    const match = url.match(/place\.map\.kakao\.com\/(\d+)/)
      || url.match(/map\.kakao\.com.*itemId=(\d+)/)
      || url.match(/kakaomap.*place\/(\d+)/)
    return match ? match[1] : null
  }

  // 카카오맵 링크 또는 검색어로 매장 검색
  async function searchPlace(query: string) {
    if (!query.trim()) return
    setSearchingPlace(true)
    setPlaceResults([])

    try {
      // 카카오맵 URL인 경우 → place ID로 직접 조회
      const placeId = extractKakaoPlaceId(query)

      if (placeId) {
        const res = await fetch(`/api/kakao/place/search?query=${encodeURIComponent(query)}&size=1`)
        const json: any = await res.json()
        if (json.data?.documents?.length) {
          selectPlace(json.data.documents[0])
          return
        }
      }

      const res = await fetch(`/api/kakao/place/search?query=${encodeURIComponent(query)}&category_group_code=FD6&size=5`)
      const json: any = await res.json()
      const results = json.data?.documents || json.documents || []
      setPlaceResults(results)

      if (!results.length) {
        toast.error('검색 결과가 없습니다. 매장 이름이나 주소를 정확히 입력해주세요.')
      }
    } catch {
      toast.error('검색 실패. 잠시 후 다시 시도해주세요.')
    } finally {
      setSearchingPlace(false)
    }
  }

  function selectPlace(place: any) {
    setForm(f => ({
      ...f,
      restaurant_name: place.place_name || f.restaurant_name,
      restaurant_address: place.road_address_name || place.address_name || '',
      restaurant_phone: place.phone || '',
      restaurant_lat: place.y || '',
      restaurant_lng: place.x || '',
    }))
    setPlaceSelected(true)
    setPlaceResults([])
    setPlaceQuery('')
    toast.success(`${place.place_name} 정보가 자동 입력되었습니다!`)
  }

  function openKakaoAddress() {
    // 다음 우편번호 서비스 (주소 검색 팝업)
    if (!(window as any).daum?.Postcode) {
      const script = document.createElement('script')
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.onload = () => openKakaoAddress()
      document.head.appendChild(script)
      return
    }
    new (window as any).daum.Postcode({
      oncomplete: async (data: any) => {
        const addr = data.roadAddress || data.jibunAddress
        update('restaurant_address', addr)
        // 주소 → 좌표 변환
        try {
          const res = await fetch(`/api/kakao/place/address?query=${encodeURIComponent(addr)}`)
          const result: any = await res.json()
          if (result.data?.documents?.[0]) {
            update('restaurant_lat', result.data.documents[0].y)
            update('restaurant_lng', result.data.documents[0].x)
          }
        } catch {}
      }
    }).open()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name || !form.price || !form.restaurant_name) {
      toast.error('식사권 이름, 가격, 맛집 이름은 필수입니다')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || `${form.restaurant_name} 식사권`,
        price: form.price,
        original_price: form.original_price || form.price,
        image_url: form.image_url,
        category: 'meal_voucher',
        product_type: 'featured',
        stock: form.stock,
        restaurant_name: form.restaurant_name,
        restaurant_address: form.restaurant_address,
        restaurant_phone: form.restaurant_phone,
        restaurant_lat: form.restaurant_lat ? parseFloat(form.restaurant_lat) : null,
        restaurant_lng: form.restaurant_lng ? parseFloat(form.restaurant_lng) : null,
        voucher_expiry: form.voucher_expiry || null,
        voucher_terms: form.voucher_terms || null,
        group_buy_target: form.group_buy_target || 0,
        group_buy_deadline: form.group_buy_deadline || null,
        store_verify_pin: form.store_verify_pin || null,
      }

      const res = await api.post('/api/seller/products', payload, { headers })
      if (res.data.success) {
        toast.success('식사권이 등록되었습니다!')
        navigate('/seller/group-buy')
      } else {
        toast.error(res.data.error || '등록 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '식사권 등록에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const update = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  return (
    <SellerLayout title="식사권 등록">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-pink-500" />
              <h2 className="text-base font-bold text-gray-900">식사권 정보</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식사권 이름 *</label>
                <input
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="예: [강남맛집] 2인 코스 식사권"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="식사권 상세 설명 (메뉴, 이용 조건 등)"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">판매가 (원) *</label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => update('price', Number(e.target.value))}
                    placeholder="25000"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">정가 (원)</label>
                  <input
                    type="number"
                    value={form.original_price || ''}
                    onChange={e => update('original_price', Number(e.target.value))}
                    placeholder="50000"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                <input
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />
                {form.image_url && (
                  <img src={form.image_url} alt="" className="mt-2 w-32 h-32 rounded-lg object-cover" />
                )}
              </div>
            </div>
          </div>

          {/* 맛집 정보 — 카카오 검색 연동 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-bold text-gray-900">맛집 정보</h2>
            </div>

            <div className="space-y-4">
              {/* 카카오맵 매장 검색 (지도 시각화) */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-900">🗺️ 카카오맵에서 매장 찾기</label>
                    <p className="text-[11px] text-gray-500 mt-0.5">지도에서 직접 찾거나 검색해서 마커를 클릭하세요</p>
                  </div>
                  {placeSelected && (
                    <div className="flex items-center gap-1 text-xs text-green-600 shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                      선택됨
                    </div>
                  )}
                </div>
                <KakaoMapPicker
                  kakaoJsKey={KAKAO_JS_KEY}
                  selectedPlace={placeSelected && form.restaurant_lat ? {
                    name: form.restaurant_name,
                    address: form.restaurant_address,
                    lat: form.restaurant_lat,
                    lng: form.restaurant_lng,
                  } : null}
                  onSelect={(p: KakaoPlace) => selectPlace(p)}
                />
              </div>

              {/* 자동 입력된 정보 (수정 가능) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">맛집 이름 *</label>
                <input
                  value={form.restaurant_name}
                  onChange={e => update('restaurant_name', e.target.value)}
                  placeholder="카카오맵 검색으로 자동 입력되거나 직접 입력"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                <div className="flex gap-2">
                  <input
                    value={form.restaurant_address}
                    onChange={e => update('restaurant_address', e.target.value)}
                    placeholder="자동 입력 또는 직접 입력"
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => openKakaoAddress()}
                    className="px-3 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium shrink-0 active:scale-95"
                  >
                    우편번호
                  </button>
                </div>
                {form.restaurant_lat && form.restaurant_lng && (
                  <p className="text-[10px] text-green-600 mt-1">
                    ✓ 좌표: {Number(form.restaurant_lat).toFixed(6)}, {Number(form.restaurant_lng).toFixed(6)} (맛집 지도에 표시됩니다)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    value={form.restaurant_phone}
                    onChange={e => update('restaurant_phone', e.target.value)}
                    placeholder="자동 입력 또는 직접 입력"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">매장 인증 PIN</label>
                  <input
                    value={form.store_verify_pin}
                    onChange={e => update('store_verify_pin', e.target.value)}
                    placeholder="4자리 이상"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">매장에서 바우처 사용 시 확인하는 비밀번호</p>
                </div>
              </div>
            </div>
          </div>

          {/* 공동구매 설정 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="text-base font-bold text-gray-900">공동구매 설정</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">목표 인원</label>
                  <input
                    type="number"
                    value={form.group_buy_target || ''}
                    onChange={e => update('group_buy_target', Number(e.target.value))}
                    placeholder="10"
                    min={0}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">0이면 공동구매 없이 바로 판매</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수량 (식사권 수)</label>
                  <input
                    type="number"
                    value={form.stock || ''}
                    onChange={e => update('stock', Number(e.target.value))}
                    placeholder="100"
                    min={1}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">공동구매 마감</label>
                  <input
                    type="datetime-local"
                    value={form.group_buy_deadline}
                    onChange={e => update('group_buy_deadline', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">식사권 유효기간</label>
                  <input
                    type="date"
                    value={form.voucher_expiry}
                    onChange={e => update('voucher_expiry', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이용 조건</label>
                <textarea
                  value={form.voucher_terms}
                  onChange={e => update('voucher_terms', e.target.value)}
                  placeholder="예: 주말 사용 불가, 1인 1매 한정, 다른 쿠폰과 중복 불가"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* 미리보기 */}
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
            <p className="text-sm font-bold text-pink-700 mb-2">📋 미리보기</p>
            <p className="text-xs text-pink-600">
              {form.name || '식사권 이름'} · {form.restaurant_name || '맛집 이름'} ·
              {form.price ? ` ${form.price.toLocaleString()}원` : ' 가격 미정'}
              {form.original_price > form.price && ` (정가 ${form.original_price.toLocaleString()}원, ${Math.round((1 - form.price / form.original_price) * 100)}% 할인)`}
              {form.group_buy_target > 0 && ` · 목표 ${form.group_buy_target}명`}
            </p>
          </div>

          {/* 등록 버튼 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/seller/group-buy')}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] py-3 bg-pink-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? '등록 중...' : '식사권 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}
