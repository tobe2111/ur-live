/**
 * 🪑 **매장 소유자 지정·이전 + 소유권 신청 심사** — `/admin/store-owner`
 *
 * 설계 SSOT: `docs/design/store-operator-model.md` §5 (3단계, 대표 확정 2026-09-09).
 *
 * ## 이 화면이 없으면 매장이 잠긴다
 * `/store/new` 로 만든 매장은 주인이 `seller_operators.role='owner'` 로만 표현되는데, **그 행을
 * 만들 수 있는 사람이 아무도 없었다.** 주인이 없으면 정산 계좌를 넣을 사람도 없다
 * (라이브 실측: 매장 14 홍대돈까스가 정확히 그 상태다).
 *
 * ## 💰 돈이 먼저다
 * 이전 주인 몫이 남아 있으면 서버가 막는다. 그때는 **통합 정산 → 손바뀜 마감**을 먼저 해야 한다 —
 * 그 문장을 화면이 직접 말한다(막힌 화면이 다음 행동을 안 알려 주면 아무도 못 푼다).
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { confirmDialog, promptDialog } from '@/components/ui/confirm-dialog'
import { formatWon } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import { Store, UserCheck, ShieldAlert, FileText } from 'lucide-react'

interface OperatorRow {
  user_id: number; role: string; granted_at: string | null; revoked_at: string | null
  name: string | null; email: string | null; handle: string | null
}
interface ClaimRow {
  id: number; seller_id: number; user_id: number; business_number: string | null
  cert_url: string; contact_phone: string | null; note: string | null
  status: string; bno_match: number | null; created_at: string | null
  business_name: string | null; store_name: string | null; store_business_number: string | null
  user_name: string | null; user_email: string | null; user_handle: string | null
}
interface OwnerState {
  seller: {
    id: number; business_name: string | null; name: string | null; business_number: string | null
    status: string | null; has_bank_account: boolean; legacy_linked_user_id: number | null
  }
  owner_user_id: number | null
  owner_unknown: boolean
  operators: OperatorRow[]
  receivable: number
  would_block: boolean
  pending_claims: Array<{ id: number; user_id: number; user_name?: string | null }>
}

export default function AdminStoreOwnerPage() {
  const [sellerId, setSellerId] = useState('')
  const [state, setState] = useState<OwnerState | null>(null)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState('')
  const [claims, setClaims] = useState<ClaimRow[]>([])

  const loadClaims = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/store-claims?status=pending')
      setClaims(res.data?.data?.claims || [])
    } catch { /* 목록이 안 뜨는 것으로 화면 전체를 막지 않는다 */ }
  }, [])

  useEffect(() => { void loadClaims() }, [loadClaims])

  async function lookup(id?: number) {
    const n = Number(id ?? sellerId)
    if (!Number.isFinite(n) || n <= 0) { toast.error('매장 번호를 입력하세요'); return }
    setBusy(true)
    try {
      const res = await api.get(`/api/admin/stores/${n}/owner`)
      if (res.data?.success) { setState(res.data.data); setSellerId(String(n)) }
      else toast.error(res.data?.error || '조회 실패')
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '조회 실패')
      setState(null)
    } finally { setBusy(false) }
  }

  /** 막힘 응답을 사람이 읽을 문장으로 — 다음 행동(마감)을 반드시 같이 말한다. */
  function reportBlocked(d: { code?: string; error?: string; receivable?: number }) {
    if (d.code === 'STORE_HANDOVER_BLOCKED') {
      void confirmDialog({
        title: '먼저 정산을 마감해야 합니다',
        message: `${d.error || ''}\n\n미정산 ${formatWon(d.receivable || 0)} 이 남아 있습니다.\n`
          + '통합 정산 화면(/admin/payouts)의 "손바뀜" 버튼으로 지금 소유자 몫을 배정한 뒤 다시 시도하세요.',
        confirmText: '알겠습니다',
      })
      return
    }
    toast.error(d.error || '실패')
  }

  async function transfer() {
    if (!state) return
    const who = target.trim()
    if (!who) { toast.error('새 소유자(유저 ID · @핸들 · 이메일)를 입력하세요'); return }
    const ok = await confirmDialog({
      title: '매장 소유자를 변경합니다',
      message: `${state.seller.business_name || state.seller.name || `매장 ${state.seller.id}`} 의 소유자를 "${who}" 로 지정합니다.\n\n`
        + '· 이전 소유자는 운영자(operator)로 남아 계속 운영할 수 있습니다.\n'
        + '· 상품·주문·리뷰·정산 이력은 전부 매장에 남습니다.\n'
        + '· 영입 커미션(누가 이 매장을 데려왔는가)은 바뀌지 않습니다.',
      confirmText: '소유자 변경',
      danger: true,
    })
    if (!ok) return
    const reason = await promptDialog({
      title: '변경 사유',
      message: '왜 지금 소유자를 바꾸는지 남겨주세요. 감사로그에 그대로 기록됩니다.',
      prompt: { placeholder: '예: 사장님이 사업자등록증 제출 후 본인 확인 완료', required: true },
    })
    if (!reason || reason.trim().length < 5) { toast.error('사유를 5자 이상 적어주세요'); return }

    const body: Record<string, unknown> = { reason }
    if (/^\d+$/.test(who)) body.user_id = Number(who)
    else if (who.includes('@') && who.includes('.')) body.email = who
    else body.handle = who.replace(/^@/, '')

    setBusy(true)
    try {
      const res = await api.post(`/api/admin/stores/${state.seller.id}/owner`, body)
      if (res.data?.success) {
        toast.success('소유자를 변경했습니다')
        await lookup(state.seller.id); await loadClaims(); setTarget('')
      } else reportBlocked(res.data)
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { code?: string; error?: string; receivable?: number } } }
      reportBlocked(ax.response?.data || {})
    } finally { setBusy(false) }
  }

  async function decide(claim: ClaimRow, approve: boolean) {
    const label = approve ? '승인' : '거절'
    const ok = await confirmDialog({
      title: `소유권 신청 ${label}`,
      message: approve
        ? `${claim.user_name || claim.user_email || `유저 ${claim.user_id}`} 을(를) `
          + `${claim.business_name || claim.store_name || `매장 ${claim.seller_id}`} 의 소유자로 등록합니다.\n\n`
          + '사업자등록증 사본을 확인하셨나요? 번호 일치만으로는 증명이 되지 않습니다.'
        : '신청을 거절합니다. 사유는 신청자에게 그대로 보입니다.',
      confirmText: label,
      danger: !approve,
    })
    if (!ok) return
    const reason = await promptDialog({
      title: `${label} 사유`,
      message: approve ? '무엇을 확인했는지 남겨주세요.' : '무엇을 고쳐 오면 되는지 적어주세요.',
      prompt: { placeholder: approve ? '예: 등록증 상호·번호 일치 확인' : '예: 등록증이 흐려 상호를 읽을 수 없음', required: true },
    })
    if (!reason || reason.trim().length < 5) { toast.error('사유를 5자 이상 적어주세요'); return }
    setBusy(true)
    try {
      const res = await api.post(`/api/admin/store-claims/${claim.id}/decide`, { approve, reason })
      if (res.data?.success) {
        toast.success(`${label}했습니다`)
        await loadClaims()
        if (state?.seller.id === claim.seller_id) await lookup(claim.seller_id)
      } else reportBlocked({ ...res.data, code: res.data?.transfer_code || res.data?.code })
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { code?: string; transfer_code?: string; error?: string; receivable?: number } } }
      const d = ax.response?.data || {}
      reportBlocked({ ...d, code: d.transfer_code || d.code })
    } finally { setBusy(false) }
  }

  return (
    <AdminLayout title="매장 소유자">
      <DashboardPageHeader
        icon={<Store className="w-5 h-5" />}
        title="매장 소유자 지정 · 이전"
        subtitle="중개자가 대신 올린 매장의 주인 자리를 사장님에게 넘깁니다. 상품·주문·정산 이력은 그대로 남습니다."
      />

      {/* ── 매장 조회 ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex gap-2 items-center">
          <input
            value={sellerId} onChange={(e) => setSellerId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void lookup() }}
            placeholder="매장 번호 (seller id)"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 w-56"
          />
          <button onClick={() => void lookup()} disabled={busy}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50">조회</button>
        </div>
      </div>

      {state && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-base font-semibold text-gray-900">
                {state.seller.business_name || state.seller.name || `매장 ${state.seller.id}`}
                <span className="ml-2 text-xs text-gray-500">#{state.seller.id} · {state.seller.status}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                사업자번호 {state.seller.business_number || '미등록'} · 정산계좌 {state.seller.has_bank_account ? '등록됨' : '없음'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">미정산 잔액</p>
              <p className="text-lg font-semibold text-gray-900">{formatWon(state.receivable)}</p>
            </div>
          </div>

          {state.owner_unknown ? (
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              <ShieldAlert className="w-4 h-4 inline mr-1" />
              현재 소유자를 확인할 수 없습니다. 이 상태에서는 변경이 막힙니다.
            </p>
          ) : state.owner_user_id ? (
            <p className="mt-3 text-sm text-gray-700">
              <UserCheck className="w-4 h-4 inline mr-1" />
              현재 소유자: 유저 <b>#{state.owner_user_id}</b>
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
              이 매장에는 <b>소유자가 없습니다.</b> 아래에서 지정하면 정산 계좌를 등록할 수 있게 됩니다.
            </p>
          )}

          {state.would_block && (
            <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
              이전 소유자 몫 {formatWon(state.receivable)} 이 남아 있어 지금은 변경이 막힙니다.{' '}
              <Link to="/admin/payouts" className="underline">통합 정산에서 손바뀜 마감</Link> 을 먼저 해주세요.
            </p>
          )}

          {state.operators.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-1">운영 관계</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {state.operators.map((o) => (
                  <li key={o.user_id} className={o.revoked_at ? 'text-gray-400 line-through' : ''}>
                    <b>{o.role}</b> · {o.name || o.email || o.handle || `유저 ${o.user_id}`} (#{o.user_id})
                    {o.granted_at && <span className="text-gray-400 ml-2">{formatKSTDate(o.granted_at)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 items-center flex-wrap">
            <input
              value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="새 소유자 — 유저 ID · @핸들 · 이메일"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 flex-1 min-w-[260px]"
            />
            <button onClick={() => void transfer()} disabled={busy}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50">소유자 변경</button>
          </div>
        </div>
      )}

      {/* ── 소유권 신청 심사 ───────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <p className="text-base font-semibold text-gray-900 mb-1">
          <FileText className="w-4 h-4 inline mr-1" />소유권 신청 ({claims.length})
        </p>
        <p className="text-sm text-gray-500 mb-3">
          사장님이 사업자등록증을 올려 "내 가게"라고 신청한 건입니다. <b>번호 일치는 증명이 아닙니다</b> —
          등록증 사본을 열어 상호까지 확인하세요.
        </p>
        {claims.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">심사 대기 중인 신청이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {claims.map((cl) => (
              <li key={cl.id} className="py-3 flex items-start justify-between gap-4 flex-wrap">
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">
                    {cl.business_name || cl.store_name || `매장 ${cl.seller_id}`}
                    <span className="text-gray-400 ml-2">#{cl.seller_id}</span>
                  </p>
                  <p className="text-gray-600 mt-0.5">
                    신청자 {cl.user_name || cl.user_email || cl.user_handle || `유저 ${cl.user_id}`} (#{cl.user_id})
                    {cl.contact_phone && <span className="text-gray-400 ml-2">{cl.contact_phone}</span>}
                  </p>
                  <p className="text-gray-600 mt-0.5">
                    사업자번호 {cl.business_number || '미기재'}{' '}
                    {cl.bno_match === 1 && <span className="text-green-700">· 매장과 일치</span>}
                    {cl.bno_match === 0 && <span className="text-red-600">· 매장과 불일치</span>}
                    {cl.bno_match == null && <span className="text-gray-400">· 대조 불가</span>}
                  </p>
                  {cl.note && <p className="text-gray-500 mt-0.5">“{cl.note}”</p>}
                  <a href={cl.cert_url} target="_blank" rel="noreferrer"
                    className="text-blue-600 underline text-xs mt-1 inline-block">사업자등록증 사본 열기</a>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void decide(cl, true)} disabled={busy}
                    className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50">승인</button>
                  <button onClick={() => void decide(cl, false)} disabled={busy}
                    className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm disabled:opacity-50">거절</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  )
}
