/**
 * 🛡️ 2026-05-02: TD-018 분할 — MyOrdersPage 주문 취소 모달.
 *   상태 (cancelReason / isPartialCancel / cancelAmount / processing) 는 부모 보유.
 */
import { X, AlertCircle } from 'lucide-react'

interface Props {
  orderNumber: string
  reason: string
  onReasonChange: (v: string) => void
  isPartialCancel: boolean
  onPartialCancelChange: (v: boolean) => void
  cancelAmount: string
  onCancelAmountChange: (v: string) => void
  processing: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function CancelOrderModal({
  orderNumber, reason, onReasonChange,
  isPartialCancel, onPartialCancelChange,
  cancelAmount, onCancelAmountChange,
  processing, onClose, onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-3xl shadow-2xl max-w-md w-full p-6 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            주문 취소
          </h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#121212] rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">주문번호</p>
          <p className="font-semibold text-gray-900 dark:text-white">{orderNumber}</p>
        </div>

        {/* 🛡️ 배치 170: 환불 가이드 (셀프서비스 안내) */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-bold text-blue-800 mb-1">💡 환불 안내</p>
          <ul className="text-[11px] text-blue-700 space-y-0.5">
            <li>• 결제 취소 시 결제 수단으로 <span className="font-semibold">자동 환불</span>됩니다</li>
            <li>• 카드 결제: 3~5 영업일 내 환불 | 포인트 결제: 즉시 환불</li>
            <li>• 배송 시작 후에는 반품 절차가 필요합니다</li>
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            취소 사유 <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">취소 사유를 선택해주세요</option>
            <option value="단순 변심">단순 변심</option>
            <option value="다른 상품 구매">다른 상품 구매</option>
            <option value="배송 지연">배송 지연</option>
            <option value="상품 정보 불일치">상품 정보 불일치</option>
            <option value="기타">기타</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">환불 방식</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => onPartialCancelChange(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                !isPartialCancel ? 'bg-blue-500 text-white' : 'bg-gray-50 dark:bg-[#121212] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
              }`}
            >
              전액 취소
            </button>
            <button
              type="button"
              onClick={() => onPartialCancelChange(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                isPartialCancel ? 'bg-blue-500 text-white' : 'bg-gray-50 dark:bg-[#121212] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
              }`}
            >
              부분 취소
            </button>
          </div>
          {isPartialCancel && (
            <input
              type="number"
              value={cancelAmount}
              onChange={(e) => onCancelAmountChange(e.target.value)}
              placeholder="취소할 금액 입력 (원)"
              aria-label="부분 취소 금액 입력 (원)"
              min="1"
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          )}
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">취소 안내</p>
              <p className="text-blue-600">• 결제완료 상태에서만 취소가 가능합니다.</p>
              <p className="text-blue-600">• 취소 시 토스페이먼츠를 통해 자동 환불됩니다. (3-5영업일 소요)</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-300 font-medium rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
            disabled={processing}
          >
            닫기
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || !reason.trim()}
            className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-full hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? '처리중...' : '취소 확정'}
          </button>
        </div>
      </div>
    </div>
  )
}
