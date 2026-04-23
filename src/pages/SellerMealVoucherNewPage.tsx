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
    if (place.place_name) {
      setLoadingImages(true)
      const area = (place.road_address_name || place.address_name || '').split(' ').slice(0, 2).join(' ')
      const searchQuery = area ? `${place.place_name} ${area}` : `${place.place_name} 맛집`
      api.get(`/api/naver/image/search?query=${encodeURIComponent(searchQuery)}&display=6`)
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
          subtitle={t('seller.mealVoucher.subtitle') || '식사권/공동구매 상품 등록'}
          icon={<Utensils className="h-5 w-5" />}
        />
        <form onSubmit={handleSubmit} className="space-y-6">

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.storeVerifyPin')}</label>
                  <input
                    value={form.store_verify_pin}
                    onChange={e => update('store_verify_pin', e.target.value)}
                    placeholder={t('seller.mealVoucher.pinPlaceholder')}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{t('seller.mealVoucher.pinDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 추천 이미지 (맛집 선택 후 표시) */}
          {(loadingImages || suggestedImages.length > 0 || form.image_url) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📸</span>
                <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.mainImage')}</h2>
              </div>

              <div className="space-y-3">
                <input
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder={t('seller.mealVoucher.imageUrlPlaceholder')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />
                {form.image_url && (
                  <img src={form.image_url} alt="" className="w-full max-w-[200px] h-40 rounded-lg object-cover" />
                )}
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
