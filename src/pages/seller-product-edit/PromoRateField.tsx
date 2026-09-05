/**
 * 소개비(promo %) 입력 — **등록 화면과 관리 화면이 같은 것을 쓴다.**
 *
 * 🩸 2026-09-05: 이 레버가 **등록 화면에만** 있었다. 이용권을 한 번 올리고 나면 소개비를 영영 못
 *   바꿨다는 뜻이다 — "이번 주 안 팔리네, 소개비 올려서 더 많이 소개되게 하자" 가 불가능했다.
 *   가격·재고는 다 고칠 수 있는데 마케팅 예산만 못 고치는 건 앞뒤가 안 맞는다.
 *
 * ⚠️ **이중 게이트**(둘 다 통과해야 실제로 저장된다):
 *   ① 화면: `SELLER_PROMO_FIELD_ENABLED`(현재 false — 아예 안 그려진다)
 *   ② 서버: `platform_settings.seller_promo_field_enabled === 'true'`
 *   재원이 아직 플랫폼 부담(`promo_funding_source ≠ 'owner'`)인 동안 열면 **매장이 건 소개비를
 *   유어딜이 대신 문다.** 순서는 재원 전환이 먼저다(commission-funding-restructure.md §1).
 */
import { useTranslation } from 'react-i18next'
import { SELLER_PROMO_FIELD_ENABLED } from '@/shared/feature-flags'
import PromoMarginCalculator, { promoGuideFor } from '../seller-product-new/PromoMarginCalculator'

/** 서버(분수 0.05) → 화면(퍼센트 5). referral_enabled=0 이면 소개비 없음. */
export function promoPctFromProduct(p: { referral_enabled?: unknown; referral_commission_rate?: unknown }): number {
  if (Number(p.referral_enabled) === 0) return 0
  return Math.round(Number(p.referral_commission_rate || 0) * 100)
}
/** 화면(퍼센트) → 서버(분수). 최종 판단은 서버 게이트가 한다. */
export function promoRateForSubmit(pct: number | string): number {
  return Math.max(0, Math.min(0.5, Number(pct || 0) / 100))
}

interface Props {
  /** 0~50 정수 퍼센트. 저장 시 /100 해서 분수로 보낸다(서버 clamp 0~0.5). */
  promoPct: number
  onChange: (pct: number) => void
  price: number
  originalPrice?: number
  category: string
}

export default function PromoRateField({ promoPct, onChange, price, originalPrice, category }: Props) {
  const { t } = useTranslation()
  if (!SELLER_PROMO_FIELD_ENABLED) return null
  const guide = promoGuideFor(category)

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('seller.mealVoucher.promoLabel', { defaultValue: '추천 소개비 (%)' })}
          <span className="ml-2 text-[11px] font-normal text-gray-400">
            {t('seller.mealVoucher.promoRecommend', {
              defaultValue: `권장 ${guide.min}~${guide.max}%`, min: guide.min, max: guide.max,
            })}
          </span>
        </label>
        <div className="relative">
          <input
            type="number" min={0} max={50} step={1}
            value={promoPct || ''}
            onChange={e => onChange(Math.max(0, Math.min(50, Number(e.target.value))))}
            placeholder="0"
            className="w-full px-3 py-2.5 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
        </div>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          {t('seller.mealVoucher.promoHint', { defaultValue: '누군가 내 이용권을 소개해 팔아 주면 이 비율만큼 소개비를 지급해요. 할인과 함께 하나의 마케팅 예산으로 설계하세요. 소개 판매가 없으면 발생하지 않아요.' })}
        </p>
      </div>
      <PromoMarginCalculator price={price} originalPrice={originalPrice} promoPct={promoPct} category={category} />
    </div>
  )
}
