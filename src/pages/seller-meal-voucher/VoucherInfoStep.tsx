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
import VoucherPhotoSection from './VoucherPhotoSection'
import CardPreview from './CardPreview'
import type { VoucherCategory, VoucherForm } from './voucher-form'

interface Props {
  form: VoucherForm
  update: (key: string, value: string | number | string[]) => void
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
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <c.Icon className="w-6 h-6 mx-auto mb-1 text-gray-500" aria-hidden="true" />
              <div className={`text-xs font-bold ${form.category === c.key ? 'text-pink-700' : 'text-gray-900'}`}>{c.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 이용권 정보 */}
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
                    className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
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

      {/* 📸 사진 — 2026-09-03 대표 시안 승인: 지도/내 파일 두 길만 위에, 나머지는 누른 뒤에. */}
      <VoucherPhotoSection
        form={form}
        update={update}
        suggestedImages={suggestedImages}
        loadingImages={loadingImages}
        onSearchImages={onSearchImages}
      />

      {/* 👀 입력하는 대로 소비자 카드가 어떻게 보일지 실시간 반영 */}
      <CardPreview form={form} />
    </div>
  )
}
