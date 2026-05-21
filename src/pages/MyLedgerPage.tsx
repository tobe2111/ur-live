/**
 * 🛡️ 2026-05-21 Phase D-3: 셀러/에이전시 본인 ledger UI.
 *
 * URL:
 *   - 셀러: /seller/ledger (인플루언서 commission + 위탁 판매 매출)
 *   - 에이전시: /agency/ledger (commission 분배)
 *
 * 두 dashboard 컨텍스트 공통 페이지 — token type 으로 자동 분기.
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Wallet, TrendingUp, Send, Clock } from 'lucide-react'
import { formatWon } from '@/utils/format'

interface LedgerEntry {
  id: number
  event_type: string
  reference_id: string
  amount: number
  debit_account: string
  credit_account: string
  fee_amount: number
  metadata: Record<string, unknown> | null
  created_at: string
}

interface PayoutRow {
  id: number
  amount: number
  status: 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled'
  period_start: string
  period_end: string
  sent_at: string | null
  transaction_id: string | null
}

interface LedgerData {
  summary: { total_earned: number; total_paid: number; pending: number; entry_count: number }
  entries: LedgerEntry[]
  recent_payouts: PayoutRow[]
}

const EVENT_LABEL: Record<string, { label: string; emoji: string }> = {
  voucher_used: { label: '바우처 사용', emoji: '✅' },
  voucher_refund: { label: '환불', emoji: '↩️' },
  agency_commission: { label: '에이전시 commission', emoji: '🤵' },
  group_buy_join: { label: '공구 참여', emoji: '🤝' },
  charge: { label: '충전', emoji: '💳' },
  refund: { label: '환불', emoji: '↩️' },
  settlement: { label: '정산', emoji: '💰' },
}

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '검토 대기', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인됨', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: '송금완료', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
}

export default function MyLedgerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAgency = location.pathname.startsWith('/agency')
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tokenKey = isAgency ? 'agency_token' : 'seller_token'
    if (!localStorage.getItem(tokenKey)) {
      navigate(isAgency ? '/agency/login' : '/seller/login')
      return
    }
    load()
  }, [isAgency])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/api/ledger/my')
      if (res.data?.success) setData(res.data.data)
    } finally { setLoading(false) }
  }

  const content = (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <DashboardPageHeader
        icon={<Wallet className="h-5 w-5" />}
        title="내 ledger (정산 원장)"
        subtitle="모든 돈 흐름의 단일 source of truth — 발생액 / 송금완료 / 미정산 잔액"
      />

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-16">불러오는 중...</p>
      ) : !data ? (
        <p className="text-center text-sm text-gray-400 py-16">데이터를 불러올 수 없습니다.</p>
      ) : (
        <>
          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500"><TrendingUp className="w-3.5 h-3.5" /> 누적 발생액</div>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatWon(data.summary.total_earned)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Send className="w-3.5 h-3.5" /> 송금 완료</div>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatWon(data.summary.total_paid)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" /> 미정산 잔액</div>
              <p className="text-xl font-bold text-amber-600 mt-1">{formatWon(data.summary.pending)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500">총 entries</div>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.entry_count}건</p>
            </div>
          </div>

          {/* 송금 이력 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">최근 송금 이력</h2>
            </div>
            {data.recent_payouts.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">아직 송금 이력이 없습니다.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500">
                    <th className="px-4 py-2 text-left">정산 기간</th>
                    <th className="px-4 py-2 text-right">금액</th>
                    <th className="px-4 py-2 text-center">상태</th>
                    <th className="px-4 py-2 text-left">TX ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_payouts.map(p => {
                    const meta = PAYOUT_STATUS[p.status]
                    return (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">{p.period_start} ~ {p.period_end}</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">{formatWon(p.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                          {p.sent_at && <div className="text-[10px] text-gray-400 mt-0.5">{new Date(p.sent_at).toLocaleDateString('ko-KR')}</div>}
                        </td>
                        <td className="px-4 py-2 text-gray-700 font-mono">{p.transaction_id || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ledger entries */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">최근 ledger entries (최대 50개)</h2>
            </div>
            {data.entries.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">아직 ledger entry 가 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.entries.map(e => {
                  const ev = EVENT_LABEL[e.event_type] || { label: e.event_type, emoji: '📋' }
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-base shrink-0">{ev.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{ev.label}</p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{e.reference_id}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-gray-900">{formatWon(e.amount)}</p>
                        <p className="text-[10px] text-gray-400">{new Date(e.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  return isAgency
    ? <AgencyLayout title="내 ledger">{content}</AgencyLayout>
    : <SellerLayout title="내 ledger">{content}</SellerLayout>
}
