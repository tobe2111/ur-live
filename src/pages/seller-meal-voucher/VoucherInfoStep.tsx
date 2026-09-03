/**
 * 🎟️ 위저드 2단계 — 이용권 정보 (종류·이름·가격·사진·실수령가)
 *   기존 SellerMealVoucherNewPage 의 해당 블록을 그대로 추출 — 로직 불변, 배치만 위저드.
 */
import { useTranslation } from 'react-i18next'
import { BedDouble, PartyPopper, Scissors, Utensils } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import { toast } from '@/hooks/useToast'
import { compressForUpload } from '@/lib/image-compress'
import { SELLER_PROMO_FIELD_ENABLED } from '@/shared/feature-flags'
import NetProceedsCard from './NetProceedsCard'
import PromoMarginCalculator, { promoGuideFor } from '../seller-product-new/PromoMarginCalculator'
import SellerVoucherPhotoGuide from '@/components/SellerVoucherPhotoGuide'
import CardPreview from './CardPreview'
import type { VoucherCategory, VoucherForm } from './voucher-form'

interface Props {
  form: VoucherForm
  update: (key: string, value: string | number) => void
  setCategory: (c: VoucherCategory) => void
  suggestedImages: string[]
  loadingImages: boolean
  onSearchImages: (query: string) => void
}

export default function VoucherInfoStep({ form, update, setCategory, suggestedImages, loadingImages, onSearchImages }: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      {/* 이용권 종류 (식사/뷰티/헬스/반려/숙박/액티비티) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-gray-900">
            {t('seller.voucher.categoryTitle', { defaultValue: '이용권 종류' })}
          </h2>
        </div>
        {/* 🗂️ 실제로 존재하는 4종만 — 2026-09-02 전수조사.
            종전엔 6개를 보여줬는데 health/pet/activity 는 2026-05-17 통합으로 사라진 값이라
            서버가 저장 직전 접어 넣었다(헬스→미용 · 반려/액티비티→기타). 셀러는 고른 것과
            **다른 카테고리로 등록되는 줄 몰랐다**(에러가 없으니 알 길도 없었다).
            없어진 종류가 어디로 갔는지는 설명(desc)에 남긴다 — 고를 수 있다고 말하지만 않는다. */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'meal_voucher' as const, Icon: Utensils, label: t('seller.voucher.categoryMeal', { defaultValue: '식사 이용권' }), desc: t('seller.voucher.categoryMealDesc', { defaultValue: '맛집·카페' }) },
            { key: 'beauty_voucher' as const, Icon: Scissors, label: t('seller.voucher.categoryBeauty', { defaultValue: '미용 이용권' }), desc: t('seller.voucher.categoryBeautyDesc', { defaultValue: '헤어·네일·피부·PT·요가' }) },
            { key: 'stay_voucher' as const, Icon: BedDouble, label: t('seller.voucher.categoryStay', { defaultValue: '숙박 이용권' }), desc: t('seller.voucher.categoryStayDesc', { defaultValue: '펜션·호텔·모텔' }) },
            { key: 'etc_voucher' as const, Icon: PartyPopper, label: t('seller.voucher.categoryEtc', { defaultValue: '기타 이용권' }), desc: t('seller.voucher.categoryEtcDesc', { defaultValue: '반려·액티비티·클래스' }) },
          ].map(c => (
            <button
              type="button"
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                form.category === c.key
                  ? 'border-brand bg-brand-tint'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <c.Icon className="w-6 h-6 mx-auto mb-1 text-gray-500" aria-hidden="true" />
              <div className={`text-xs font-bold ${form.category === c.key ? 'text-brand-text' : 'text-gray-900'}`}>{c.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 이용권 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Utensils className="w-5 h-5 text-brand-text" />
          <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.voucherInfo')}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.voucherNameLabel')} *</label>
            <input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder={t('seller.mealVoucher.voucherNamePlaceholder')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none"
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none resize-none"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* 💰 판매 1건당 실수령가 — 항상 표시(채널별 수수료 SSOT). */}
          <NetProceedsCard price={form.price} promoPct={form.promo_pct} />

          {/* 💰 소개비(promo)% + 매장 실수령 계산기 — SELLER_PROMO_FIELD_ENABLED 게이트. */}
          {SELLER_PROMO_FIELD_ENABLED && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('seller.mealVoucher.promoLabel', { defaultValue: '추천 소개비 (%)' })}
                  <span className="ml-2 text-[11px] font-normal text-gray-400">
                    {t('seller.mealVoucher.promoRecommend', {
                      defaultValue: `권장 ${promoGuideFor(form.category).min}~${promoGuideFor(form.category).max}%`,
                      min: promoGuideFor(form.category).min, max: promoGuideFor(form.category).max,
                    })}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number" min={0} max={50} step={1}
                    value={form.promo_pct || ''}
                    onChange={e => update('promo_pct', Math.max(0, Math.min(50, Number(e.target.value))))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  {t('seller.mealVoucher.promoHint', { defaultValue: '누군가 내 이용권을 소개해 팔아 주면 이 비율만큼 소개비를 지급해요. 할인과 함께 하나의 마케팅 예산으로 설계하세요. 소개 판매가 없으면 발생하지 않아요.' })}
                </p>
              </div>
              <PromoMarginCalculator
                price={form.price}
                originalPrice={form.original_price}
                promoPct={form.promo_pct}
                category={form.category}
              />
            </div>
          )}
        </div>
      </div>

      {/* 대표 이미지 — 매장 선택 시 추천 이미지가 자동으로 도착 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📸</span>
          <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.mainImage')}</h2>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">{t('seller.mealVoucher.imageAiNotice', { defaultValue: '마음에 드는 게 없으면 아래에서 직접 검색하거나 파일을 업로드하세요.' })}</p>
        <SellerVoucherPhotoGuide />

        <div className="space-y-3">
          {form.image_url && (
            <div className="relative inline-block">
              <img src={form.image_url} alt={t('seller.mealVoucher.mainImage', { defaultValue: '대표 이미지' })} className="w-full max-w-[240px] h-48 rounded-lg object-cover border border-gray-200" loading="lazy" />
              <button
                type="button"
                onClick={() => update('image_url', '')}
                aria-label={t('common.removeImage', { defaultValue: '이미지 제거' })}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
              >✕</button>
            </div>
          )}

          <input
            value={form.image_url}
            onChange={e => update('image_url', e.target.value)}
            placeholder={t('seller.mealVoucher.imageUrlPlaceholder')}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none"
          />
          {/* 🗺️ 2026-08-26 (대표 "네이버지도·카카오맵에서도 사진 가져올 수 있게"): 매장 기준 사진 프리셋.
              네이버 이미지 검색(지도·플레이스·블로그 사진이 이 인덱스에 들어온다)을 매장명+동으로 좁혀 가져온다.
              ⚠️ 카카오맵은 공개 API 가 장소 사진을 주지 않는다 → 자동으로 못 끌어온다. 대신 그 매장의
              카카오맵 페이지를 열어 주고, 거기서 고른 사진 주소를 위 칸에 붙여넣게 한다(정직한 한계 표기). */}
          {form.restaurant_name && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-[11px] font-bold text-gray-700 mb-1.5">
                🗺️ {t('seller.mealVoucher.fromMap', { defaultValue: '지도에서 매장 사진 가져오기' })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'place', label: t('seller.mealVoucher.mapPhotoPlace', { defaultValue: '매장 사진' }), suffix: '' },
                  { key: 'food', label: t('seller.mealVoucher.mapPhotoFood', { defaultValue: '음식·메뉴' }), suffix: '메뉴' },
                  { key: 'interior', label: t('seller.mealVoucher.mapPhotoInterior', { defaultValue: '매장 내부' }), suffix: '내부' },
                ].map(preset => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      const addr = form.restaurant_address || ''
                      const dong = addr.match(/[가-힣]+(동|읍|면|로|길)\s*\d*/)?.[0]?.replace(/\s*\d+/, '') || ''
                      onSearchImages([form.restaurant_name, dong, preset.suffix].filter(Boolean).join(' '))
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:border-gray-400"
                  >
                    {preset.label}
                  </button>
                ))}
                {form.kakao_place_url && (
                  <a
                    href={form.kakao_place_url}
                    target="_blank" rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:border-gray-400"
                  >
                    {t('seller.mealVoucher.openKakaoPlace', { defaultValue: '카카오맵에서 보기 ↗' })}
                  </a>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                {t('seller.mealVoucher.mapPhotoHint', { defaultValue: '네이버 지도·블로그 사진을 매장 이름으로 찾아 아래에 보여드려요. 카카오맵 사진은 자동으로 가져올 수 없어 페이지를 열어드립니다 — 마음에 드는 사진의 주소를 복사해 위 칸에 붙여넣으세요.' })}
              </p>
            </div>
          )}


          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-brand-tint border border-rule text-brand-text text-xs font-semibold rounded-lg hover:bg-brand-tint">
              {t('seller.mealVoucher.uploadPhoto', { defaultValue: '📁 내 사진 업로드' })}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 5 * 1024 * 1024) { toast.error(t('seller.mealVoucher.imageSizeLimit', { defaultValue: '5MB 이하 이미지만 업로드 가능합니다' })); return }
                  try {
                    // 클라이언트 압축 (CF Images 유료 회피, WebP 1280px ≤300KB)
                    const compressed = await compressForUpload(f, { maxSizeMB: 0.3, maxWidthOrHeight: 1280, toWebP: true })
                    // 🚀 2026-08-23: base64 를 DB 에 넣던 것 → R2 업로드(검증된 /api/upload/image) 후 URL 만 저장.
                    //   base64 는 상품 행·목록 응답·임시저장까지 수백 KB 를 끌고 다녔다. 업로드 실패 시에만
                    //   종전 data URL 로 폴백(등록 자체는 계속돼야 한다 — fail-soft).
                    try {
                      const fd = new FormData()
                      fd.append('file', new File([compressed], 'voucher.webp', { type: compressed.type || 'image/webp' }))
                      const token = getSellerToken()
                      const res = await api.post('/api/upload/image', fd, {
                        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'multipart/form-data' },
                      })
                      const url = res.data?.data?.url
                      if (!res.data?.success || !url) throw new Error(res.data?.error || 'upload failed')
                      update('image_url', url)
                      toast.success(t('common.uploadComplete', { defaultValue: '업로드 완료' }))
                    } catch {
                      const r = new FileReader()
                      r.onload = () => { update('image_url', r.result as string); toast.success(t('common.uploadComplete', { defaultValue: '업로드 완료' })) }
                      r.readAsDataURL(compressed)
                    }
                  } catch {
                    toast.error(t('common.uploadFailed', { defaultValue: '업로드 실패' }))
                  }
                }}
              />
            </label>
            <input
              placeholder={t('seller.mealVoucher.imageSearchPlaceholder', { defaultValue: '다른 키워드로 이미지 재검색 (예: 가게 인테리어, 대표 메뉴 이름)' })}
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-brand focus:outline-none"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const q = (e.target as HTMLInputElement).value.trim()
                if (q) onSearchImages(q)
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
                      form.image_url === url ? 'border-brand ring-2 ring-brand/40' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 👀 입력하는 대로 소비자 카드가 어떻게 보일지 실시간 반영 */}
      <CardPreview form={form} />
    </div>
  )
}
