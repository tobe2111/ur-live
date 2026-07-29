import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { FileText, CheckCircle } from 'lucide-react'

// 🧾 2026-07-01: 정산 매입세금계산서 역발행(셀러→플랫폼) — 셀러 목록 + 승인.
//   유어딜이 정산 지급액에 대해 초안을 자동 작성 → 셀러는 여기서 '승인' 클릭(카카오 애드핏 = 유니포스트 역발행).
export interface SettlementTaxInvoice {
  id: number
  settlement_id: number
  supply_amount: number
  vat_amount: number
  total_amount: number
  period: string | null
  status: string
  nts_confirm_num: string | null
  created_at: string
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: '발행대기', cls: 'bg-amber-50 text-amber-700' },
  requested: { label: '승인대기', cls: 'bg-blue-50 text-blue-700' },
  approved: { label: '승인완료', cls: 'bg-indigo-50 text-indigo-700' },
  issued: { label: '발행완료', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '발행실패', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
}
const APPROVABLE = new Set(['draft', 'requested', 'failed'])

export default function SettlementTaxInvoicesSection() {
  const { t } = useTranslation()
  const [approving, setApproving] = useState<number | null>(null)

  const q = useApiQuery<SettlementTaxInvoice[]>(
    ['seller', 'settlement-tax-invoices'],
    '/api/seller/settlement-tax-invoices',
    { select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const items = q.data ?? []

  async function approve(id: number) {
    setApproving(id)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.post(`/api/seller/settlement-tax-invoices/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data?.success) {
        toast.success(t('seller.taxinv.approved', { defaultValue: '세금계산서를 승인했습니다' }))
        q.refetch()
      } else {
        toast.error(res.data?.error || t('seller.taxinv.approveFailed', { defaultValue: '승인에 실패했습니다' }))
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || t('seller.taxinv.approveFailed', { defaultValue: '승인에 실패했습니다' }))
    } finally {
      setApproving(null)
    }
  }

  // 역발행 세금계산서가 하나도 없으면 섹션 자체를 접어 안내만(사업자 유저 아닌 셀러엔 비어 있음).
  if (!q.isLoading && items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <FileText className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">{t('seller.taxinv.title', { defaultValue: '세금계산서 (역발행)' })}</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          {t('seller.taxinv.emptyDesc', { defaultValue: '사업자 유저 셀러에게 정산금이 입금되면, 유어딜이 매입세금계산서를 역발행해 드립니다. 여기서 승인 한 번이면 발행이 완료됩니다 — 직접 발행하실 필요가 없습니다.' })}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">{t('seller.taxinv.title', { defaultValue: '세금계산서 (역발행)' })}</h3>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {t('seller.taxinv.desc', { defaultValue: '유어딜이 정산 지급액에 대한 매입세금계산서를 역발행합니다. 승인하시면 발행이 확정됩니다.' })}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3">{t('seller.taxinv.period', { defaultValue: '귀속' })}</th>
              <th className="text-right font-medium px-4 py-3">{t('seller.taxinv.supply', { defaultValue: '공급가액' })}</th>
              <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">{t('seller.taxinv.vat', { defaultValue: '부가세' })}</th>
              <th className="text-right font-medium px-4 py-3">{t('seller.taxinv.total', { defaultValue: '합계' })}</th>
              <th className="text-center font-medium px-4 py-3">{t('seller.taxinv.status', { defaultValue: '상태' })}</th>
              <th className="text-right font-medium px-4 py-3">{t('common.action', { defaultValue: '처리' })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((inv) => {
              const st = STATUS_META[inv.status] || STATUS_META.draft
              return (
                <tr key={inv.id}>
                  <td className="px-4 py-3 text-gray-900">{inv.period || `#${inv.settlement_id}`}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatWon(inv.supply_amount)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{formatWon(inv.vat_amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatWon(inv.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {APPROVABLE.has(inv.status) ? (
                      <button
                        onClick={() => approve(inv.id)}
                        disabled={approving === inv.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {approving === inv.id ? t('common.processing', { defaultValue: '처리 중…' }) : t('seller.taxinv.approve', { defaultValue: '승인' })}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{inv.nts_confirm_num ? `#${inv.nts_confirm_num}` : '—'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
