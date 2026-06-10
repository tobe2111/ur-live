import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DashboardCard } from '@/components/dashboard'
import { Loader2, CreditCard } from 'lucide-react'
import type { BankInfo } from './types'

// 🛡️ 2026-06-10: SellerBusinessInfoPage 탭화 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-04-22 배치 128: 계좌 정보 섹션 (정산용)
export default function BankInfoSection({ bankInfo, setBankInfo, submitting, onSubmit }: {
  bankInfo: BankInfo
  setBankInfo: React.Dispatch<React.SetStateAction<BankInfo>>
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const { t } = useTranslation()

  return (
    <DashboardCard
      title={t('seller.bankInfo', { defaultValue: '정산 계좌 정보' })}
      subtitle={t('seller.bankInfoDesc', { defaultValue: '정산금 입금 받을 계좌입니다. 본인 명의 계좌만 사용 가능합니다.' })}
    >
      <form onSubmit={onSubmit} className="space-y-4" id="bank-info-section">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            {t('seller.bankName', { defaultValue: '은행명' })} <span className="text-red-500">*</span>
          </label>
          <select
            value={bankInfo.bank_name}
            onChange={e => setBankInfo(prev => ({ ...prev, bank_name: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('seller.bankNameSelect', { defaultValue: '은행을 선택해주세요' })}</option>
            {['KB국민은행','신한은행','우리은행','하나은행','NH농협은행','IBK기업은행','SC제일은행','한국씨티은행','케이뱅크','카카오뱅크','토스뱅크','새마을금고','신협','우체국','부산은행','경남은행','대구은행','광주은행','전북은행','제주은행','수협은행','산업은행'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('seller.accountNumber', { defaultValue: '계좌번호' })} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankInfo.bank_account}
              onChange={e => setBankInfo(prev => ({ ...prev, bank_account: e.target.value.replace(/[^\d-]/g, '') }))}
              placeholder="000-000-0000000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              {t('seller.accountHolder', { defaultValue: '예금주' })} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankInfo.account_holder}
              onChange={e => setBankInfo(prev => ({ ...prev, account_holder: e.target.value }))}
              placeholder={t('seller.bizInfo.holderPlaceholder', { defaultValue: '홍길동' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
          <CreditCard className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>{t('seller.bankInfoNotice', { defaultValue: '정산 요청 시 이 계좌로 입금됩니다. 계좌 정보가 정확한지 확인해주세요.' })}</p>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('seller.savingInfo')}
            </span>
          ) : (
            t('seller.saveBankInfo', { defaultValue: '계좌 정보 저장' })
          )}
        </Button>
      </form>
    </DashboardCard>
  )
}
