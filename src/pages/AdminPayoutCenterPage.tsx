/**
 * 🏦 지급 센터 (2026-06-12 — 사용자 결정): 셀러 정산 · 큐레이터 환급 · 에이전시 영입 커미션의
 * "신청 → (수동 이체) → 입금완료 기록"을 한 화면에서. 운영 루틴 = 매주 금요일 일괄.
 * 어드민 라이트 테마 고정 (dark: 금지 룰).
 */
import { useState } from 'react'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { formatWon, formatNumber } from '@/utils/format'
import AdminFinanceTabs from '@/components/admin/AdminFinanceTabs'
import { Banknote, Landmark, Users, Building2, ExternalLink } from 'lucide-react'

interface SellerRow { id: number; seller_id: number; seller_name: string | null; business_name: string | null; amount: number; period_start: string | null; period_end: string | null; bank_name: string | null; account_number: string | null; account_holder: string | null; status: string; created_at: string }
interface CuratorRow { id: number; user_id: string; user_name: string | null; amount: number; withholding_tax: number; net_amount: number; bank_name: string; bank_account: string; account_holder: string; status: string; requested_at: string; deal_deducted: number }
interface AgencyRow { agency_id: number; agency_name: string; bank_name: string | null; bank_account: string | null; account_holder: string | null; payable: number; payable_matured: number; maturing: number; row_count: number; oldest_at: string }
interface PaidRow { rail: string; id: number; who: string | null; amount: number; at: string | null; memo: string | null }

type Data = { sellers: SellerRow[]; curators: CuratorRow[]; agencies: AgencyRow[]; recent_paid: PaidRow[] }

const RAIL_LABEL: Record<string, string> = { seller: '셀러 정산', curator: '큐레이터 환급', agency: '에이전시 커미션' }

export default function AdminPayoutCenterPage() {
  const [tab, setTab] = useState<'seller' | 'curator' | 'agency'>('seller')
  const [busy, setBusy] = useState<string | null>(null)
  const q = useApiQuery<{ success: boolean; data?: Data }>(
    ['admin', 'payout-center'],
    '/api/admin/payout-center',
    { select: (d) => d as { success: boolean; data?: Data } },
  )
  const data = q.data?.data

  async function act(label: string, key: string, fn: () => Promise<{ data?: { success?: boolean; error?: string } }>) {
    if (busy) return
    if (!(await confirmDialog(`${label} — 은행 이체를 완료하셨나요? 기록 후 되돌릴 수 없습니다.`))) return
    setBusy(key)
    try {
      const r = await fn()
      if (r.data?.success) { toast.success(`${label} 기록 완료 — 신청자에게 알림이 발송됐습니다`); q.refetch() }
      else toast.error(r.data?.error || '처리 실패')
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '처리 실패')
    } finally { setBusy(null) }
  }

  const bank = (n?: string | null, a?: string | null, h?: string | null) => (
    <span className="font-mono text-[12px] text-gray-700">{n || '-'} {a || ''}{h ? ` (${h})` : ''}</span>
  )

  const counts = {
    seller: data?.sellers.length ?? 0,
    curator: data?.curators.length ?? 0,
    agency: (data?.agencies ?? []).filter(a => a.payable_matured > 0).length,
  }

  return (
    <div className="ur-content-full px-4 lg:px-8 py-6 space-y-5">
      <AdminFinanceTabs />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Landmark className="w-5 h-5" /> 지급 센터</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            은행 이체(폰뱅킹)를 직접 하신 뒤 <b>입금 완료</b>를 눌러 기록하세요 — 신청자에게 자동 알림.
            <span className="ml-2 inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-semibold">권장 루틴: 매주 금요일 일괄 지급</span>
          </p>
        </div>
        <a href="/admin/wholesale-withdrawals" className="text-[12px] text-blue-600 hover:underline flex items-center gap-1">
          제조사 출금은 전용 화면에서 <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 레일 탭 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([['seller', '셀러 정산', Banknote], ['curator', '큐레이터 환급', Users], ['agency', '에이전시 커미션', Building2]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
            <span className={`px-1.5 rounded-full text-[10px] ${counts[k] > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {tab === 'seller' && (
            <Table empty={!data?.sellers.length} emptyText="대기 중인 셀러 정산 신청이 없습니다"
              head={['신청일', '셀러', '기간', '금액', '입금 계좌', '처리']}>
              {data?.sellers.map(r => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{(r.created_at || '').slice(0, 10)}</td>
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{r.business_name || r.seller_name || `#${r.seller_id}`}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{(r.period_start || '').slice(5)} ~ {(r.period_end || '').slice(5)}</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-right whitespace-nowrap">{formatWon(r.amount)}</td>
                  <td className="px-4 py-3">{bank(r.bank_name, r.account_number, r.account_holder)}</td>
                  <td className="px-4 py-3">
                    <button disabled={busy === `s${r.id}`}
                      onClick={() => act(`셀러 정산 ${formatWon(r.amount)}`, `s${r.id}`, () => api.patch(`/api/admin/payout-center/seller/${r.id}/paid`, {}))}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-bold disabled:opacity-50">입금 완료</button>
                  </td>
                </tr>
              ))}
            </Table>
          )}

          {tab === 'curator' && (
            <Table empty={!data?.curators.length} emptyText="대기 중인 큐레이터 환급 신청이 없습니다"
              head={['신청일', '큐레이터', '신청액', '원천징수', '실입금액', '입금 계좌', '처리']}>
              {data?.curators.map(r => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{(r.requested_at || '').slice(0, 10)}</td>
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{r.user_name || `#${r.user_id}`}</td>
                  <td className="px-4 py-3 text-[12px] text-right whitespace-nowrap">{formatNumber(r.amount)}딜</td>
                  <td className="px-4 py-3 text-[12px] text-right text-gray-500 whitespace-nowrap">-{formatWon(r.withholding_tax)}</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-right whitespace-nowrap">{formatWon(r.net_amount)}</td>
                  <td className="px-4 py-3">{bank(r.bank_name, r.bank_account, r.account_holder)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button disabled={busy === `c${r.id}`}
                      onClick={() => act(`환급 ${formatWon(r.net_amount)}`, `c${r.id}`, () => api.patch(`/api/admin/payout-center/curator/${r.id}/paid`, {}))}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-bold disabled:opacity-50 mr-1.5">입금 완료</button>
                    <button disabled={busy === `cr${r.id}`}
                      onClick={async () => {
                        const reason = window.prompt('반려 사유 (신청자에게 표시 + 딜 자동 복원)')
                        if (reason == null) return
                        setBusy(`cr${r.id}`)
                        try {
                          const resp = await api.patch(`/api/admin/payout-center/curator/${r.id}/reject`, { reason })
                          if (resp.data?.success) { toast.success('반려 처리 — 딜이 복원되었습니다'); q.refetch() }
                          else toast.error(resp.data?.error || '처리 실패')
                        } catch { toast.error('처리 실패') } finally { setBusy(null) }
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[12px] font-semibold disabled:opacity-50">반려</button>
                  </td>
                </tr>
              ))}
            </Table>
          )}

          {tab === 'agency' && (
            <Table empty={!data?.agencies.length} emptyText="적립된 에이전시 커미션이 없습니다"
              head={['에이전시', '지급 가능 (7일 경과)', '성숙 대기', '건수', '입금 계좌', '처리']}>
              {data?.agencies.map(r => (
                <tr key={r.agency_id} className="border-t border-gray-50">
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{r.agency_name}</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-right whitespace-nowrap">{formatWon(r.payable_matured)}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-gray-400 whitespace-nowrap">{formatWon(r.maturing)}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-gray-500">{formatNumber(r.row_count)}</td>
                  <td className="px-4 py-3">{bank(r.bank_name, r.bank_account, r.account_holder)}</td>
                  <td className="px-4 py-3">
                    <button disabled={busy === `a${r.agency_id}` || r.payable_matured <= 0}
                      onClick={() => act(`에이전시 커미션 ${formatWon(r.payable_matured)}`, `a${r.agency_id}`, () => api.post(`/api/admin/payout-center/agency/${r.agency_id}/paid`, {}))}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-bold disabled:opacity-40">일괄 입금 완료</button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}

      {/* 최근 지급 이력 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">최근 지급 이력</h3>
        {!data?.recent_paid.length ? (
          <p className="text-[13px] text-gray-400 py-4 text-center">아직 지급 이력이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {data.recent_paid.map((p, i) => (
              <div key={`${p.rail}-${p.id}-${i}`} className="flex items-center justify-between text-[13px] border-b border-gray-50 pb-2 last:border-0">
                <span className="text-gray-500">{(p.at || '').slice(0, 16).replace('T', ' ')}</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[11px] text-gray-600">{RAIL_LABEL[p.rail] || p.rail}</span>
                <span className="font-medium text-gray-900 flex-1 px-3 truncate">{p.who || '-'}</span>
                <span className="font-bold">{formatWon(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🧾 정산 매입세금계산서 역발행 현황 */}
      <SettlementTaxInvoicesPanel />
    </div>
  )
}

interface TaxInvRow { id: number; settlement_id: number; seller_id: number; supply_amount: number; vat_amount: number; total_amount: number; period: string | null; status: string; nts_confirm_num: string | null; seller_name?: string | null; created_at: string }
const TAXINV_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: '발행대기', cls: 'bg-amber-50 text-amber-700' },
  requested: { label: '승인대기', cls: 'bg-blue-50 text-blue-700' },
  approved: { label: '승인완료', cls: 'bg-indigo-50 text-indigo-700' },
  issued: { label: '발행완료', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '발행실패', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
}

function SettlementTaxInvoicesPanel() {
  const [busy, setBusy] = useState<number | null>(null)
  const q = useApiQuery<{ success: boolean; provider?: string; invoices?: TaxInvRow[] }>(
    ['admin', 'settlement-tax-invoices'],
    '/api/admin/tax/settlement-invoices',
    { select: (d) => d as { success: boolean; provider?: string; invoices?: TaxInvRow[] } },
  )
  const rows = q.data?.invoices ?? []
  const provider = q.data?.provider ?? 'none'

  async function reissue(id: number) {
    setBusy(id)
    try {
      const r = await api.post(`/api/admin/tax/settlement-invoices/${id}/reissue`, {})
      if (r.data?.success) toast.success(r.data?.message || '역발행 요청 전송')
      else toast.error(r.data?.message || r.data?.error || '처리 실패')
      q.refetch()
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '처리 실패')
    } finally { setBusy(null) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-[14px] font-bold text-gray-900">🧾 정산 세금계산서 역발행 (사업자 유저 셀러)</h3>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${provider === 'none' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
          발행 연동: {provider === 'none' ? '미설정 (초안만 저장)' : provider}
        </span>
      </div>
      {q.isLoading ? (
        <p className="text-[13px] text-gray-400 py-6 text-center">불러오는 중…</p>
      ) : !rows.length ? (
        <p className="text-[13px] text-gray-400 py-8 text-center">역발행 대상 정산이 아직 없습니다 ✨</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-gray-50">{['셀러', '귀속', '공급가액', '부가세', '합계', '상태', '처리'].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-gray-400 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => {
                const st = TAXINV_STATUS[r.status] || TAXINV_STATUS.draft
                return (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{r.seller_name || `#${r.seller_id}`}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-500 whitespace-nowrap">{r.period || `#${r.settlement_id}`}</td>
                    <td className="px-4 py-3 text-[12px] text-right whitespace-nowrap">{formatWon(r.supply_amount)}</td>
                    <td className="px-4 py-3 text-[12px] text-right text-gray-500 whitespace-nowrap">{formatWon(r.vat_amount)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-right whitespace-nowrap">{formatWon(r.total_amount)}</td>
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      {r.status !== 'issued' && provider !== 'none' ? (
                        <button disabled={busy === r.id} onClick={() => reissue(r.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-bold disabled:opacity-50">재발행</button>
                      ) : (
                        <span className="text-[12px] text-gray-400">{r.nts_confirm_num ? `#${r.nts_confirm_num}` : '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Table({ head, empty, emptyText, children }: { head: string[]; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (empty) return <p className="text-[13px] text-gray-400 py-12 text-center">{emptyText} ✨</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="bg-gray-50">{head.map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-gray-400 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
