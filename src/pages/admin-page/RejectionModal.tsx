/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminPage 판매자 승인 거부 모달.
 */
import type { Seller } from './types'

interface Props {
  seller: Seller
  reason: string
  onReasonChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export default function RejectionModal({ seller, reason, onReasonChange, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4">판매자 승인 거부</h3>
        <p className="text-sm text-gray-600 mb-1">
          <strong>{seller.name || seller.username}</strong>님의 승인을 거부합니다.
        </p>
        <p className="text-xs text-gray-500 mb-3">거부 사유를 입력해주세요:</p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="예: 사업자등록증 확인 불가"
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >취소</button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >거부 확정</button>
        </div>
      </div>
    </div>
  )
}
