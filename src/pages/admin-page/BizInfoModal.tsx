/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminPage 사업자 정보 상세 모달.
 */
import { formatKST } from '@/utils/date'
import type { Seller } from './types'

interface Props {
  seller: Seller
  onClose: () => void
  onApprove: (sellerId: number) => void
  onReject: (sellerId: number) => void
}

export default function BizInfoModal({ seller, onClose, onApprove, onReject }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            사업자 정보 — {seller.business_name || seller.name}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            seller.biz_is_verified
              ? 'bg-emerald-50 text-emerald-700'
              : seller.biz_number
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-gray-100 text-gray-400'
          }`}>
            {seller.biz_is_verified ? '승인됨' : seller.biz_number ? '승인 대기' : '미제출'}
          </span>
        </div>
        {!seller.biz_number ? (
          <p className="text-sm text-gray-400 text-center py-6">사업자 정보가 아직 제출되지 않았습니다.</p>
        ) : (
          <dl className="space-y-3">
            {[
              { label: '사업자번호', value: seller.biz_number },
              { label: '상호명', value: seller.biz_name },
              { label: '대표자명', value: seller.ceo_name },
              { label: '업태', value: seller.business_type },
              { label: '업종', value: seller.business_category },
              { label: '우편번호', value: seller.postal_code },
              { label: '사업장 주소', value: seller.address },
              { label: '상세 주소', value: seller.address_detail },
              { label: '전화번호', value: seller.biz_phone },
              { label: '이메일', value: seller.biz_email },
              { label: '승인일시', value: seller.biz_verified_at ? formatKST(seller.biz_verified_at) : null },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3">
                <dt className="text-xs text-gray-400 w-28 shrink-0">{label}</dt>
                <dd className="text-xs text-gray-900 break-all">{value || <span className="text-gray-300">미입력</span>}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-5 flex gap-2">
          {seller.biz_number && !seller.biz_is_verified && (
            <button
              onClick={() => onApprove(seller.id)}
              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700"
            >
              승인
            </button>
          )}
          {seller.biz_number && !!seller.biz_is_verified && (
            <button
              onClick={() => onReject(seller.id)}
              className="flex-1 py-2.5 bg-red-100 text-red-600 text-sm font-medium rounded-xl hover:bg-red-200"
            >
              승인 취소
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
