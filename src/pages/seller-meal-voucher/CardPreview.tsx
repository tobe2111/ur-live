/**
 * 👀 소비자 카드 실시간 미리보기 (2026-08-23)
 *   소비자 피드 카드의 그루폰식 위계를 거울처럼 그린다:
 *   [커버 이미지 + 할인 pill] → 머천트 → 제목 → 주소 → 정가취소선·판매가.
 *
 *   ⚠️ 실제 GroupBuyFeedCard 를 직접 렌더하지 않는 이유: 그 컴포넌트는 hover/viewport
 *   prefetch 가 잠금 계약이라, 아직 존재하지 않는 상품 id 로 `/api/group-buy/products/…`
 *   허수 요청을 쏘게 된다. 여기는 **모양만** 미러하는 자기완결 프리뷰다.
 *
 *   🎨 2026-08-26 (대표 — "미리보기가 왜 다크모드로 나와? 테마에 맞게"): 어두운 배경을 하드코딩했는데
 *   ① 셀러 대시보드는 **라이트 고정**이라 그 블록만 검게 떠서 튀고 ② 소비자 피드 카드도 기본은
 *   라이트다(`bg-gray-100 dark:bg-[#222225]` — 다크는 사용자 토글). 대시보드 규칙상 여기엔
 *   `dark:` variant 를 쓸 수 없으므로(check-dashboard-theme) **라이트 단일**로 그린다.
 */
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import type { VoucherForm } from './voucher-form'

export default function CardPreview({ form }: { form: VoucherForm }) {
  const { t } = useTranslation()
  const discount = form.original_price > form.price && form.price > 0
    ? Math.round((1 - form.price / form.original_price) * 100)
    : 0

  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
      <p className="text-[11px] font-bold text-gray-500 mb-3">
        📱 {t('seller.mealVoucher.previewTitle', { defaultValue: '소비자 화면 미리보기' })}
      </p>
      <div className="max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm">
        {/* 커버 — 이미지가 없으면 자리 표시 */}
        <div className="relative aspect-[4/3] bg-gray-100">
          {form.image_url ? (
            <img src={form.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🎟️</div>
          )}
          {discount > 0 && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-brand text-white text-[11px] font-extrabold">
              {discount}%
            </span>
          )}
        </div>
        <div className="p-3">
          {/* 머천트 → 제목 → 주소 → 가격 (그루폰 위계) */}
          <p className="text-[11px] font-semibold text-gray-500 truncate">
            {form.restaurant_name || t('seller.mealVoucher.restaurantPlaceholder')}
          </p>
          <p className="text-[13px] font-bold text-gray-900 mt-0.5 line-clamp-2 leading-snug">
            {form.name || t('seller.mealVoucher.namePlaceholder')}
          </p>
          {form.restaurant_address && (
            <p className="text-[10px] text-gray-400 mt-1 truncate flex items-center gap-0.5">
              <MapPin className="w-3 h-3 shrink-0" /> {form.restaurant_address}
            </p>
          )}
          <div className="flex items-baseline gap-1.5 mt-2">
            {discount > 0 && (
              <span className="text-[11px] text-gray-400 line-through">{formatNumber(form.original_price)}{t('common.won')}</span>
            )}
            <span className="text-[15px] font-extrabold text-gray-900">
              {form.price > 0 ? `${formatNumber(form.price)}${t('common.won')}` : t('seller.mealVoucher.priceUndecided')}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {form.voucher_expiry
              ? `~${form.voucher_expiry}`
              : t('seller.mealVoucher.noExpiry', { defaultValue: '유효기간 제한 없음' })}
          </p>
        </div>
      </div>
    </div>
  )
}
