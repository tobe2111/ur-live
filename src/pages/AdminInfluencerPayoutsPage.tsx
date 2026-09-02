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
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { computeCashPayout } from '@/shared/influencer-payout-math'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading, DashboardLoadError } from '@/components/dashboard'
import { Wallet, CheckCircle, RefreshCw } from 'lucide-react'
import { parseUTCDate } from '@/utils/date'

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

// 💰 2026-08-31: 이 화면이 갖고 있던 자체 계산을 `computeCashPayout` SSOT 로 위임.
//   원천징수가 cron · 라우트 · 이 화면 **세 곳**에서 따로 계산되고 있었고, 현금 정산 수수료를
//   얹으면 네 번째가 된다. 갈리면 "화면엔 90만원인데 실제로는 88만원" 이 되고 그건 돈 문제다.
//   수수료율은 서버 응답(`cash_fee_pct`)에서 받는다 — 프론트가 자기 기본값을 들고 있으면
//   대표가 어드민에서 율을 바꿔도 이 화면만 옛 숫자를 보여준다.

export default function AdminInfluencerPayoutsPage() {
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (list + payout_min).
  const { data: payoutData, isLoading: loading, isError, error, refetch } = useApiQuery<{ list: PayoutRow[]; payout_min: number; cash_fee_pct: number }>(
    ['admin', 'influencer-payouts'], '/api/admin-payouts/payouts',
    { select: (r: any) => (r?.success ? { list: r.data.list || [], payout_min: r.data.payout_min || 100000, cash_fee_pct: r.data.cash_fee_pct ?? 0 } : { list: [], payout_min: 100000, cash_fee_pct: 0 }) },
  )
  const list = payoutData?.list ?? []
  const payoutMin = payoutData?.payout_min ?? 100000
  // 💰 수수료율은 **서버가 준 값만** 쓴다(`?? 0`). 자체 기본값을 두면 대표가 율을 바꿔도
  //   이 화면만 옛 숫자를 보여준다 — 실지급과 갈리는 그 사고를 막는다.
  const cashFeePct = payoutData?.cash_fee_pct ?? 0
  const load = () => refetch()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  // 🛡️ 2026-05-16: 정렬/필터 추가
  const [sortBy, setSortBy] = useState<'available_desc' | 'available_asc' | 'paid_desc' | 'updated_desc'>('available_desc')
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'deal'>('all')
  const [accountFilter, setAccountFilter] = useState<'all' | 'ok' | 'missing'>('all')

  function toggleSelect(id: string) {
    setSelectedIds(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredSorted.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredSorted.map(r => r.influencer_id)))
  }
  async function bulkProcess() {
    const targets = list.filter(r => selectedIds.has(r.influencer_id))
    if (targets.length === 0) { toast.error('선택된 항목 없음'); return }
    const cashCount = targets.filter(r => r.payout_method !== 'deal' && r.bank_name && r.bank_account && r.account_holder).length
    const dealCount = targets.filter(r => r.payout_method === 'deal').length
    const skipCount = targets.length - cashCount - dealCount
    if (!(await confirmDialog(`${targets.length}건 일괄 처리:\n- 현금 ${cashCount}건 (송금 후 status='paid')\n- 딜 ${dealCount}건 (즉시 적립)\n- 계좌 누락 ${skipCount}건 (skip)\n진행?`))) return
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


  async function process(row: PayoutRow) {
    const method = row.payout_method || 'cash'
    const w = computeCashPayout({ gross: row.available_amount, taxType: row.tax_type, businessNumber: row.business_number, feePct: cashFeePct })
    const msg = method === 'deal'
      ? `${row.influencer_id} 에게 딜로 ${row.available_amount.toLocaleString()}원 (+ 보너스) 지급?`
      : `${row.influencer_id} 에게 현금 ${w.net.toLocaleString()}원 (${w.fee > 0 ? `정산수수료 ${w.feePct}% = ${w.fee.toLocaleString()}원, ` : ''}원천징수 ${w.withholdingPct}% = ${w.withholding.toLocaleString()}원) 송금 완료 처리?\n\n계좌: ${row.bank_name || '-'} ${row.bank_account || '-'} (${row.account_holder || '-'})`
    if (!(await confirmDialog(msg))) return
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
  // 🛡️ 2026-07-01 (어드민 라이브 감사): 5xx/401/403 을 "송금 대기 0명 · ₩0" 으로 위장하지 않도록 표면화 (미지급 오인 방지).
  if (isError) return <AdminLayout title="인플루언서 송금"><div className="p-6"><DashboardLoadError error={error} onRetry={() => refetch()} loginPath="/admin/login" label="인플루언서 송금 목록" /></div></AdminLayout>

  // 정렬/필터 적용
  const filteredSorted = list
    .filter(r => methodFilter === 'all' || r.payout_method === methodFilter)
    .filter(r => {
      if (accountFilter === 'all') return true
      const ok = r.payout_method === 'deal' || (r.bank_name && r.bank_account && r.account_holder)
      return accountFilter === 'ok' ? ok : !ok
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'available_asc': return a.available_amount - b.available_amount
        case 'paid_desc': return b.total_paid_out - a.total_paid_out
        case 'updated_desc': return parseUTCDate(b.updated_at).getTime() - parseUTCDate(a.updated_at).getTime()
        case 'available_desc':
        default: return b.available_amount - a.available_amount
      }
    })

  const totalPending = filteredSorted.reduce((s, r) => s + r.available_amount, 0)

  return (
    <AdminLayout title="인플루언서 송금">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="인플루언서 송금"
          subtitle={`지급 대기 ${list.length}명 · 합계 ${totalPending.toLocaleString()}원 (현금은 ${payoutMin.toLocaleString()}원 이상 · 딜은 금액 제한 없음)`}
          icon={<Wallet className="h-5 w-5" />}
          actions={
            <div className="flex gap-2">
              <button onClick={load} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> 새로고침</button>
              <button
                onClick={bulkProcess}
                disabled={selectedIds.size === 0 || bulkProcessing}
                className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg font-bold disabled:opacity-40"
              >
                선택 일괄 처리 ({selectedIds.size})
              </button>
            </div>
          }
        />

        {/* 정렬/필터 */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl p-3">
          <label className="text-[11px] text-gray-700">정렬</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            <option value="available_desc">잔액 ↓</option>
            <option value="available_asc">잔액 ↑</option>
            <option value="paid_desc">누적 송금 ↓</option>
            <option value="updated_desc">최근 업데이트</option>
          </select>
          <span className="text-gray-300 mx-1">·</span>
          <label className="text-[11px] text-gray-700">방식</label>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as typeof methodFilter)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            <option value="all">전체</option>
            <option value="cash">현금</option>
            <option value="deal">딜</option>
          </select>
          <span className="text-gray-300 mx-1">·</span>
          <label className="text-[11px] text-gray-700">계좌</label>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value as typeof accountFilter)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            <option value="all">전체</option>
            <option value="ok">등록됨</option>
            <option value="missing">미등록</option>
          </select>
          <span className="text-[10px] text-gray-500 ml-auto">표시 {filteredSorted.length} / 전체 {list.length}건</span>
        </div>

        {filteredSorted.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">송금 대기 중인 인플루언서가 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">매일 19시 cron 이 pending→available 자동 전환합니다.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-2"><input type="checkbox" checked={selectedIds.size === filteredSorted.length && filteredSorted.length > 0} onChange={toggleSelectAll} /></th>
                  <th className="text-left px-4 py-2 font-medium">인플루언서</th>
                  <th className="text-right px-4 py-2 font-medium">잔액</th>
                  <th className="text-center px-4 py-2 font-medium">방식</th>
                  <th className="text-right px-4 py-2 font-medium">실송금</th>
                  <th className="text-center px-4 py-2 font-medium">계좌</th>
                  <th className="text-center px-4 py-2 font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((r) => {
                  const w = computeCashPayout({ gross: r.available_amount, taxType: r.tax_type, businessNumber: r.business_number, feePct: cashFeePct })
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
                            <p className="text-[10px] text-gray-500">
                              {w.fee > 0 && <>수수료 {w.feePct}% · </>}원천 {w.withholdingPct}%
                            </p>
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
                          className="px-3 py-1.5 text-[11px] font-bold bg-gray-900 text-white rounded-lg disabled:opacity-40"
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
