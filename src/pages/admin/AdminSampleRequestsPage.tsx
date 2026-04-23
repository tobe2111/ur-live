import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  Loader2, CheckCircle2, XCircle, Clock, Package,
  ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { formatKSTDate } from '@/utils/date'

interface SampleRequest {
  id: number
  seller_id: number
  product_id: number
  status: string
  seller_memo: string | null
  admin_memo: string | null
  created_at: string
  approved_at: string | null
  seller_name: string
  business_name: string
  seller_email: string
  product_name: string
  retail_price: number
  supply_price: number
  product_image: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING:  { label: '대기',  color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  APPROVED: { label: '승인',  color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  REJECTED: { label: '거부',  color: 'text-red-600 bg-red-50', icon: XCircle },
}

export default function AdminSampleRequestsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<SampleRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [memoModal, setMemoModal] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null)
  const [adminMemo, setAdminMemo] = useState('')

  const limit = 20
  const totalPages = Math.ceil(total / limit)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login', { replace: true }); return }
    loadData()
  }, [page, filter])

  async function loadData() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (filter) params.set('status', filter)
      const res = await api.get(`/api/admin/sample-requests?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (res.data.success) {
        setItems(res.data.data.items ?? [])
        setTotal(res.data.data.total ?? 0)
      }
    } catch {
      toast.error('샘플 신청 목록을 불러올 수 없습니다')
    } finally { setLoading(false) }
  }

  async function handleAction(id: number, action: 'approve' | 'reject', memo?: string) {
    setActionId(id)
    try {
      const res = await api.patch(`/api/admin/sample-requests/${id}`,
        { action, admin_memo: memo || undefined },
        { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      )
      if (res.data.success) {
        toast.success(res.data.message)
        loadData()
      } else {
        toast.error(res.data.error)
      }
    } catch {
      toast.error('처리에 실패했습니다')
    } finally {
      setActionId(null)
      setMemoModal(null)
      setAdminMemo('')
    }
  }

  const pendingCount = items.filter(i => i.status === 'PENDING').length

  return (
    <AdminLayout title={t('admin.pages.sampleRequests')}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.sampleRequests')}
          subtitle={`총 ${total}건 · 대기 ${pendingCount}건`}
          icon={<Package className="h-5 w-5" />}
        />
        {/* 필터 탭 */}
        <div className="flex gap-2 mb-5">
          {[
            { value: '', label: '전체' },
            { value: 'PENDING', label: `대기${total > 0 ? ` (${pendingCount})` : ''}` },
            { value: 'APPROVED', label: '승인' },
            { value: 'REJECTED', label: '거부' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => { setFilter(tab.value); setPage(1) }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">샘플 신청이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const st = STATUS_MAP[item.status] || STATUS_MAP.PENDING
              const StIcon = st.icon
              return (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-start gap-4">
                    {/* 상품 이미지 */}
                    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${st.color}`}>
                          <StIcon className="w-3 h-3" />
                          {st.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          #{item.id} · {formatKSTDate(item.created_at)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>

                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{item.seller_name} ({item.business_name})</span>
                        <span>소비자가 {item.retail_price?.toLocaleString()}원</span>
                        {item.supply_price > 0 && (
                          <span>공급가 {item.supply_price?.toLocaleString()}원</span>
                        )}
                      </div>

                      {item.seller_memo && (
                        <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                          <span className="font-medium text-gray-600">셀러 메모:</span> {item.seller_memo}
                        </p>
                      )}

                      {item.admin_memo && (
                        <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
                          <span className="font-medium">관리자 메모:</span> {item.admin_memo}
                        </p>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    {item.status === 'PENDING' && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setMemoModal({ id: item.id, action: 'approve' })}
                          disabled={actionId === item.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {actionId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          승인
                        </button>
                        <button
                          onClick={() => setMemoModal({ id: item.id, action: 'reject' })}
                          disabled={actionId === item.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
                        >
                          {actionId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          거부
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 메모 모달 */}
      {memoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setMemoModal(null); setAdminMemo('') }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {memoModal.action === 'approve' ? '샘플 신청 승인' : '샘플 신청 거부'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {memoModal.action === 'approve'
                ? '승인 시 셀러에게 브랜드메시지가 발송됩니다'
                : '거부 사유를 입력해주세요'}
            </p>
            <textarea
              value={adminMemo}
              onChange={e => setAdminMemo(e.target.value)}
              placeholder="관리자 메모 (선택사항)"
              rows={3}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setMemoModal(null); setAdminMemo('') }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => handleAction(memoModal.id, memoModal.action, adminMemo)}
                disabled={actionId === memoModal.id}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
                  memoModal.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {actionId === memoModal.id && <Loader2 className="w-4 h-4 animate-spin" />}
                {memoModal.action === 'approve' ? '승인' : '거부'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
