/**
 * 🎟️ 이용권 전용 입력 묶음 (SellerProductEditPage 에서 추출 — 2026-08-22, 파일 크기 래칫)
 *
 * ⚠️ **이용권 4종 공통**이다. 예전엔 호출부가 `category === 'meal_voucher'` 로 게이트돼 있어
 *    뷰티·숙박·기타 이용권은 1인당 한도를 처음부터 끝까지 설정할 수 없었다(대표 신고 2026-08-22).
 *    게이트를 다시 좁히지 말 것 — 가드: `src/tests/unit/seller-voucher-limit.test.ts`.
 * ⚠️ 라벨은 "식당"이 아니라 "매장"이다. 뷰티·숙박 이용권에 "식당명"은 거짓말이다.
 */
import { useTranslation } from 'react-i18next'

type VoucherFormData = {
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
  voucher_terms: string
  voucher_expiry: string
  group_buy_target: string | number
  max_per_person: string | number
  group_buy_deadline: string
  store_verify_pin: string
}

export default function VoucherFields({
  formData,
  onChange,
}: {
  formData: VoucherFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}) {
  const { t } = useTranslation()
  const handleChange = onChange
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-orange-800">{t('seller.products.mealVoucherInfo')}</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.storeName', { defaultValue: '매장명' })}</label>
        <input name="restaurant_name" value={formData.restaurant_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.storeAddress', { defaultValue: '매장 주소' })}</label>
        <input name="restaurant_address" value={formData.restaurant_address} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.storePhone', { defaultValue: '매장 전화번호' })}</label>
        <input name="restaurant_phone" value={formData.restaurant_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.voucherTerms')}</label>
        <input name="voucher_terms" value={formData.voucher_terms} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.expiryDate')}</label>
          <input type="date" name="voucher_expiry" value={formData.voucher_expiry} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.groupBuyTarget')}</label>
          <input type="number" name="group_buy_target" value={formData.group_buy_target} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        </div>
      </div>
      {/* 🎯 2026-07-01 (대표 "결제 최대 한도 갯수 1인 당"): 1인당 구매 수량 제한 (0=무제한). */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">1인당 최대 구매 수량</label>
        <input type="number" name="max_per_person" value={formData.max_per_person} onChange={handleChange} min={0} max={99} placeholder="0 = 무제한" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        {/* 문구는 서버가 실제로 하는 판정과 같아야 한다 — 서버는 이번 주문 수량이 아니라
            **이미 보유한 이용권(미사용+사용)까지 합쳐** 한도를 넘는지 본다
            (`group-buy.routes.ts /join`). "한 번에 N개"로 읽히면 셀러가 오해한다. */}
        <p className="text-[11px] text-gray-400 mt-1">
          한 사람이 <b>총 몇 개까지</b> 구매할 수 있는지 (0 = 제한 없음, 최대 99).
          이미 보유한 이용권까지 합산해 초과 구매를 막습니다.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.groupBuyDeadline')}</label>
        <input type="datetime-local" name="group_buy_deadline" value={formData.group_buy_deadline} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.storeVerifyPin')}</label>
        <input name="store_verify_pin" value={formData.store_verify_pin} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
      </div>
    </div>
  )
}
