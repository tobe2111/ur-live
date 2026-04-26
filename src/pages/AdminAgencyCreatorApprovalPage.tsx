import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { UserCheck, UserX, Building2, Mail, Phone } from 'lucide-react'
import { toast } from '@/hooks/useToast'

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'all'

interface Approval {
  id: number
  seller_id: number
  agency_id: number
  status: ApprovalStatus
  reason: string | null
  reviewed_at: string | null
  created_at: string
  seller_name: string | null
  seller_email: string | null
  seller_business_name: string | null
  seller_phone: string | null
  agency_name: string | null
  agency_email: string | null
}

const STATUS_TABS: { key: ApprovalStatus; label: string }[] = [
  { key: 'pending', label: '심사 대기' },
  { key: 'approved', label: '승인됨' },
  { key: 'rejected', label: '반려됨' },
  { key: 'all', label: '전체' },
]

export default function AdminAgencyCreatorApprovalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ApprovalStatus>('pending')
  const [acting, setActing] = useState<number | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/api/admin/agency-creator-approvals?status=${tab}`, { headers })
      .then(r => { if (r.data?.success) setItems(r.data.data || []) })
      .catch((e) => {
        if (import.meta.env.DEV) console.warn('[approvals:list]', e)
        toast.error('목록 조회 실패')
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => { load() }, [load])

  const approve = async (id: number) => {
    if (!confirm('이 셀러를 승인하시겠습니까? 승인 후 즉시 로그인/판매가 가능해집니다.')) return
    setActing(id)
    try {
      await api.post(`/api/admin/agency-creator-approvals/${id}/approve`, {}, { headers })
      toast.success('승인 완료')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '승인 실패')
    } finally {
      setActing(null)
    }
  }

  const reject = async (id: number) => {
    const reason = prompt('반려 사유를 입력하세요 (필수):')?.trim()
    if (!reason) {
      toast.error('반려 사유는 필수입니다')
      return
    }
    setActing(id)
    try {
      await api.post(`/api/admin/agency-creator-approvals/${id}/reject`, { reason }, { headers })
      toast.info('반려 처리됨')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '반려 실패')
    } finally {
      setActing(null)
    }
  }

  const statusBadge = (s: ApprovalStatus) => {
    const map: Record<ApprovalStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      all: 'bg-gray-100 text-gray-700',
    }
    const label: Record<ApprovalStatus, string> = {
      pending: '대기', approved: '승인', rejected: '반려', all: '-',
    }
    return <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${map[s]}`}>{label[s]}</span>
  }

  return (
    <AdminLayout title={t('admin.pages.agencyCreatorApproval', '에이전시 셀러 심사')}>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="에이전시 셀러 심사"
          subtitle="에이전시가 초대한 셀러의 사업자 정보를 검증하고 승인/반려 처리"
          icon={<Building2 className="h-5 w-5" />}
        />

        {/* 탭 */}
        <div className="flex gap-2 border-b border-gray-200">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-bold transition-colors ${
                tab === key
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <DashboardLoading />
        ) : items.length === 0 ? (
          <DashboardEmptyState
            icon={<UserCheck className="h-7 w-7" />}
            title={tab === 'pending' ? '심사 대기 셀러가 없습니다' : `${STATUS_TABS.find(s => s.key === tab)?.label} 항목이 없습니다`}
          />
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {item.seller_name || '(이름 없음)'}
                      </p>
                      {statusBadge(item.status)}
                      <span className="text-xs text-gray-400">#{item.id}</span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {item.seller_email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{item.seller_email}</span>
                      )}
                      {item.seller_phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{item.seller_phone}</span>
                      )}
                      {item.seller_business_name && (
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{item.seller_business_name}</span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-2">
                      소속 에이전시: <strong className="text-gray-600">{item.agency_name || '-'}</strong>
                      {item.agency_email && <span className="ml-1">({item.agency_email})</span>}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      신청일: {new Date(item.created_at).toLocaleString('ko-KR')}
                      {item.reviewed_at && (
                        <span className="ml-2">| 처리일: {new Date(item.reviewed_at).toLocaleString('ko-KR')}</span>
                      )}
                    </p>

                    {item.reason && (
                      <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded">
                        반려 사유: {item.reason}
                      </p>
                    )}
                  </div>

                  {item.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approve(item.id)}
                        disabled={acting === item.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-green-700 disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> 승인
                      </button>
                      <button
                        onClick={() => reject(item.id)}
                        disabled={acting === item.id}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-200 disabled:opacity-50"
                      >
                        <UserX className="w-3.5 h-3.5" /> 반려
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
