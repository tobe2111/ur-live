import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Receipt, Loader2, FileText, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

// 🏭 TAX-1 (2026-06-08) 어드민 도매 세무 — 미수/미지급 aging 리포트 + 매입(역발행) 세금계산서.
//   라이트 고정 대시보드 테마(dark: 미사용). 역발행은 수동 1회 기록(자동 발사 X).

interface Buckets { b0_7: number; b8_30: number; b31_60: number; b60_plus: number; total: number; count: number }
interface SupplierAging extends Buckets { supplier_id: number; supplier_name: string | null }
interface DistributorAging extends Buckets { seller_id: number; name: string | null; username: string | null }
interface AgingResp {
  payable: { summary: Buckets; by_supplier: SupplierAging[] }
  receivable: { summary: Buckets; by_distributor: DistributorAging[] }
  as_of: string
}
interface InvoiceCandidate {
  supplier_id: number
  supplier_name: string | null
  business_number: string | null
  paid_amount: number
  supply_amount: number
  vat_amount: number
  total_amount: number
  settlement_count: number
  invoice_status: 'none' | 'pending' | 'issued'
  barobill_ref: string | null
  issued_at: string | null
}

const BUCKET_STYLE = [
  'text-emerald-700',  // 0-7d
  'text-amber-700',    // 8-30d
  'text-orange-700',   // 31-60d
  'text-rose-700',     // 60d+
]
const BUCKET_LABELS = ['0-7일', '8-30일', '31-60일', '60일+']

function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function BucketCells({ b }: { b: Buckets }) {
  const vals = [b.b0_7, b.b8_30, b.b31_60, b.b60_plus]
  return (
    <>
      {vals.map((v, i) => (
        <td key={i} className={`py-2.5 px-4 text-right tabular-nums ${v > 0 ? BUCKET_STYLE[i] : 'text-gray-300'}`}>
          {formatWon(v)}
        </td>
      ))}
      <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900">{formatWon(b.total)}</td>
    </>
  )
}

export default function AdminWholesaleTaxPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const [tab, setTab] = useState<'aging' | 'invoices'>('aging')
  const [period, setPeriod] = useState(currentPeriod())
  const [issuing, setIssuing] = useState<number | null>(null)

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  const { data: aging, isLoading: agingLoading } = useApiQuery<AgingResp | null>(
    ['admin', 'wholesale-aging'], '/api/admin/wholesale/tax/aging',
    { headers: h.headers, select: (r: any) => (r?.success ? r : null), enabled: tab === 'aging' },
  )

  const { data: candidates = [], isLoading: invLoading, refetch: refetchInv } = useApiQuery<InvoiceCandidate[]>(
    ['admin', 'wholesale-purchase-invoices', period], '/api/admin/wholesale/tax/purchase-invoices',
    { params: { period }, headers: h.headers, select: (r: any) => (r?.success ? r.candidates || [] : []), enabled: tab === 'invoices' && /^\d{4}-\d{2}$/.test(period) },
  )

  const payableSum = aging?.payable?.summary
  const receivableSum = aging?.receivable?.summary

  const issuableCount = useMemo(() => candidates.filter(c => c.invoice_status === 'none').length, [candidates])

  async function issue(cand: InvoiceCandidate) {
    if (cand.invoice_status !== 'none') return
    const ok = await confirmDialog({
      message: `${cand.supplier_name || `공급사 #${cand.supplier_id}`} — ${period} 매입분 ${formatWon(cand.total_amount)} (공급가 ${formatWon(cand.supply_amount)} + 부가세 ${formatWon(cand.vat_amount)})\n역발행 세금계산서를 기록할까요?\n\n※ 실제 전자세금계산서는 검증 후 별도 발행됩니다(이 단계는 발행 의도 기록).`,
    })
    if (!ok) return
    setIssuing(cand.supplier_id)
    try {
      const r = await api.post('/api/admin/wholesale/tax/purchase-invoices/issue', { supplier_id: cand.supplier_id, period }, h)
      if (!r.data?.success) { toast.error(r.data?.error || t('common.error', { defaultValue: '처리 실패' })); return }
      toast.success(r.data?.already ? t('admin.wsTax.alreadyRecorded', { defaultValue: '이미 기록됨' }) : t('admin.wsTax.recorded', { defaultValue: '역발행 기록 완료' }))
      refetchInv()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('common.error', { defaultValue: '오류' }))
    } finally { setIssuing(null) }
  }

  return (
    <AdminLayout title={t('admin.wsTax.title', { defaultValue: '도매 세무/정산' })}>
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader
          icon={<Receipt className="w-5 h-5" />}
          title={t('admin.wsTax.heading', { defaultValue: '도매 미수/미지급 + 매입 세금계산서' })}
          subtitle={t('admin.wsTax.subtitle', { defaultValue: '공급사 미지급·유통사 미수 aging + 제조사→유통스타트 매입(역발행) 세금계산서' })}
        />

        <div className="flex items-center gap-2 my-4">
          <button onClick={() => setTab('aging')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${tab === 'aging' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {t('admin.wsTax.tabAging', { defaultValue: '미수/미지급 Aging' })}
          </button>
          <button onClick={() => setTab('invoices')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${tab === 'invoices' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {t('admin.wsTax.tabInvoices', { defaultValue: '매입 세금계산서(역발행)' })}
          </button>
        </div>

        {/* ── Aging 탭 ─────────────────────────────────────────── */}
        {tab === 'aging' && (
          agingLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-8">
              {/* 요약 카드 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="text-sm font-semibold text-gray-500 mb-1">{t('admin.wsTax.payableTotal', { defaultValue: '미지급 합계 (공급사)' })}</div>
                  <div className="text-2xl font-bold text-gray-900">{formatWon(payableSum?.total || 0)}</div>
                  <div className="text-xs text-gray-400 mt-1">{payableSum?.count || 0}건 미정산</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="text-sm font-semibold text-gray-500 mb-1">{t('admin.wsTax.receivableTotal', { defaultValue: '미수 합계 (유통사 외상)' })}</div>
                  <div className="text-2xl font-bold text-gray-900">{formatWon(receivableSum?.total || 0)}</div>
                  <div className="text-xs text-gray-400 mt-1">{receivableSum?.count || 0}개 유통사</div>
                </div>
              </div>

              {/* 미지급 (공급사) */}
              <section>
                <h3 className="text-base font-bold text-gray-900 mb-2">{t('admin.wsTax.payable', { defaultValue: '미지급 — 공급사 미정산' })}</h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-2.5 px-4 font-medium">공급사</th>
                        {BUCKET_LABELS.map((l, i) => <th key={i} className={`py-2.5 px-4 font-medium text-right ${BUCKET_STYLE[i]}`}>{l}</th>)}
                        <th className="py-2.5 px-4 font-medium text-right">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aging?.payable?.summary && (
                        <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
                          <td className="py-2.5 px-4 text-gray-900">{t('admin.wsTax.all', { defaultValue: '전체' })}</td>
                          <BucketCells b={aging.payable.summary} />
                        </tr>
                      )}
                      {(aging?.payable?.by_supplier || []).map(s => (
                        <tr key={s.supplier_id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-gray-900">{s.supplier_name || `#${s.supplier_id}`}</td>
                          <BucketCells b={s} />
                        </tr>
                      ))}
                      {(!aging?.payable?.by_supplier || aging.payable.by_supplier.length === 0) && (
                        <tr><td colSpan={6} className="text-center text-gray-400 py-10">{t('admin.wsTax.noPayable', { defaultValue: '미지급 정산이 없습니다.' })}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 미수 (유통사) */}
              <section>
                <h3 className="text-base font-bold text-gray-900 mb-2">{t('admin.wsTax.receivable', { defaultValue: '미수 — 유통사 외상 잔액' })}</h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-2.5 px-4 font-medium">유통사</th>
                        {BUCKET_LABELS.map((l, i) => <th key={i} className={`py-2.5 px-4 font-medium text-right ${BUCKET_STYLE[i]}`}>{l}</th>)}
                        <th className="py-2.5 px-4 font-medium text-right">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aging?.receivable?.summary && (
                        <tr className="border-b border-gray-100 bg-gray-50 font-semibold">
                          <td className="py-2.5 px-4 text-gray-900">{t('admin.wsTax.all', { defaultValue: '전체' })}</td>
                          <BucketCells b={aging.receivable.summary} />
                        </tr>
                      )}
                      {(aging?.receivable?.by_distributor || []).map(d => (
                        <tr key={d.seller_id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-gray-900">{d.name || d.username || `#${d.seller_id}`}</td>
                          <BucketCells b={d} />
                        </tr>
                      ))}
                      {(!aging?.receivable?.by_distributor || aging.receivable.by_distributor.length === 0) && (
                        <tr><td colSpan={6} className="text-center text-gray-400 py-10">{t('admin.wsTax.noReceivable', { defaultValue: '미수(외상) 잔액이 없습니다.' })}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {aging?.as_of && (
                <p className="text-[11px] text-gray-400">{t('admin.wsTax.asOf', { defaultValue: '기준' })}: {new Date(aging.as_of).toLocaleString('ko-KR')}</p>
              )}
            </div>
          )
        )}

        {/* ── 매입 세금계산서(역발행) 탭 ─────────────────────────── */}
        {tab === 'invoices' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-600">{t('admin.wsTax.period', { defaultValue: '기간' })}</label>
              <input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900"
              />
              {!invLoading && <span className="text-sm text-gray-500">{t('admin.wsTax.issuable', { defaultValue: '발행가능' })} {issuableCount}건</span>}
            </div>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('admin.wsTax.manualNote', { defaultValue: '역발행은 수동 1회 기록입니다. 실제 전자세금계산서(바로빌) 발행은 staging 검증 + 최종 승인 후 별도 처리됩니다 — 자동 발행되지 않습니다.' })}</span>
            </div>

            {invLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
            ) : candidates.length === 0 ? (
              <p className="text-center text-gray-400 py-20">{t('admin.wsTax.noCandidates', { defaultValue: '해당 기간에 매입(지급된 정산) 내역이 없습니다.' })}</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2.5 px-4 font-medium">공급사</th>
                      <th className="py-2.5 px-4 font-medium">사업자번호</th>
                      <th className="py-2.5 px-4 font-medium text-right">공급가액</th>
                      <th className="py-2.5 px-4 font-medium text-right">부가세</th>
                      <th className="py-2.5 px-4 font-medium text-right">합계</th>
                      <th className="py-2.5 px-4 font-medium">상태</th>
                      <th className="py-2.5 px-4 font-medium text-right">역발행</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(c => (
                      <tr key={c.supplier_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-4 text-gray-900">{c.supplier_name || `#${c.supplier_id}`}</td>
                        <td className="py-2.5 px-4 text-gray-500">{c.business_number || '-'}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">{formatWon(c.supply_amount)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">{formatWon(c.vat_amount)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold text-gray-900">{formatWon(c.total_amount)}</td>
                        <td className="py-2.5 px-4">
                          {c.invoice_status === 'issued' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">발행완료</span>
                          ) : c.invoice_status === 'pending' ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">기록됨(대기)</span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">미기록</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {c.invoice_status === 'none' ? (
                            <button
                              onClick={() => issue(c)}
                              disabled={issuing === c.supplier_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                            >
                              {issuing === c.supplier_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                              {t('admin.wsTax.issue', { defaultValue: '역발행 기록' })}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">{t('admin.wsTax.done', { defaultValue: '완료' })}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
