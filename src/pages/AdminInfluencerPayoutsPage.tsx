/**
 * 🛡️ 2026-05-16: 어드민 인플루언서 송금 처리 페이지.
 *
 * 송금 대기 목록 → 어드민이 본인 토스/카카오뱅크 송금 후 [처리 완료] 클릭 →
 * attribution status='paid' + balance available=0 + total_paid_out += amount.
 *
 * 딜 선택 인플은 외부 송금 불필요 — 클릭 시 즉시 user_points 적립.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Wallet, CheckCircle, RefreshCw } from 'lucide-react'

interface PayoutRow {
  influencer_id: string
  available_amount: number
  total_paid_out: number
  payout_method: 'cash' | 'deal'
  business_number: string | null
  tax_type: 'business_income' | 'other_income' | 'unreported' | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  updated_at: string
}

function calcWithholding(amount: number, taxType: string | null, businessNumber: string | null): { rate: number; tax: number; net: number } {
  let rate = 0
  if (businessNumber || taxType === 'business_income') rate = 3.3
  else if (taxType === 'other_income') rate = 8.8
  const tax = Math.floor(amount * rate / 100)
  const net = amount - tax
  return { rate, tax, net }
}

export default function AdminInfluencerPayoutsPage() {
  const [list, setList] = useState<PayoutRow[]>([])
  const [payoutMin, setPayoutMin] = useState(100000)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  function toggleSelect(id: string) {
    setSelectedIds(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === list.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(list.map(r => r.influencer_id)))
  }
  async function bulkProcess() {
    const targets = list.filter(r => selectedIds.has(r.influencer_id))
    if (targets.length === 0) { toast.error('선택된 항목 없음'); return }
    const cashCount = targets.filter(r => r.payout_method !== 'deal' && r.bank_name && r.bank_account && r.account_holder).length
    const dealCount = targets.filter(r => r.payout_method === 'deal').length
    const skipCount = targets.length - cashCount - dealCount
    if (!confirm(`${targets.length}건 일괄 처리:\n- 현금 ${cashCount}건 (송금 후 status='paid')\n- 딜 ${dealCount}건 (즉시 적립)\n- 계좌 누락 ${skipCount}건 (skip)\n진행?`)) return
    setBulkProcessing(true)
    let ok = 0, fail = 0
    for (const r of targets) {
      if (r.payout_method !== 'deal' && (!r.bank_name || !r.bank_account || !r.account_holder)) { fail++; continue }
      try {
        const res = await api.post('/api/admin-payouts/payouts/process', { influencer_id: r.influencer_id, method: r.payout_method || 'cash' })
        if (res.data?.success) ok++; else fail++
      } catch { fail++ }
    }
    toast.success(`완료: 성공 ${ok}, 실패 ${fail}`)
    setSelectedIds(new Set())
    setBulkProcessing(false)
    load()
  }

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    api.get('/api/admin-payouts/payouts')
      .then((r) => {
        if (r.data?.success) {
          setList(r.data.data.list || [])
          setPayoutMin(r.data.data.payout_min || 100000)
        }
      })
      .catch(() => toast.error('데이터 로드 실패'))
      .finally(() => setLoading(false))
  }

  async function process(row: PayoutRow) {
    const method = row.payout_method || 'cash'
    const w = calcWithholding(row.available_amount, row.tax_type, row.business_number)
    const msg = method === 'deal'
      ? `${row.influencer_id} 에게 딜로 ${row.available_amount.toLocaleString()}원 (+ 보너스) 지급?`
      : `${row.influencer_id} 에게 현금 ${w.net.toLocaleString()}원 (원천징수 ${w.rate}% = ${w.tax.toLocaleString()}원) 송금 완료 처리?\n\n계좌: ${row.bank_name || '-'} ${row.bank_account || '-'} (${row.account_holder || '-'})`
    if (!confirm(msg)) return
    setProcessingId(row.influencer_id)
    try {
      const res = await api.post('/api/admin-payouts/payouts/process', { influencer_id: row.influencer_id, method })
      if (res.data?.success) {
        toast.success('처리 완료')
        load()
      } else {
        toast.error(res.data?.error || '처리 실패')
      }
    } catch { toast.error('처리 실패') }
    finally { setProcessingId(null) }
  }

  if (loading) return <AdminLayout title="인플루언서 송금"><div className="p-6"><DashboardLoading /></div></AdminLayout>

  const totalPending = list.reduce((s, r) => s + r.available_amount, 0)

  return (
    <AdminLayout title="인플루언서 송금">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="인플루언서 송금"
          subtitle={`송금 대기 ${list.length}명 · 합계 ${totalPending.toLocaleString()}원 (최소 ${payoutMin.toLocaleString()}원 이상)`}
          icon={<Wallet className="h-5 w-5" />}
          actions={
            <div className="flex gap-2">
              <button onClick={load} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> 새로고침</button>
              <button
                onClick={bulkProcess}
                disabled={selectedIds.size === 0 || bulkProcessing}
                className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-40"
              >
                선택 일괄 처리 ({selectedIds.size})
              </button>
            </div>
          }
        />

        {list.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">송금 대기 중인 인플루언서가 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">매일 19시 cron 이 pending→available 자동 전환합니다.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-2"><input type="checkbox" checked={selectedIds.size === list.length && list.length > 0} onChange={toggleSelectAll} /></th>
                  <th className="text-left px-4 py-2 font-medium">인플루언서</th>
                  <th className="text-right px-4 py-2 font-medium">잔액</th>
                  <th className="text-center px-4 py-2 font-medium">방식</th>
                  <th className="text-right px-4 py-2 font-medium">실송금</th>
                  <th className="text-center px-4 py-2 font-medium">계좌</th>
                  <th className="text-center px-4 py-2 font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const w = calcWithholding(r.available_amount, r.tax_type, r.business_number)
                  const accountOk = r.payout_method === 'deal' || (r.bank_name && r.bank_account && r.account_holder)
                  return (
                    <tr key={r.influencer_id} className="border-t border-gray-100">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(r.influencer_id)} onChange={() => toggleSelect(r.influencer_id)} /></td>
                      <td className="px-4 py-3 text-gray-900 font-mono text-xs">{r.influencer_id}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{r.available_amount.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-1 rounded font-bold ${r.payout_method === 'deal' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.payout_method === 'deal' ? '딜 (+보너스)' : '현금'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-700">
                        {r.payout_method === 'deal' ? '-' : (
                          <>
                            <p className="font-bold text-gray-900">{w.net.toLocaleString()}원</p>
                            <p className="text-[10px] text-gray-500">원천 {w.rate}%</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-[10px]">
                        {r.payout_method === 'deal' ? <span className="text-gray-400">-</span> : accountOk ? (
                          <span className="text-gray-700">{r.bank_name}<br />{r.bank_account}</span>
                        ) : (
                          <span className="text-red-600 font-bold">⚠️ 계좌 미등록</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => process(r)}
                          disabled={!accountOk || processingId === r.influencer_id}
                          className="px-3 py-1.5 text-[11px] font-bold bg-emerald-500 text-white rounded-lg disabled:opacity-40"
                        >
                          <CheckCircle className="w-3 h-3 inline mr-1" /> {processingId === r.influencer_id ? '처리중' : '완료 처리'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-gray-500 text-center">
          현금 송금 = 본인 토스/카카오뱅크 앱에서 직접 송금 후 위 버튼 클릭 (외부 PG 연동 전)<br />
          딜 송금 = 클릭 즉시 인플 user_points 적립 + 보너스 % 자동
        </p>
      </div>
    </AdminLayout>
  )
}
