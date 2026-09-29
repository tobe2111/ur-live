/**
 * 🛡️ 2026-05-21 Phase D-3: 셀러/에이전시 본인 ledger UI.
 *
 * URL:
 *   - 셀러: /seller/ledger (인플루언서 commission + 위탁 판매 매출)
 *
 * 두 dashboard 컨텍스트 공통 페이지 — token type 으로 자동 분기.
 */
import { useEffect, useState } from 'react'
import { OkIcon, ClockIcon, WalletIcon } from '@/components/icons/urdeal-icons'
import { formatKSTDate } from '@/utils/date'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { CreditCard, Handshake, List, RotateCcw, Send, TrendingUp, type LucideIcon } from 'lucide-react'
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

const EVENT_LABEL: Record<string, { label: string; Icon: LucideIcon }> = {
  voucher_used: { label: '바우처 사용', Icon: OkIcon },
  voucher_refund: { label: '환불', Icon: RotateCcw },
  group_buy_join: { label: '공구 참여', Icon: Handshake },
  charge: { label: '충전', Icon: CreditCard },
  refund: { label: '환불', Icon: RotateCcw },
  settlement: { label: '정산', Icon: WalletIcon },
}

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '검토 대기', cls: 'bg-tone-warn-bg text-tone-warn' },
  approved: { label: '승인됨', cls: 'bg-tone-info-bg text-tone-info' },
  sent: { label: '송금완료', cls: 'bg-tone-ok-bg text-tone-ok' },
  failed: { label: '실패', cls: 'bg-tone-bad-bg text-tone-bad' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
}

export default function MyLedgerPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 🌇 2026-09-04 에이전시 일몰 — 경로로 agency/seller 를 가르던 분기 삭제. 셀러 전용이다.
    if (!localStorage.getItem('seller_token')) {
      navigate('/seller/login')
      return
    }
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/api/ledger/my')
      if (res.data?.success) setData(res.data.data)
    } catch {
      // 🛡️ 2026-05-31: catch 추가 (이전: 없음 → unhandled rejection). data=null 유지 → "불러올 수 없습니다" 표시.
    } finally { setLoading(false) }
  }

  const content = (
    <div className="mx-auto max-w-5xl space-y-6">
      <DashboardPageHeader
        icon={<WalletIcon className="h-5 w-5" />}
        title="내 ledger (정산 원장)"
        subtitle="모든 돈 흐름의 단일 source of truth — 발생액 / 송금완료 / 미정산 잔액"
      />

      {loading ? (
        <p className="text-center text-[15px] text-gray-400 py-16">불러오는 중...</p>
      ) : !data ? (
        <p className="text-center text-[15px] text-gray-400 py-16">데이터를 불러올 수 없습니다.</p>
      ) : (
        <>
          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-[12px] text-gray-500"><TrendingUp className="w-3.5 h-3.5" /> 누적 발생액</div>
              <p className="text-[17px] font-bold text-gray-900 mt-1">{formatWon(data.summary.total_earned)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-[12px] text-gray-500"><Send className="w-3.5 h-3.5" /> 송금 완료</div>
              <p className="text-[17px] font-bold text-emerald-600 mt-1">{formatWon(data.summary.total_paid)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1 text-[12px] text-gray-500"><ClockIcon className="w-3.5 h-3.5" /> 미정산 잔액</div>
              <p className="text-[17px] font-bold text-amber-600 mt-1">{formatWon(data.summary.pending)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-[12px] text-gray-500">총 entries</div>
              <p className="text-[17px] font-bold text-gray-900 mt-1">{data.summary.entry_count}건</p>
            </div>
          </div>

          {/* 송금 이력 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-gray-900">최근 송금 이력</h2>
            </div>
            {data.recent_payouts.length === 0 ? (
              <p className="text-center text-[12px] text-gray-400 py-8">아직 송금 이력이 없습니다.</p>
            ) : (
              <>
              {/* 📱 2026-09-27 폰: 표 대신 한 건 한 줄. 실측(366px)에서 4열 표는 잘리지는 않지만
                  행이 81px 로 부풀고 '정산 기간'·'TX ID' 가 여러 줄로 감긴다. `SellerProductsPage` 가
                  쓰는 방식(표=PC / 카드=폰)을 따른다. 데이터·동작 동일. */}
              <div className="lg:hidden divide-y divide-gray-100">
                {data.recent_payouts.map(p => {
                  const meta = PAYOUT_STATUS[p.status] ?? { label: p.status || '처리 중', cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={p.id} className="px-4 py-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-bold text-gray-900 tabular-nums">{formatWon(p.amount)}</span>
                        <span className={`inline-block px-2 py-1 rounded-full text-[12px] font-medium ${meta.cls}`}>{meta.label}</span>
                        {p.sent_at && <span className="ml-auto text-[12px] text-gray-400">{formatKSTDate(p.sent_at)}</span>}
                      </div>
                      <p className="mt-1 text-[12px] text-gray-600">{p.period_start} ~ {p.period_end}</p>
                      {p.transaction_id && <p className="text-[12px] text-gray-400 tabular-nums truncate">{p.transaction_id}</p>}
                    </div>
                  )
                })}
              </div>
              <table className="hidden lg:table w-full text-[12px]">
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
                    // 🛡️ 2026-07-02: 정의 밖 status 방어 — meta undefined 렌더 크래시 방지.
                    const meta = PAYOUT_STATUS[p.status] ?? { label: p.status || '처리 중', cls: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">{p.period_start} ~ {p.period_end}</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">{formatWon(p.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-[12px] font-medium ${meta.cls}`}>{meta.label}</span>
                          {p.sent_at && <div className="text-[12px] text-gray-400 mt-1">{formatKSTDate(p.sent_at)}</div>}
                        </td>
                        <td className="px-4 py-2 text-gray-700 tabular-nums">{p.transaction_id || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>

          {/* ledger entries */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-gray-900">최근 ledger entries (최대 50개)</h2>
            </div>
            {data.entries.length === 0 ? (
              <p className="text-center text-[12px] text-gray-400 py-8">아직 ledger entry 가 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.entries.map(e => {
                  const ev = EVENT_LABEL[e.event_type] || { label: e.event_type, Icon: List }
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ev.Icon className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{ev.label}</p>
                          <p className="text-[12px] text-gray-400 tabular-nums truncate">{e.reference_id}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-gray-900">{formatWon(e.amount)}</p>
                        <p className="text-[12px] text-gray-400">{formatKSTDate(e.created_at)}</p>
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

  return <SellerLayout title="내 ledger">{content}</SellerLayout>
}
