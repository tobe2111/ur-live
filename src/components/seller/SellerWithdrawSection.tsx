/**
 * 🚪 셀러 탈퇴 섹션 (2026-08-26 대표 — "셀러도 탈퇴를 할 수 있어야 하잖아")
 *   소비자 탈퇴(마이 → 계정 설정 → 회원 탈퇴)의 셀러판. 매장 관리 페이지 맨 아래에 조용히 둔다.
 *
 *   열면 서버가 차단 사유를 먼저 센다(`GET /api/seller/account/withdraw-check`):
 *   미사용 이용권 · 미처리 주문 · 미정산 잔액. 하나라도 있으면 실행 버튼이 잠기고 **무엇을
 *   정리해야 하는지**를 그대로 보여 준다 — 막고 끝내면 사장님은 갈 곳을 잃는다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { logoutSeller } from '@/lib/seller-auth'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Blockers {
  pending_orders: number
  unused_vouchers: number
  unsettled_krw: number
  active_products: number
}

export default function SellerWithdrawSection() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [blockers, setBlockers] = useState<Blockers | null>(null)
  const [canWithdraw, setCanWithdraw] = useState(false)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')

  async function openModal() {
    setOpen(true); setLoading(true); setTyped(''); setReason('')
    try {
      const r = await api.get('/api/seller/account/withdraw-check')
      if (r.data?.success) {
        setBlockers(r.data.data?.blockers || null)
        setStoreName(r.data.data?.store_name || '')
        setCanWithdraw(!!r.data.data?.can_withdraw)
      } else { setCanWithdraw(false) }
    } catch { setCanWithdraw(false) } finally { setLoading(false) }
  }

  async function submit() {
    if (!canWithdraw || submitting) return
    setSubmitting(true)
    try {
      const r = await api.post('/api/seller/account/withdraw', { confirm: true, reason: reason.trim() || undefined })
      if (!r.data?.success) throw new Error(r.data?.error)
      alert(r.data.data?.message || '셀러 탈퇴가 완료되었습니다.')
      // 세션은 서버가 이미 무효화했다 — 로컬 토큰까지 지우고 로그인 화면으로.
      logoutSeller(navigate)
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || '탈퇴 처리에 실패했습니다')
      setSubmitting(false)
    }
  }

  const rows = blockers ? [
    { n: blockers.unused_vouchers, label: '아직 사용되지 않은 이용권', hint: '손님이 이미 결제한 이용권이에요. 사용 기간이 끝나거나 환불 처리한 뒤 탈퇴할 수 있어요.' },
    { n: blockers.pending_orders, label: '처리 중인 주문', hint: '배송·수령이 끝나지 않은 주문이 있어요.' },
    { n: blockers.unsettled_krw, label: '정산받지 않은 금액', hint: '정산을 먼저 받으세요. 탈퇴하면 받을 방법이 사라집니다.', money: true },
  ].filter(r => r.n > 0) : []

  return (
    <>
      <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between">
        <p className="text-[11px] text-gray-400">더 이상 유어딜에서 판매하지 않으시나요?</p>
        <button onClick={openModal} className="text-[11px] font-semibold text-gray-400 hover:text-red-600 underline underline-offset-2">
          셀러 탈퇴
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => !submitting && setOpen(false)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-gray-900">셀러 탈퇴</h2>
              <button onClick={() => !submitting && setOpen(false)} className="text-gray-400 text-sm px-2">✕</button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : rows.length > 0 ? (
                <>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-[13px] font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> 아직 탈퇴할 수 없어요
                    </p>
                    <p className="text-[11px] text-amber-800 mt-1">아래 항목을 먼저 정리해 주세요.</p>
                  </div>
                  {rows.map(r => (
                    <div key={r.label} className="rounded-xl border border-gray-200 p-3">
                      <p className="text-[13px] font-bold text-gray-900">
                        {r.label} <span className="text-red-600">{r.money ? `₩${r.n.toLocaleString()}` : `${r.n}건`}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{r.hint}</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                    <p className="text-[13px] font-bold text-red-800">탈퇴하면 이렇게 됩니다</p>
                    <ul className="text-[11px] text-red-700 mt-1.5 space-y-1 list-disc list-inside leading-relaxed">
                      <li>등록한 상품·이용권이 <b>모두 노출 중단</b>됩니다{blockers && blockers.active_products > 0 ? ` (현재 ${blockers.active_products}개)` : ''}</li>
                      <li>매장이 정지되고 셀러 대시보드에서 <b>로그아웃</b>됩니다</li>
                      <li>운영자에게 준 <b>매장 권한이 회수</b>됩니다</li>
                      <li>주문·정산 이력은 법적 보관 의무에 따라 <b>보존</b>됩니다(익명 처리)</li>
                      <li>소비자 계정(마이·구매내역)은 <b>유지</b>됩니다 — 별도 탈퇴 대상입니다</li>
                    </ul>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">탈퇴 사유 <span className="font-normal text-gray-400">(선택)</span></label>
                    <input value={reason} onChange={e => setReason(e.target.value)} placeholder="서비스 개선에 참고합니다"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      확인을 위해 <span className="text-red-600 font-extrabold">탈퇴합니다</span> 를 입력해 주세요
                    </label>
                    <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="탈퇴합니다"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400" />
                  </div>
                  {storeName && <p className="text-[11px] text-gray-400">대상 매장: {storeName}</p>}
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0 flex gap-2">
              <button onClick={() => !submitting && setOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold">
                취소
              </button>
              <button
                onClick={submit}
                disabled={loading || submitting || !canWithdraw || typed.trim() !== '탈퇴합니다'}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40 hover:bg-red-700"
              >
                {submitting ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
