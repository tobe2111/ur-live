import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin, Phone, Users, Utensils, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import KakaoMapPicker, { type KakaoPlace } from '@/components/KakaoMapPicker'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

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
    // 🛡️ 2026-04-28: voucher 카테고리 (식사/뷰티/헬스) — 같은 인프라 재활용
    category: 'meal_voucher' as 'meal_voucher' | 'beauty_voucher' | 'health_voucher' | 'pet_voucher' | 'stay_voucher' | 'activity_voucher',
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
  const [suggestedImages, setSuggestedImages] = useState<string[]>([])
  const [loadingImages, setLoadingImages] = useState(false)

  if (!isSellerAuthenticated()) { redirectToLogin(navigate); return null }

  const token = getSellerToken()
  const headers = { Authorization: `Bearer ${token}` }

  const KAKAO_JS_KEY = import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY || ''

  function selectPlace(place: KakaoPlace) {
    setForm(f => ({
      ...f,
      restaurant_name: place.place_name || f.restaurant_name,
      restaurant_address: place.road_address_name || place.address_name || '',
      restaurant_phone: place.phone || '',
      restaurant_lat: place.y || '',
      restaurant_lng: place.x || '',
    }))
    setPlaceSelected(true)
    toast.success(t('seller.mealVoucher.placeAutoFilled', { name: place.place_name }))

    // 네이버 이미지 검색으로 맛집 사진 추천
    // 🛡️ 2026-04-27: 검색 정확도 개선 — 주소 단어를 너무 많이 포함하면 일반적인 '서울 맛집' 같은 이미지가 섞임.
    //               place_name 만 가장 specific. 동(洞) 단어 1개만 보조 (e.g. '강남유나이트 역삼동').
    if (place.place_name) {
      setLoadingImages(true)
      const fullAddr = place.road_address_name || place.address_name || ''
      const dongMatch = fullAddr.match(/[가-힣]+(동|읍|면|로|길)\s*\d*/)
      const dong = dongMatch ? dongMatch[0].replace(/\s*\d+/, '') : ''
      const searchQuery = dong ? `${place.place_name} ${dong}` : place.place_name
      api.get(`/api/naver/image/search?query=${encodeURIComponent(searchQuery)}&display=9`)
        .then(res => {
          if (res.data.success && res.data.data?.items) {
            setSuggestedImages(res.data.data.items.map((img: any) => (img.link || '').replace(/^http:\/\//, 'https://')).filter(Boolean))
          }
        })
        .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
        .finally(() => setLoadingImages(false))
    }
  }

  function openKakaoAddress() {
    // 다음 우편번호 서비스 (주소 검색 팝업) — external Kakao SDK, window cast acceptable
    const w = window as unknown as { daum?: { Postcode: new (opts: { oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void }) => { open: () => void } } }
    if (!w.daum?.Postcode) {
      const script = document.createElement('script')
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.onload = () => openKakaoAddress()
      document.head.appendChild(script)
      return
    }
    new w.daum.Postcode({
      oncomplete: async (data) => {
        const addr = data.roadAddress || data.jibunAddress
        update('restaurant_address', addr)
        // 주소 → 좌표 변환
        try {
          const res = await fetch(`/api/kakao/place/address?query=${encodeURIComponent(addr)}`)
          const result: { data?: { documents?: { y: string; x: string }[] } } = await res.json()
          if (result.data?.documents?.[0]) {
            update('restaurant_lat', result.data.documents[0].y)
            update('restaurant_lng', result.data.documents[0].x)
          }
        } catch { /* ignore geocoding failure */ }
      }
    }).open()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name || !form.price || !form.restaurant_name) {
      toast.error(t('seller.mealVoucher.requiredFields'))
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || `${form.restaurant_name} ${t('seller.mealVoucher.voucherSuffix')}`,
        price: form.price,
        original_price: form.original_price || form.price,
        image_url: form.image_url,
        category: form.category,
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
        toast.success(t('seller.mealVoucher.registered'))
        navigate('/seller/group-buy')
      } else {
        toast.error(res.data.error || t('seller.mealVoucher.registerFailed'))
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr?.response?.data?.error || t('seller.mealVoucher.registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const update = (key: string, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  return (
    <SellerLayout title={t('seller.mealVoucher.title')}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.mealVoucher.title')}
          subtitle={t('seller.mealVoucher.subtitle', { defaultValue: '식사권/공동구매 상품 등록' })}
          icon={<Utensils className="h-5 w-5" />}
        />
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 🛡️ 2026-04-28: voucher 카테고리 (식사/뷰티/헬스) — 같은 인프라 재활용 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-gray-900">
                {t('seller.voucher.categoryTitle', { defaultValue: '공구권 종류' })}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'meal_voucher' as const, emoji: '🍽️', label: '식사 공구권', desc: '맛집·카페' },
                { key: 'beauty_voucher' as const, emoji: '💇', label: '뷰티 공구권', desc: '헤어·네일·피부' },
                { key: 'health_voucher' as const, emoji: '💪', label: '헬스 공구권', desc: 'PT·요가·필라테스' },
                { key: 'pet_voucher' as const, emoji: '🐶', label: '반려 공구권', desc: '미용·호텔·병원' },
                { key: 'stay_voucher' as const, emoji: '🏨', label: '숙박 공구권', desc: '펜션·호텔·모텔' },
                { key: 'activity_voucher' as const, emoji: '🎯', label: '액티비티 공구권', desc: '방탈출·볼링·클래스' },
              ].map(c => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setForm(f => ({ ...f, category: c.key }))}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    form.category === c.key
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{c.emoji}</div>
                  <div className={`text-xs font-bold ${form.category === c.key ? 'text-pink-700' : 'text-gray-900'}`}>{c.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 1. 맛집 정보 — 카카오맵 검색 (가장 위) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.restaurantInfo')}</h2>
            </div>

            <div className="space-y-4">
              {/* 카카오맵 매장 검색 (지도 시각화) */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-900">🗺️ {t('seller.mealVoucher.findOnMap')}</label>
                    <p className="text-[11px] text-gray-500 mt-0.5">{t('seller.mealVoucher.findOnMapDesc')}</p>
                  </div>
                  {placeSelected && (
                    <div className="flex items-center gap-1 text-xs text-green-600 shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('seller.mealVoucher.selected')}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.restaurantNameLabel')} *</label>
                <input
                  value={form.restaurant_name}
                  onChange={e => update('restaurant_name', e.target.value)}
                  placeholder={t('seller.mealVoucher.restaurantNamePlaceholder')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.addressLabel')}</label>
                <div className="flex gap-2">
                  <input
                    value={form.restaurant_address}
                    onChange={e => update('restaurant_address', e.target.value)}
                    placeholder={t('seller.mealVoucher.addressPlaceholder')}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => openKakaoAddress()}
                    className="px-3 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium shrink-0 active:scale-95"
                  >
                    {t('seller.mealVoucher.postalCode')}
                  </button>
                </div>
                {form.restaurant_lat && form.restaurant_lng && (
                  <p className="text-[10px] text-green-600 mt-1">
                    ✓ {t('seller.mealVoucher.coordinates')}: {Number(form.restaurant_lat).toFixed(6)}, {Number(form.restaurant_lng).toFixed(6)} ({t('seller.mealVoucher.shownOnMap')})
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.phoneLabel')}</label>
                  <input
                    value={form.restaurant_phone}
                    onChange={e => update('restaurant_phone', e.target.value)}
                    placeholder={t('seller.mealVoucher.addressPlaceholder')}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('seller.mealVoucher.storeVerifyPin')} <span className="text-xs text-gray-400">(선택)</span>
                  </label>
                  <input
                    value={form.store_verify_pin}
                    onChange={e => update('store_verify_pin', e.target.value)}
                    placeholder={t('seller.mealVoucher.pinPlaceholder')}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    💡 식당 전화번호를 입력하시면 사장님께 통계 페이지 링크가 알림톡으로 자동 발송됩니다 (PIN 불필요).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 추천 이미지 (맛집 선택 후 표시) */}
          {(loadingImages || suggestedImages.length > 0 || form.image_url) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📸</span>
                <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.mainImage')}</h2>
              </div>
              <p className="text-[11px] text-gray-500 mb-4">AI 추천이라 정확하지 않을 수 있어요. 마음에 드는 게 없으면 아래에서 직접 검색하거나 파일을 업로드하세요.</p>

              <div className="space-y-3">
                {/* 미리보기 */}
                {form.image_url && (
                  <div className="relative inline-block">
                    <img src={form.image_url} alt="대표 이미지" className="w-full max-w-[240px] h-48 rounded-lg object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => update('image_url', '')}
                      aria-label="이미지 제거"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
                    >✕</button>
                  </div>
                )}

                {/* URL 입력 */}
                <input
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder={t('seller.mealVoucher.imageUrlPlaceholder')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />

                {/* 직접 업로드 + 직접 검색 */}
                <div className="flex gap-2 flex-wrap">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-pink-50 border border-pink-200 text-pink-600 text-xs font-semibold rounded-lg hover:bg-pink-100">
                    📁 내 사진 업로드
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 5 * 1024 * 1024) { toast.error(t('seller.mealVoucher.imageSizeLimit', { defaultValue: '5MB 이하 이미지만 업로드 가능합니다' })); return }
                        const r = new FileReader()
                        r.onload = () => { update('image_url', r.result as string); toast.success(t('common.uploadComplete', { defaultValue: '업로드 완료' })) }
                        r.readAsDataURL(f)
                      }}
                    />
                  </label>
                  <input
                    placeholder="다른 키워드로 이미지 재검색 (예: 가게 인테리어, 대표 메뉴 이름)"
                    className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-pink-500 focus:outline-none"
                    onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return
                      const q = (e.target as HTMLInputElement).value.trim()
                      if (!q) return
                      setLoadingImages(true)
                      try {
                        const res = await api.get(`/api/naver/image/search?query=${encodeURIComponent(q)}&display=9`)
                        if (res.data.success && res.data.data?.items) {
                          setSuggestedImages(res.data.data.items.map((img: { link?: string }) => (img.link || '').replace(/^http:\/\//, 'https://')).filter(Boolean))
                        }
                      } catch { toast.error(t('seller.mealVoucher.imageSearchFailed', { defaultValue: '이미지 검색 실패' })) }
                      finally { setLoadingImages(false) }
                    }}
                  />
                </div>

                {loadingImages && (
                  <p className="text-xs text-gray-500">{t('seller.mealVoucher.searchingImages')}</p>
                )}
                {suggestedImages.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">{t('seller.mealVoucher.suggestedImages')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {suggestedImages.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { update('image_url', url); toast.success(t('seller.mealVoucher.imageSelected')) }}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            form.image_url === url ? 'border-pink-500 ring-2 ring-pink-200' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. 식사권 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-pink-500" />
              <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.voucherInfo')}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.voucherNameLabel')} *</label>
                <input
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder={t('seller.mealVoucher.voucherNamePlaceholder')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder={t('seller.mealVoucher.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.sellingPrice')} *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.originalPrice')}</label>
                  <input
                    type="number"
                    value={form.original_price || ''}
                    onChange={e => update('original_price', Number(e.target.value))}
                    placeholder="50000"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. 공동구매 설정 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.groupBuySettings')}</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.targetPeople')}</label>
                  <input
                    type="number"
                    value={form.group_buy_target || ''}
                    onChange={e => update('group_buy_target', Number(e.target.value))}
                    placeholder="10"
                    min={0}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{t('seller.mealVoucher.zeroMeansDirectSale')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.stockQuantity')}</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.groupBuyDeadline')}</label>
                  <input
                    type="datetime-local"
                    value={form.group_buy_deadline}
                    onChange={e => update('group_buy_deadline', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.voucherExpiry')}</label>
                  <input
                    type="date"
                    value={form.voucher_expiry}
                    onChange={e => update('voucher_expiry', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.usageTerms')}</label>
                <textarea
                  value={form.voucher_terms}
                  onChange={e => update('voucher_terms', e.target.value)}
                  placeholder={t('seller.mealVoucher.usageTermsPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* 미리보기 */}
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
            <p className="text-sm font-bold text-pink-700 mb-2">📋 {t('seller.mealVoucher.preview')}</p>
            <p className="text-xs text-pink-600">
              {form.name || t('seller.mealVoucher.namePlaceholder')} · {form.restaurant_name || t('seller.mealVoucher.restaurantPlaceholder')} ·
              {form.price ? ` ${form.price.toLocaleString()}${t('common.won')}` : ` ${t('seller.mealVoucher.priceUndecided')}`}
              {form.original_price > form.price && ` (${t('seller.mealVoucher.originalPriceShort')} ${form.original_price.toLocaleString()}${t('common.won')}, ${Math.round((1 - form.price / form.original_price) * 100)}% ${t('seller.mealVoucher.discount')})`}
              {form.group_buy_target > 0 && ` · ${t('seller.mealVoucher.targetCount', { count: form.group_buy_target })}`}
            </p>
          </div>

          {/* 등록 버튼 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/seller/group-buy')}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] py-3 bg-pink-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? t('seller.registering') : t('seller.mealVoucher.registerSubmit')}
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}
