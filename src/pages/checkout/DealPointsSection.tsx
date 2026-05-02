/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 의 딜 포인트 입력 섹션.
 *
 * 사용자가 보유한 딜 포인트 일부 / 전액 차감.
 */
import { formatNumber } from '@/utils/format'

interface Props {
  dealBalance: number
  dealToUse: number
  setDealToUse: (v: number) => void
  totalBeforeDeal: number
  totalAmount: number
}

export default function DealPointsSection({ dealBalance, dealToUse, setDealToUse, totalBeforeDeal, totalAmount }: Props) {
  return (
    <div className="bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] px-5 py-5 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">딜 포인트</h3>
        <span className="text-[13px] text-gray-500 dark:text-gray-400">
          보유 <span className="font-bold text-pink-500">{formatNumber(dealBalance)}</span>딜
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={dealToUse || ''}
          onChange={e => {
            const v = Math.min(Math.max(0, Number(e.target.value)), Math.min(dealBalance, totalBeforeDeal))
            setDealToUse(v)
          }}
          placeholder="사용할 딜 입력"
          aria-label="사용할 딜 포인트 입력"
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-lg text-sm text-gray-900 dark:text-white text-right font-medium placeholder:text-gray-400 dark:text-gray-500"
        />
        <button
          onClick={() => setDealToUse(Math.min(dealBalance, totalBeforeDeal))}
          className="px-3 py-3 bg-gray-900 text-white rounded-lg text-[11px] font-bold shrink-0 whitespace-nowrap"
        >전액</button>
      </div>
      {dealToUse > 0 && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#2A2A2A]">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500 dark:text-gray-400">상품 금액</span>
            <span className="text-gray-700 dark:text-gray-200">{formatNumber(totalBeforeDeal)}원</span>
          </div>
          <div className="flex items-center justify-between text-[13px] mt-1">
            <span className="text-pink-500 font-medium">딜 포인트 차감</span>
            <span className="text-pink-500 font-bold">-{formatNumber(dealToUse)}딜</span>
          </div>
          <div className="border-t border-gray-200 dark:border-[#2A2A2A] mt-2 pt-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white">카드 결제 금액</span>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white">{Math.max(0, totalAmount)}원</span>
          </div>
        </div>
      )}
    </div>
  )
}
