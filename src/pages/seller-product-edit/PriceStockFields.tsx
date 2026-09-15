/**
 * 💰 판매가 · 정가 · 재고 — 상품 수정 화면의 가격 블록.
 *
 * 🐛 **왜 생겼나** (2026-09-14 대표 *"이용권 관리 맡아서 해줘"*): 수정 화면에 **정가 칸이 없었다.**
 *   등록 화면(`seller-meal-voucher/VoucherInfoStep`)은 정가와 판매가를 **둘 다** 받는데,
 *   수정 화면은 판매가만 보냈다 — 서버 `PUT /api/seller/products/:id` 는 `original_price` 를
 *   검증(0~1억)하고 저장까지 하는데(seller-orders.routes `original_price = ?`) **화면이 안 보낸 것**이다.
 *   결과: 한 번 등록하면 정가를 영영 못 고치고, 정가가 곧 할인율이라 **표시 할인율이 박제**된다.
 *   라이브 실측(2026-09-14): 셀러 소유 활성 이용권 1건(홍대돈까스 16,500 / 정가 25,000 = 34%).
 *
 * 🔒 **정가는 표시 전용이다 — 청구에 안 닿는다.** 실제 청구액은 판매가(`price`)와 공구 특가로
 *   정해지고, 청구 경로는 정가를 아예 `null` 로 넘긴다(`worker/utils/gb-order-pricing.ts` 의
 *   `resolveGbPricing(s, list, null, …)`). 할인율 표시 규칙 SSOT 는 `shared/price-display.ts`.
 *   ⇒ 이 칸을 잘못 넣어도 사람이 더 내거나 덜 내지 않는다. 틀리면 **할인율 배지가 거짓말**을 한다.
 *
 * ⚠️ 이 파일이 따로 있는 이유는 취향이 아니다 — `SellerProductEditPage.tsx` 가 파일크기 래칫에
 *   **625줄로 동결**돼 있어 그 안에서는 한 줄도 못 늘린다(`scripts/file-size-baseline.json`).
 */
import { DollarSign, Box, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { priceDisplay } from '@/shared/price-display'

const INPUT =
  'w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

interface Props {
  price: string
  originalPrice: string
  stock: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function PriceStockFields({ price, originalPrice, stock, onChange }: Props) {
  const { t } = useTranslation()

  // 🔎 등록 화면 미리보기(`seller-meal-voucher/CardPreview`)와 **같은 SSOT** 로 계산한다.
  //   손으로 다시 계산하면 같은 상품이 화면마다 다른 할인율을 보이는 날이 온다.
  const preview = priceDisplay({ price: Number(price) || 0, original_price: Number(originalPrice) || 0 })

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('seller.originalPrice')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              name="price"
              value={price}
              onChange={onChange}
              placeholder="30000"
              required
              min="0"
              className={INPUT}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('common.enterInWon')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('seller.stockQuantity')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              name="stock"
              value={stock}
              onChange={onChange}
              placeholder="100"
              required
              min="0"
              className={INPUT}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('common.enterInUnits')}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.edit.listPrice', { defaultValue: '정가 (할인 전 가격)' })}
        </label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="number"
            name="original_price"
            value={originalPrice}
            onChange={onChange}
            placeholder={price || '38000'}
            min="0"
            className={INPUT}
          />
        </div>
        {/* 할인율은 *계산 결과*라 따로 입력받지 않는다 — 두 칸이 같은 것을 말하면 반드시 갈린다. */}
        {preview.discount > 0 ? (
          <p className="text-xs text-gray-600 mt-1">
            {t('seller.edit.listPriceDiscount', {
              defaultValue: '소비자 화면에 {{pct}}% 할인으로 보입니다.',
              pct: preview.discount,
            })}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            {t('seller.edit.listPriceHint', {
              defaultValue: '판매가보다 높게 넣으면 할인율이 표시됩니다. 비우면 할인 표시가 없습니다.',
            })}
          </p>
        )}
      </div>
    </>
  )
}
