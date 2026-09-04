/**
 * ⚙️ 위저드 3단계 — 판매 설정 + 최종 확인
 *   - 목표 인원 입력 제거(2026-08-23 리뉴얼 — 즉시판매 단일가 모델에서 vestigial, 항상 0 전송)
 *   - 유효기간 기본 = 제한 없음(2026-08-22 대표 정책: 미설정 = 무기한). 토글로만 날짜 설정.
 */
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import CardPreview from './CardPreview'
import type { VoucherForm } from './voucher-form'

interface Props {
  form: VoucherForm
  update: (key: string, value: string | number) => void
  showAdvanced: boolean
  setShowAdvanced: (fn: (v: boolean) => boolean) => void
}

export default function SaleSettingsStep({ form, update, showAdvanced, setShowAdvanced }: Props) {
  const { t } = useTranslation()
  const expiryEnabled = !!form.voucher_expiry

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-bold text-gray-900">{t('seller.mealVoucher.groupBuySettings')}</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            {/* 🎯 1인당 구매 수량 제한 (0=무제한) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">1인당 최대 구매 수량</label>
              <input
                type="number"
                value={form.max_per_person || ''}
                onChange={e => update('max_per_person', Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                placeholder="0 = 무제한"
                min={0}
                max={99}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">0 = 제한 없음, 최대 99</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): '판매 마감' 입력 제거.
                남겨 두면 "이 시각까지 판매돼요" 가 지켜지지 않는 약속이 된다(마감은 이제 아무것도 안 막는다). */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.mealVoucher.voucherExpiry')}</label>
              {/* 🗓️ 기본 = 제한 없음. 켜면 날짜 선택(편의상 90일 후 프리필). */}
              <label className="flex items-center gap-2 py-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!expiryEnabled}
                  onChange={e => {
                    if (e.target.checked) update('voucher_expiry', '')
                    else update('voucher_expiry', new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10))
                  }}
                  className="w-4 h-4 accent-pink-500"
                />
                <span className="text-sm text-gray-700">{t('seller.mealVoucher.noExpiry', { defaultValue: '유효기간 제한 없음' })}</span>
              </label>
              {expiryEnabled && (
                <input
                  type="date"
                  value={form.voucher_expiry}
                  onChange={e => update('voucher_expiry', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* ⚙️ 고급 설정 — 약관 + 예약 링크 접기 */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition"
          >
            <span>⚙️ 고급 설정 (이용약관 · 예약 링크)</span>
            <span className="text-xs text-gray-400">{showAdvanced ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>

          {showAdvanced && (
          <>
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

          {/* 외부 예약 링크 — 숙소/뷰티 사전 예약 필수 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📅 외부 예약 링크 <span className="text-[11px] text-gray-400">(숙소/뷰티 등 예약 필수 카테고리)</span>
            </label>
            <input
              type="url"
              value={form.external_booking_url}
              onChange={e => update('external_booking_url', e.target.value)}
              placeholder="https://booking.naver.com/... 또는 https://www.yanolja.com/..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">바우처 발급 후 사용자에게 노출. 비워두면 매장 전화번호로 안내.</p>
          </div>

          {/* 즉시판매 단일가 모델 안내 */}
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-pink-50 border border-pink-100 rounded-lg p-3">
              <p className="text-sm font-bold text-gray-900">{t('seller.mealVoucher.singlePriceTitle', { defaultValue: '공구가는 단일 가격이에요' })}</p>
              <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                {t('seller.mealVoucher.singlePriceDesc', { defaultValue: '위에 입력한 판매가가 모든 참여자에게 동일하게 적용되는 공구가예요. 인원수에 따라 가격이 바뀌지 않으며, 결제 즉시 교환권이 발급됩니다. 정가(원가)를 함께 입력하면 할인율이 자동 표시돼요.' })}
              </p>
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* 최종 미리보기 — 소비자 카드 그대로 */}
      <CardPreview form={form} />
    </div>
  )
}
