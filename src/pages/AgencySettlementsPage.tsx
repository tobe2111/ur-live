import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { DollarSign, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'

export default function AgencySettlementsPage() {
  const { t } = useTranslation()
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (data+summary).
  const { data: settle, isLoading: loading, refetch } = useApiQuery<{ data: any[]; summary: any }>(
    ['agency', 'settlements'], '/api/agency/settlements',
    { select: (r: any) => (r?.success ? { data: r.data || [], summary: r.summary || {} } : { data: [], summary: {} }) },
  )
  const data = settle?.data ?? []
  const summary = settle?.summary ?? {}
  const load = () => refetch()

  const payableAmount = summary.total_agency_commission || 0
  const confirmedCount = summary.confirmed || 0
  // 🏁 2026-06-17 (전수조사): 수동 정산 신청 레일은 P3(2026-06-12)에 폐기 — 백엔드 POST /settlements/request 가
  //   410(RAIL_DEPRECATED) 반환. requestPayout/PIN 분기는 도달 불가 죽은 코드라 제거(자동 집계·매주 지급으로 대체).

  return (
    <AgencyLayout title={t('agency.settlements')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('agency.settlements')}
          subtitle={t('agency.settlementsSubtitle')}
          icon={<DollarSign className="h-5 w-5" />}
        />

        {/* 정산 신청 CTA */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-900 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">{t('agency.settlements.payableAmount', { defaultValue: '정산 가능 금액' })}</p>
              <p className="text-3xl font-extrabold mt-1">{formatNumber(payableAmount)}원</p>
              <p className="text-xs opacity-70 mt-2">{t('agency.settlements.confirmedOrders', { defaultValue: '확정 주문' })} {confirmedCount}{t('agency.settlements.countUnit', { defaultValue: '건' })} · {t('agency.settlements.commissionRate', { defaultValue: '수수료율' })} {summary.agency_commission_rate || 2}%</p>
            </div>
            {/* 🏁 2026-06-12 (P3 결정): 수동 정산 신청 레일 폐기 — 영입 커미션 자동 집계·매주 지급 */}
            <div className="text-right">
              <p className="text-sm font-bold bg-white/15 rounded-xl px-4 py-3">
                {t('agency.settlementsAuto.autoPayout', { defaultValue: '✨ 이제 신청이 필요 없어요' })}
              </p>
              <p className="text-[11px] opacity-80 mt-2 max-w-[220px]">
                {t('agency.settlementsAuto.autoPayoutDesc', { defaultValue: '영입 커미션이 자동 집계되어 매주 금요일 일괄 입금됩니다 (환불 보호를 위해 7일 경과분)' })}
              </p>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: t('common.all', { defaultValue: '전체' }), value: summary.total || 0, icon: DollarSign, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: t('agency.settlements.statusPending', { defaultValue: '대기' }), value: summary.pending || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: t('agency.settlements.statusConfirmed', { defaultValue: '확정' }), value: summary.confirmed || 0, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: t('agency.settlements.statusCompleted', { defaultValue: '완료' }), value: summary.completed || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('agency.settlements.colOrderNum', { defaultValue: '주문번호' })}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('agency.settlements.colSeller', { defaultValue: '셀러' })}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">{t('agency.settlements.colAmount', { defaultValue: '금액' })}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">{t('agency.settlements.colSettlementStatus', { defaultValue: '정산상태' })}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('common.date', { defaultValue: '날짜' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">{t('agency.settlements.noSettlements', { defaultValue: '정산 내역이 없습니다.' })}</td></tr>
                )}
                {data.map((r: { id: number; order_number: string; seller_name: string; total_amount?: number; settlement_status: string; created_at: string }) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-xs">{r.order_number}</td>
                    <td className="px-4 py-3">{r.seller_name}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatNumber(r.total_amount)}원</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.settlement_status === 'completed' ? 'bg-green-100 text-green-700' :
                        r.settlement_status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{r.settlement_status === 'completed' ? t('agency.settlements.statusCompleted', { defaultValue: '완료' }) : r.settlement_status === 'confirmed' ? t('agency.settlements.statusConfirmed', { defaultValue: '확정' }) : t('agency.settlements.statusPending', { defaultValue: '대기' })}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 🛡️ 2026-04-26 M6: 월별 송장 (자동 발행) */}
        <SettlementInvoicesSection />
      </div>
    </AgencyLayout>
  )
}

// 🛡️ 2026-04-26 M6: 월별 송장 섹션
interface InvoiceRow {
  id: number
  month: string
  invoice_number: string
  total_orders: number
  total_amount: number
  commission_rate: number
  commission_amount: number
  tax_amount: number
  net_amount: number
  status: 'draft' | 'issued' | 'paid' | 'cancelled'
  paid_at: string | null
  generated_by: string | null
  created_at: string
}

function SettlementInvoicesSection() {
  const { t } = useTranslation()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('agency_token')

  useEffect(() => {
    api.get('/api/agency/settlement-invoices', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data?.success) setInvoices(r.data.data || []) })
      .catch(swallow('agency:settlements-fetch-invoices'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const downloadInvoice = (inv: InvoiceRow) => {
    const url = `/api/agency/settlement-invoices/${inv.id}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.text())
      .then(html => {
        const blob = new Blob([html], { type: 'text/html' })
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      })
      .catch(() => toast.error(t('agency.settlements.invoiceDownloadFailed', { defaultValue: '송장 다운로드 실패' })))
  }

  if (loading) return null

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        📋 {t('agency.settlements.monthlyInvoices', { defaultValue: '월별 정산 명세서' })}
        <span className="text-[10px] text-gray-400 font-normal">{t('agency.settlements.autoIssued', { defaultValue: '매월 1일 자동 발행' })}</span>
      </h3>
      {invoices.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">
          {t('agency.settlements.noInvoices', { defaultValue: '아직 발행된 송장 없음 — 매월 1일 09:00 KST 이후 자동 발행됩니다.' })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">{t('agency.settlements.colMonth', { defaultValue: '월' })}</th>
                <th className="px-3 py-2 text-left">{t('agency.settlements.colInvoiceNum', { defaultValue: '송장번호' })}</th>
                <th className="px-3 py-2 text-right">{t('agency.settlements.colTotalRevenue', { defaultValue: '총 매출' })}</th>
                <th className="px-3 py-2 text-right">{t('agency.settlements.colCommission', { defaultValue: '수수료' })}</th>
                <th className="px-3 py-2 text-right">{t('agency.settlements.colNetAmount', { defaultValue: '실수령' })}</th>
                <th className="px-3 py-2 text-center">{t('common.status', { defaultValue: '상태' })}</th>
                <th className="px-3 py-2 text-center">{t('agency.settlements.colDownload', { defaultValue: '다운로드' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 font-medium">{inv.month}</td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{inv.invoice_number}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatNumber(inv.total_amount)}원</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatNumber(inv.commission_amount)}원</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatNumber(inv.net_amount)}원</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      inv.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {inv.status === 'paid' ? t('agency.settlements.invoicePaid', { defaultValue: '지급완료' }) : inv.status === 'issued' ? t('agency.settlements.invoiceIssued', { defaultValue: '발행됨' }) : inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => downloadInvoice(inv)}
                      className="text-xs text-blue-600 hover:underline font-bold">
                      {t('agency.settlements.openInvoice', { defaultValue: '열기' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
