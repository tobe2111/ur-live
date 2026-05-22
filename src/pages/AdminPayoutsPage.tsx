/**
 * 🛡️ 2026-05-21 Phase C: 어드민 통합 정산 페이지.
 *   /admin/payouts
 *
 * - pending 잔액 조회 (ledger credit - 이미 처리된 payouts)
 * - "정산 일괄 생성" 버튼 → pending payouts row 생성
 * - 각 payout: 승인 → 송금 완료 (transaction_id 입력) → audit
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Wallet, CheckCircle, Send, XCircle } from 'lucide-react'
import { formatWon } from '@/utils/format'

interface Payout {
  id: number
  payee_type: 'store_owner' | 'seller' | 'agency' | 'user'
  payee_id: string
  amount: number
  period_start: string
  period_end: string
  status: 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled'
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  transaction_id: string | null
  admin_memo: string | null
  error_message: string | null
  created_at: string
  approved_at: string | null
  sent_at: string | null
}

interface PendingRow {
  account: string
  pending_amount: number
  total_credited: number
  total_paid: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '검토 대기', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인됨', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: '송금 완료', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
}

export default function AdminPayoutsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pending_ledger' | 'payouts' | 'rates' | 'annual'>('pending_ledger')
  const [pending, setPending] = useState<PendingRow[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'sent' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  // 🛡️ 2026-05-21 Phase D: commission rates + 연말 리포트.
  const [rates, setRates] = useState({ platform_fee_pct: '5', seller_commission_pct: '10', agency_share_pct: '30', influencer_intro_share_pct: '20' })
  const [savingRates, setSavingRates] = useState(false)
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear() - 1))
  const [annualType, setAnnualType] = useState<'all' | 'store_owner' | 'seller' | 'agency'>('all')

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    load()
  }, [tab, filter])

  async function load() {
    try {
      setLoading(true)
      if (tab === 'pending_ledger') {
        const res = await api.get('/api/admin/payouts/pending')
        if (res.data?.success) setPending(res.data.data || [])
      } else if (tab === 'rates') {
        const res = await api.get('/api/admin/payouts/commission-rates')
        if (res.data?.success) setRates(res.data.data)
      } else if (tab === 'annual') {
        // 별도 fetch 없음 — UI 에서 download 버튼만
      } else {
        const res = await api.get(`/api/admin/payouts?status=${filter}`)
        if (res.data?.success) setPayouts(res.data.data || [])
      }
    } finally { setLoading(false) }
  }

  async function generate() {
    if (!confirm('지난주 정산 일괄 생성 (10,000원 이상 잔액만)?')) return
    try {
      const res = await api.post('/api/admin/payouts/generate', {})
      if (res.data?.success) {
        toast.success(`${res.data.data.created}건 생성됨`)
        setTab('payouts')
      } else toast.error(res.data?.error || '실패')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  async function approve(p: Payout) {
    if (!confirm(`${formatWon(p.amount)} 송금 승인하시겠습니까?`)) return
    try {
      const res = await api.patch(`/api/admin/payouts/${p.id}/approve`)
      if (res.data?.success) { toast.success('승인됨'); load() }
      else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
  }

  async function markSent(p: Payout) {
    const txId = window.prompt(`송금 transaction_id 입력 (은행 거래번호 또는 토스 ID):\n계좌: ${p.bank_name || ''} ${p.account_number || ''} (${p.account_holder || ''})\n금액: ${formatWon(p.amount)}`)
    if (!txId) return
    try {
      const res = await api.patch(`/api/admin/payouts/${p.id}/sent`, { transaction_id: txId.trim() })
      if (res.data?.success) { toast.success('송금 완료 마킹'); load() }
      else toast.error(res.data?.error || '실패')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  async function cancel(p: Payout) {
    const reason = window.prompt('취소 사유:')
    if (!reason) return
    try {
      const res = await api.patch(`/api/admin/payouts/${p.id}/cancel`, { reason })
      if (res.data?.success) { toast.success('취소됨'); load() }
      else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
  }

  return (
    <AdminLayout title="통합 정산">
      <DashboardPageHeader
        icon={<Wallet className="w-5 h-5" />}
        title="통합 정산 (Payouts)"
        subtitle="ledger 잔액 확인 + 주 1회 정산 일괄 생성 + 송금 처리"
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab('pending_ledger')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'pending_ledger' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          📊 ledger 잔액
        </button>
        <button
          onClick={() => setTab('payouts')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'payouts' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          💸 payouts 목록
        </button>
        <button
          onClick={() => setTab('rates')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'rates' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          ⚙️ 수수료율
        </button>
        <button
          onClick={() => setTab('annual')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'annual' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          📄 연말 리포트
        </button>
        {(tab === 'pending_ledger' || tab === 'payouts') && (
          <button
            onClick={generate}
            className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
          >
            + 지난주 정산 생성
          </button>
        )}
      </div>

      {tab === 'pending_ledger' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : pending.length === 0 ? (
            <p className="p-12 text-center text-sm text-gray-400">정산 대기 잔액 없음.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-3 text-left">계정</th>
                  <th className="px-4 py-3 text-right">총 발생액</th>
                  <th className="px-4 py-3 text-right">이미 송금</th>
                  <th className="px-4 py-3 text-right">미정산 잔액</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100 text-xs">
                    <td className="px-4 py-3 font-mono">{p.account}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatWon(p.total_credited)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatWon(p.total_paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">{formatWon(p.pending_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 flex items-center gap-2">
            {(['pending', 'approved', 'sent', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {s === 'pending' ? '검토 대기' : s === 'approved' ? '승인됨' : s === 'sent' ? '송금 완료' : '전체'}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <p className="p-12 text-center text-sm text-gray-400">불러오는 중...</p>
            ) : payouts.length === 0 ? (
              <p className="p-12 text-center text-sm text-gray-400">해당 상태의 payouts 없음.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left">생성일</th>
                    <th className="px-4 py-3 text-left">수령자</th>
                    <th className="px-4 py-3 text-right">금액</th>
                    <th className="px-4 py-3 text-left">계좌</th>
                    <th className="px-4 py-3 text-center">상태</th>
                    <th className="px-4 py-3 text-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => {
                    const meta = STATUS_LABEL[p.status]
                    return (
                      <tr key={p.id} className="border-t border-gray-100 text-xs">
                        <td className="px-4 py-3 text-gray-700">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono">{p.payee_type}:{p.payee_id}</div>
                          <div className="text-[10px] text-gray-400">{p.period_start} ~ {p.period_end}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{formatWon(p.amount)}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {p.account_holder || '-'}
                          {p.account_number && <div className="font-mono text-[10px]">{p.account_number}</div>}
                          {p.transaction_id && <div className="text-[10px] text-emerald-600">TX: {p.transaction_id}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.status === 'pending' && (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => approve(p)} className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> 승인
                              </button>
                              <button onClick={() => cancel(p)} className="px-2 py-1 bg-gray-500 text-white rounded text-[10px] flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> 취소
                              </button>
                            </div>
                          )}
                          {p.status === 'approved' && (
                            <button onClick={() => markSent(p)} className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] flex items-center gap-1 mx-auto">
                              <Send className="w-3 h-3" /> 송금완료
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ⚙️ 수수료율 조정 (어드민) — 변경 시 다음 voucher 부터 자동 적용 */}
      {tab === 'rates' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
          <h2 className="text-sm font-bold text-gray-900 mb-4">⚙️ 수수료율 조정</h2>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            • voucher 사용 시점에 자동으로 ledger entry 생성 시 적용됨<br />
            • 변경 즉시 다음 voucher 부터 새 비율 사용 (기존 entry 영향 X)<br />
            • 모든 비율은 % 단위 (0 ~ 100)
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">플랫폼 fee % <span className="text-gray-400">(default 5)</span></label>
              <input
                type="number" min={0} max={30} step={0.5}
                value={rates.platform_fee_pct}
                onChange={e => setRates(r => ({ ...r, platform_fee_pct: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">전체 매출에서 플랫폼이 가져가는 비율</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">셀러 위탁 판매 commission % <span className="text-gray-400">(default 10)</span></label>
              <input
                type="number" min={0} max={50} step={0.5}
                value={rates.seller_commission_pct}
                onChange={e => setRates(r => ({ ...r, seller_commission_pct: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">위탁 판매 (consignment) 시 셀러 commission</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">에이전시 분배 % <span className="text-gray-400">(default 30)</span></label>
              <input
                type="number" min={0} max={100} step={1}
                value={rates.agency_share_pct}
                onChange={e => setRates(r => ({ ...r, agency_share_pct: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">플랫폼 fee 중 에이전시에게 분배 (introduced_by_agency_id 있는 가게만)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">🎤 인플루언서 입점 유치 % <span className="text-gray-400">(default 20)</span></label>
              <input
                type="number" min={0} max={100} step={1}
                value={rates.influencer_intro_share_pct}
                onChange={e => setRates(r => ({ ...r, influencer_intro_share_pct: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                인플루언서가 매장 입점 유치 시 영구 % (introduced_by_influencer_id 있는 가게만).<br />
                다른 인플루언서가 후속 홍보해도 본 분배는 별개 영구 수령.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!confirm('수수료율을 저장하시겠습니까? (즉시 적용)')) return
              setSavingRates(true)
              try {
                const res = await api.patch('/api/admin/payouts/commission-rates', {
                  platform_fee_pct: Number(rates.platform_fee_pct),
                  seller_commission_pct: Number(rates.seller_commission_pct),
                  agency_share_pct: Number(rates.agency_share_pct),
                  influencer_intro_share_pct: Number(rates.influencer_intro_share_pct),
                })
                if (res.data?.success) toast.success('저장됨 — 다음 voucher 부터 적용')
                else toast.error(res.data?.error || '저장 실패')
              } catch (e: unknown) {
                const ax = e as { response?: { data?: { error?: string } } }
                toast.error(ax.response?.data?.error || '저장 실패')
              } finally { setSavingRates(false) }
            }}
            disabled={savingRates}
            className="mt-6 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {savingRates ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {/* 📄 연말 정산 리포트 — CSV download */}
      {tab === 'annual' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
          <h2 className="text-sm font-bold text-gray-900 mb-4">📄 연말 정산 리포트</h2>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            • payouts.sent + ledger 합산 → payee 별 연간 수입 CSV<br />
            • 사업자등록번호 / 계좌 / 입금 횟수 / 첫·마지막 입금일 포함<br />
            • 세무사 제공용 — UTF-8 BOM (Excel 한글 안 깨짐)
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">연도</label>
              <input
                type="number" min={2024} max={2100}
                value={annualYear}
                onChange={e => setAnnualYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">수령자 유형</label>
              <select
                value={annualType}
                onChange={e => setAnnualType(e.target.value as 'all' | 'store_owner' | 'seller' | 'agency')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
              >
                <option value="all">전체</option>
                <option value="store_owner">🏪 사장님 (store_owner)</option>
                <option value="seller">📺 셀러 (seller)</option>
                <option value="agency">🤵 에이전시 (agency)</option>
              </select>
            </div>
          </div>
          <button
            onClick={async () => {
              const token = localStorage.getItem('admin_token')
              const url = `/api/admin/tax/annual-report?year=${annualYear}&payee_type=${annualType}&format=csv`
              try {
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                if (!res.ok) { toast.error(`다운로드 실패 (${res.status})`); return }
                const blob = await res.blob()
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `urdeal-annual-${annualYear}-${annualType}.csv`
                link.click()
                URL.revokeObjectURL(link.href)
                toast.success('CSV 다운로드 완료')
              } catch {
                toast.error('다운로드 실패')
              }
            }}
            className="mt-6 w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold"
          >
            CSV 다운로드
          </button>
          <a
            href={`/api/admin/tax/annual-report?year=${annualYear}&payee_type=${annualType}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-center py-2 text-xs text-blue-600 hover:underline"
          >
            JSON 미리보기 →
          </a>
        </div>
      )}
    </AdminLayout>
  )
}
