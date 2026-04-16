import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Users, Tag, Calendar, Image as ImageIcon, MapPin, CheckCircle, Package } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

interface Tier {
  count: number
  discount: number
}

type ProductKind = 'generic' | 'meal_voucher'

export default function SellerGroupBuyNewPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    image_url: '',
    price: 0,
    stock: 100,
    group_buy_deadline: '',
    // 맛집 정보 (meal_voucher 유형일 때만)
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    restaurant_lat: '',
    restaurant_lng: '',
  })

  const [kind, setKind] = useState<ProductKind>('generic')

  const [tiers, setTiers] = useState<Tier[]>([
    { count: 2, discount: 10 },
    { count: 5, discount: 30 },
    { count: 10, discount: 50 },
  ])

  // 카카오 매장 검색
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<any[]>([])
  const [searchingPlace, setSearchingPlace] = useState(false)
  const [placeSelected, setPlaceSelected] = useState(false)

  if (!isSellerAuthenticated()) { redirectToLogin(navigate); return null }

  const token = getSellerToken()
  const headers = { Authorization: `Bearer ${token}` }

  const KAKAO_REST_KEY = '975a2e7f97254b08f15dba4d177a2865'

  const update = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  // ── 티어 관리 ────────────────────────────────────────────
  function addTier() {
    const last = tiers[tiers.length - 1]
    const nextCount = last ? last.count + 5 : 2
    const nextDiscount = last ? Math.min(90, last.discount + 10) : 10
    setTiers([...tiers, { count: nextCount, discount: nextDiscount }])
  }

  function removeTier(idx: number) {
    if (tiers.length <= 1) {
      toast.error('티어는 최소 1개 이상이어야 합니다')
      return
    }
    setTiers(tiers.filter((_, i) => i !== idx))
  }

  function updateTier(idx: number, field: keyof Tier, value: number) {
    setTiers(tiers.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  function sortedTiers(): Tier[] {
    return [...tiers].sort((a, b) => a.count - b.count)
  }

  // ── 카카오 매장 검색 ────────────────────────────────────────
  function extractKakaoPlaceId(url: string): string | null {
    const match = url.match(/place\.map\.kakao\.com\/(\d+)/)
      || url.match(/map\.kakao\.com.*itemId=(\d+)/)
      || url.match(/kakaomap.*place\/(\d+)/)
    return match ? match[1] : null
  }

  async function searchPlace(query: string) {
    if (!query.trim()) return
    setSearchingPlace(true)
    setPlaceResults([])
    try {
      const placeId = extractKakaoPlaceId(query)
      if (placeId) {
        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
          { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
        )
        const data: any = await res.json()
        if (data.documents?.length) {
          selectPlace(data.documents[0])
          return
        }
      }
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&category_group_code=FD6,CE7&size=5`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )
      const data: any = await res.json()
      setPlaceResults(data.documents || [])
      if (!data.documents?.length) {
        toast.error('검색 결과가 없습니다')
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
    toast.success(`${place.place_name} 정보가 입력되었습니다`)
  }

  // ── 저장 ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name || !form.price) {
      toast.error('상품명과 원가는 필수입니다')
      return
    }

    if (kind === 'meal_voucher' && !form.restaurant_name) {
      toast.error('식사권은 맛집 이름이 필수입니다')
      return
    }

    if (tiers.length === 0) {
      toast.error('최소 1개의 티어가 필요합니다')
      return
    }

    const sorted = sortedTiers()
    const maxTierCount = sorted[sorted.length - 1].count

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        name: form.name,
        description: form.description || '',
        image: form.image_url,
        image_url: form.image_url,
        price: form.price,
        stock: form.stock,
        category: 'group_buy',
        group_buy_tiers: sorted,
        group_buy_deadline: form.group_buy_deadline || null,
        group_buy_target: maxTierCount,
      }

      if (kind === 'meal_voucher' && form.restaurant_name) {
        payload.product_type = 'meal_voucher'
        payload.restaurant_name = form.restaurant_name
        payload.restaurant_address = form.restaurant_address
        payload.restaurant_phone = form.restaurant_phone
        payload.restaurant_lat = form.restaurant_lat ? parseFloat(form.restaurant_lat) : null
        payload.restaurant_lng = form.restaurant_lng ? parseFloat(form.restaurant_lng) : null
      }

      const res = await api.post('/api/seller/products', payload, { headers })
      if (res.data.success) {
        toast.success('공동구매 상품이 등록되었습니다!')
        navigate('/seller/products')
      } else {
        toast.error(res.data.error || '등록 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '등록에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 미리보기 계산 ────────────────────────────────────────────
  const previewTiers = sortedTiers()

  return (
    <SellerLayout title="공동구매 만들기">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 상품 유형 선택 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-gray-900" />
              <h2 className="text-base font-bold text-gray-900">상품 유형</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKind('generic')}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  kind === 'generic'
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">일반 상품</p>
                <p className="text-xs text-gray-500 mt-1">맛집 없이 공동구매</p>
              </button>
              <button
                type="button"
                onClick={() => setKind('meal_voucher')}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  kind === 'meal_voucher'
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">식사권</p>
                <p className="text-xs text-gray-500 mt-1">맛집 연동 공동구매</p>
              </button>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-gray-900" />
              <h2 className="text-base font-bold text-gray-900">상품 정보</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label>
                <input
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="예: 프리미엄 원두 커피 공동구매"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품 설명</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="상품의 특징, 이용 방법 등을 입력해주세요"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    대표 이미지 URL
                  </span>
                </label>
                <input
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                />
                {form.image_url && (
                  <img src={form.image_url} alt="" className="mt-2 w-32 h-32 rounded-lg object-cover border border-gray-200" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">원가 (원) *</label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => update('price', Number(e.target.value))}
                    placeholder="30000"
                    min={0}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">최대 참여자 수</label>
                  <input
                    type="number"
                    value={form.stock || ''}
                    onChange={e => update('stock', Number(e.target.value))}
                    placeholder="100"
                    min={1}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 식당 정보 (meal_voucher 전용) */}
          {kind === 'meal_voucher' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-gray-900" />
                <h2 className="text-base font-bold text-gray-900">식당 정보</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <label className="block text-sm font-bold text-gray-900 mb-2">카카오맵에서 매장 찾기</label>
                  <p className="text-[11px] text-gray-500 mb-3">매장 이름이나 카카오맵 링크를 붙여넣으면 자동으로 입력됩니다</p>
                  <div className="flex gap-2">
                    <input
                      value={placeQuery}
                      onChange={e => setPlaceQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlace(placeQuery))}
                      placeholder="매장 이름 또는 카카오맵 링크"
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:border-gray-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => searchPlace(placeQuery)}
                      disabled={searchingPlace || !placeQuery.trim()}
                      className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold shrink-0 active:scale-95 disabled:opacity-50"
                    >
                      {searchingPlace ? '검색 중...' : '검색'}
                    </button>
                  </div>

                  {placeResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-white">
                      {placeResults.map((p: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectPlace(p)}
                          className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <MapPin className="w-4 h-4 text-gray-700 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{p.place_name}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{p.road_address_name || p.address_name}</p>
                            {p.phone && <p className="text-[11px] text-gray-400 mt-0.5">{p.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {placeSelected && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
                      <CheckCircle className="w-3.5 h-3.5" />
                      매장 정보가 자동 입력되었습니다
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">맛집 이름 *</label>
                  <input
                    value={form.restaurant_name}
                    onChange={e => update('restaurant_name', e.target.value)}
                    placeholder="자동 입력 또는 직접 입력"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    required={kind === 'meal_voucher'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                  <input
                    value={form.restaurant_address}
                    onChange={e => update('restaurant_address', e.target.value)}
                    placeholder="자동 입력 또는 직접 입력"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    value={form.restaurant_phone}
                    onChange={e => update('restaurant_phone', e.target.value)}
                    placeholder="자동 입력 또는 직접 입력"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 티어 설정 (핵심) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-900" />
                <h2 className="text-base font-bold text-gray-900">티어 설정</h2>
              </div>
              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                티어 추가
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              모인 인원에 따라 할인율이 증가합니다. 예: 2명 10%, 5명 30%, 10명 50%
            </p>

            <div className="space-y-3">
              {tiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="w-7 h-7 flex items-center justify-center bg-gray-900 text-white text-xs font-bold rounded-full shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">목표 인원</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tier.count || ''}
                          onChange={e => updateTier(idx, 'count', Number(e.target.value))}
                          min={1}
                          className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:border-gray-900 focus:outline-none"
                          placeholder="2"
                        />
                        <span className="text-xs text-gray-500 shrink-0">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">할인율</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={tier.discount || ''}
                          onChange={e => updateTier(idx, 'discount', Number(e.target.value))}
                          min={0}
                          max={100}
                          className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:border-gray-900 focus:outline-none"
                          placeholder="10"
                        />
                        <span className="text-xs text-gray-500 shrink-0">%</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-200 shrink-0"
                    title="제거"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 마감 시간 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-900" />
              <h2 className="text-base font-bold text-gray-900">마감 시간</h2>
            </div>
            <input
              type="datetime-local"
              value={form.group_buy_deadline}
              onChange={e => update('group_buy_deadline', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <p className="text-[11px] text-gray-500 mt-2">
              이 시간 이후 도달한 최고 티어로 공동구매가 마감됩니다
            </p>
          </div>

          {/* 미리보기 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-900 mb-3">미리보기</p>
            <p className="text-xs text-gray-600 mb-3">
              {form.name || '상품명 미입력'} ·{' '}
              {form.price ? ` ${form.price.toLocaleString()}원` : ' 원가 미입력'}
              {kind === 'meal_voucher' && form.restaurant_name && ` · ${form.restaurant_name}`}
            </p>
            {previewTiers.length > 0 && form.price > 0 && (
              <div className="space-y-1.5">
                {previewTiers.map((tier, i) => {
                  const discounted = Math.round(form.price * (1 - tier.discount / 100))
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">
                        {tier.count}명 달성 → {tier.discount}% 할인
                      </span>
                      <span className="font-bold text-gray-900">
                        {discounted.toLocaleString()}원
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/seller/products')}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] py-3 bg-gray-900 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}
