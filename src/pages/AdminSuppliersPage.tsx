/**
 * 🛡️ 2026-06-01 도매몰: 어드민 공급자(도매상) 관리 + 지급 실행.
 *   계정 승인/정지 + 잔고 조회 + available 잔고 지급(payout).
 *   라이트 테마 (어드민 대시보드).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, XCircle, Wallet, Ban, Store } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface SupplierRow {
  id: number
  business_name: string
  business_number: string | null
  representative: string | null
  business_license_url?: string | null
  email: string
  phone: string | null
  // 🏭 2026-06-09 Wave 1: 대표자 연락처 + 담당자 인적사항
  representative_phone?: string | null
  manager_name?: string | null
  manager_phone?: string | null
  manager_email?: string | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  status: string
  created_at: string
  pending_amount: number
  available_amount: number
  paid_amount: number
  product_count: number
}

const STATUS = {
  pending: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: '승인됨', cls: 'bg-green-50 text-green-700 border-green-200' },
  suspended: { label: '정지', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  rejected: { label: '거부', cls: 'bg-red-50 text-red-600 border-red-200' },
}

export default function AdminSuppliersPage() {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionId, setActionId] = useState<number | null>(null)

  const token = () => localStorage.getItem('admin_token') || localStorage.getItem('access_token')

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (statusFilter별 캐시).
  const { data: supData, isLoading: loading, refetch } = useApiQuery<{ items: SupplierRow[]; pending_count: number }>(
    ['admin', 'suppliers', statusFilter], '/api/admin/suppliers',
    { params: { status: statusFilter, limit: 200 }, select: (r: any) => (r?.success ? { items: r.data?.items ?? [], pending_count: r.data?.pending_count ?? 0 } : { items: [], pending_count: 0 }) },
  )
  const items = supData?.items ?? []
  const pendingCount = supData?.pending_count ?? 0
  const load = () => refetch()

  async function setStatus(id: number, status: string) {
    setActionId(id)
    try {
      await api.patch(`/api/admin/suppliers/${id}`, { status }, { headers: { Authorization: `Bearer ${token()}` } })
      toast.success(t('admin.suppliers.updated', { defaultValue: '업데이트되었습니다.' }))
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.suppliers.actionFail', { defaultValue: '처리에 실패했습니다.' }))
    } finally { setActionId(null) }
  }

  async function payout(s: SupplierRow) {
    if (s.available_amount <= 0) return
    if (!(await confirmDialog(t('admin.suppliers.payoutConfirm', { defaultValue: `${s.business_name} 에게 ${formatWon(s.available_amount)} 지급 처리할까요? 실제 계좌이체는 별도로 진행해주세요.` })))) return
    setActionId(s.id)
    try {
      const res = await api.post(`/api/admin/suppliers/${s.id}/payout`, {}, { headers: { Authorization: `Bearer ${token()}` } })
      toast.success(res.data?.message || t('admin.suppliers.payoutOk', { defaultValue: '지급 완료' }))
      load()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.suppliers.payoutFail', { defaultValue: '지급 처리에 실패했습니다.' }))
    } finally { setActionId(null) }
  }

  const filters = [
    { key: 'all', label: t('admin.suppliers.fAll', { defaultValue: '전체' }) },
    { key: 'pending', label: t('admin.suppliers.fPending', { defaultValue: '승인 대기' }) },
    { key: 'approved', label: t('admin.suppliers.fApproved', { defaultValue: '승인됨' }) },
    { key: 'suspended', label: t('admin.suppliers.fSuspended', { defaultValue: '정지' }) },
  ]

  return (
    <AdminLayout title={t('admin.suppliers.title', { defaultValue: '제조사 관리' })}>
      <div className="flex items-center gap-2 mb-4">
        {filters.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${statusFilter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {f.label}
            {f.key === 'pending' && pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl py-20 text-center">
          <Store className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('admin.suppliers.empty', { defaultValue: '공급자가 없습니다.' })}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(s => {
            const st = STATUS[s.status as keyof typeof STATUS] || STATUS.pending
            const busy = actionId === s.id
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{s.business_name}</p>
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-gray-400">{t('admin.suppliers.products', { defaultValue: '상품' })} {s.product_count}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {s.representative && <>{t('admin.suppliers.ceo', { defaultValue: '대표자' })} {s.representative}{s.representative_phone ? ` (${s.representative_phone})` : ''} · </>}{s.email}{s.phone && <> · {s.phone}</>}
                      {s.business_number && <> · {t('admin.suppliers.bizNo', { defaultValue: '사업자' })} {s.business_number}</>}
                    </p>
                    {(s.manager_name || s.manager_phone || s.manager_email) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('admin.suppliers.manager', { defaultValue: '담당자' })}: {s.manager_name || '-'}
                        {s.manager_phone && <> · {s.manager_phone}</>}
                        {s.manager_email && <> · {s.manager_email}</>}
                      </p>
                    )}
                    {/* 🏭 2026-06-04 사업자등록증 — 승인 심사용 (클릭 시 원본 확인) */}
                    {s.business_license_url && (
                      <a href={s.business_license_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-1.5">
                        <img src={s.business_license_url} alt="사업자등록증" className="w-12 h-12 rounded border border-gray-200 object-cover" />
                        <span className="text-[11px] text-blue-600 font-medium">사업자등록증 보기</span>
                      </a>
                    )}
                    {(s.bank_name || s.bank_account) && (
                      <p className="text-xs text-gray-400 mt-0.5">{t('admin.suppliers.account', { defaultValue: '정산계좌' })}: {s.bank_name} {s.bank_account} {s.account_holder && `(${s.account_holder})`}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[11px] text-gray-400">{t('admin.suppliers.balance', { defaultValue: '잔고 (대기/가능/지급)' })}</p>
                      <p className="text-sm font-semibold text-gray-700">
                        <span className="text-amber-600">{formatWon(s.pending_amount)}</span>
                        {' / '}<span className="text-blue-600">{formatWon(s.available_amount)}</span>
                        {' / '}<span className="text-green-600">{formatWon(s.paid_amount)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                  {s.status === 'pending' && (
                    <>
                      <button onClick={() => setStatus(s.id, 'approved')} disabled={busy}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} {t('admin.suppliers.approve', { defaultValue: '승인' })}
                      </button>
                      <button onClick={() => setStatus(s.id, 'rejected')} disabled={busy}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                        <XCircle className="w-3 h-3" /> {t('admin.suppliers.reject', { defaultValue: '거부' })}
                      </button>
                    </>
                  )}
                  {s.status === 'approved' && (
                    <>
                      <button onClick={() => payout(s)} disabled={busy || s.available_amount <= 0}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />} {t('admin.suppliers.payout', { defaultValue: '지급 실행' })} ({formatWon(s.available_amount)})
                      </button>
                      <button onClick={() => setStatus(s.id, 'suspended')} disabled={busy}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                        <Ban className="w-3 h-3" /> {t('admin.suppliers.suspend', { defaultValue: '정지' })}
                      </button>
                    </>
                  )}
                  {s.status === 'suspended' && (
                    <button onClick={() => setStatus(s.id, 'approved')} disabled={busy}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                      <CheckCircle className="w-3 h-3" /> {t('admin.suppliers.reactivate', { defaultValue: '재활성화' })}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
