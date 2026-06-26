/**
 * 🏭 판매사(도매 distributor) 가입 승인 — 도매(wholesale)-스코프 페이지 (2026-06-24)
 *
 *   대표 신고: 메인 대시보드 '판매사 승인 N명' → 클릭(기존 /admin/seller-approval) 시 "승인 대기 없음".
 *   원인: 소비자 셀러 페이지(/api/admin/sellers)는 도매 권한 어드민 스코프 밖 → 403 → 빈 목록.
 *   해결: is_distributor=1·status='pending' 만 도매-스코프 엔드포인트(/api/admin/distributor/*)로 조회·승인.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { safeHttpHref } from '@/utils/safe-external-url'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { useQueryClient } from '@tanstack/react-query'
import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { UserCheck, Building2, Phone, Mail, FileText, Loader2 } from 'lucide-react'

interface PendingDistributor {
  id: number
  username: string | null
  name: string | null
  business_name: string | null
  business_number: string | null
  email: string | null
  phone: string | null
  representative_name: string | null
  representative_phone: string | null
  manager_name: string | null
  manager_phone: string | null
  business_registration_image_url: string | null
  business_registration_status: string | null
  status: string
  created_at: string
}

const QKEY = ['admin', 'distributor', 'pending-approvals']

export default function AdminDistributorApprovalPage() {
  const qc = useQueryClient()
  const adminAuth = { Authorization: `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('access_token')}` }
  const [acting, setActing] = useState<number | null>(null)

  const { data: list = [], isLoading, refetch } = useApiQuery<PendingDistributor[]>(
    QKEY, '/api/admin/distributor/distributors/pending-approvals',
    {
      headers: adminAuth,
      select: (raw: unknown) => {
        const r = raw as { success?: boolean; distributors?: PendingDistributor[] }
        return r?.success ? r.distributors ?? [] : []
      },
    },
  )

  async function act(d: PendingDistributor, action: 'approve' | 'reject') {
    let reason: string | null = null
    if (action === 'reject') {
      if (!(await confirmDialog({ message: `${d.business_name || d.name || '판매사'} 가입을 거부할까요?`, danger: true }))) return
    } else {
      if (!(await confirmDialog({ message: `${d.business_name || d.name || '판매사'} 가입을 승인할까요?\n승인 시 즉시 도매몰을 이용할 수 있습니다.` }))) return
    }
    setActing(d.id)
    try {
      await api.patch(`/api/admin/distributor/distributors/${d.id}/approval`, { action, reason }, { headers: adminAuth })
      toast.success(action === 'approve' ? '판매사 가입을 승인했습니다' : '판매사 가입을 거부했습니다')
      // 목록 + 대시보드 카운트 갱신.
      qc.setQueryData(QKEY, (old: PendingDistributor[] | undefined) => (old || []).filter((x) => x.id !== d.id))
      qc.invalidateQueries({ queryKey: ['admin', 'wholesale-overview'] })
      refetch()
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '처리 중 오류가 발생했습니다')
    } finally {
      setActing(null)
    }
  }

  return (
    <AdminLayout title="판매사 승인" pendingCount={list.length}>
      <SEO title="판매사 승인" url="/admin/distributor-approval" noindex />
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 mb-5 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-gray-400" />
          도매(유통스타트) 가입 신청 — 사업자 정보 확인 후 승인/거부
          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">{list.length}</span>
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-2xl py-20 text-center">
            <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">승인 대기 판매사 없음</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((d) => (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <p className="text-sm font-bold text-gray-900 truncate">{d.business_name || d.name || `판매사 #${d.id}`}</p>
                      {d.business_number && <span className="text-xs text-gray-500">사업자 {d.business_number}</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      {(d.representative_name || d.representative_phone) && (
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> 대표 {d.representative_name || '-'} {d.representative_phone || ''}</span>
                      )}
                      {(d.manager_name || d.manager_phone) && (
                        <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> 담당 {d.manager_name || '-'} {d.manager_phone || ''}</span>
                      )}
                      {d.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" /> {d.email}</span>}
                      {d.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> {d.phone}</span>}
                    </div>
                    {safeHttpHref(d.business_registration_image_url) && (
                      <a href={safeHttpHref(d.business_registration_image_url)} target="_blank" rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <FileText className="w-3 h-3" /> 사업자등록증 보기
                      </a>
                    )}
                    <p className="mt-1 text-[11px] text-gray-400">신청 {new Date(d.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => act(d, 'approve')}
                      disabled={acting === d.id}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50"
                    >
                      {acting === d.id ? '처리 중…' : '승인'}
                    </button>
                    <button
                      onClick={() => act(d, 'reject')}
                      disabled={acting === d.id}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                    >
                      거부
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
