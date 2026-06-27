import ImageUpload from '@/components/upload/ImageUpload'

// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-05-18: 사업자등록증 제출 모달.
export default function BizRegSubmitModal({ submitting, imageUrl, businessNumber, onImageChange, onBusinessNumberChange, onClose, onSubmit }: {
  submitting: boolean
  imageUrl: string
  businessNumber: string
  onImageChange: (url: string) => void
  onBusinessNumberChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-1">사업자등록증 등록</h3>
        <p className="text-xs text-gray-500 mb-4">
          검증 완료 시 현금 정산 + 딜 환급이 가능합니다 (1-3 영업일 소요)
        </p>
        <div className="space-y-3">
          <ImageUpload
            label="사업자등록증 이미지"
            required
            value={imageUrl}
            onChange={(url) => onImageChange(url)}
            tokenKey="seller_token"
            aspectRatio="auto"
          />
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              사업자등록번호 (선택)
            </label>
            <input
              type="text"
              value={businessNumber}
              onChange={(e) => onBusinessNumberChange(e.target.value)}
              placeholder="123-45-67890"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={submitting}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !imageUrl.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
