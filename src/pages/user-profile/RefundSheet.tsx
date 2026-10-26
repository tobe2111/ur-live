/**
 * 💸 충전 잔액 환급 시트 — 약관 제12조 (2026-10-12 대표 *"응 모두 해주고 가장 이상적으로 UI까지 짜줘"*)
 *
 * ## 왜 생겼나
 * 마이가 *"환급 가능 N딜"* 이라고 말하고 약관이 환급을 약속하는데 **누를 곳이 없었다**.
 * 서버엔 `POST /api/points/withdraw` 가 열려 있었지만 화면에서 부르는 곳이 0 이었다(2026-10-12 실측).
 *
 * ## 한 화면에 세 상태만
 * | 상태 | 보이는 것 | 바닥 버튼 |
 * |---|---|---|
 * | 처리 중 신청이 있다 | 그 금액 · 보낼 계좌 · 언제 들어오는지 | 확인 |
 * | 환급할 딜이 없다 | 왜 없는지(무상 딜은 대상 아님) | 확인 |
 * | 신청할 수 있다 | 금액(전액이 기본) · 은행 · 계좌 · 예금주 | **N원 환급 신청** |
 *
 * ## 🔴 화면이 금액을 만들지 않는다
 * 한도는 서버(`GET /api/points/refund` → `deal-refund.ts`)가 준 값만 쓴다. 여기서 잔액으로 다시
 * 계산하면 화면이 허락한 금액을 서버가 거절하는 날이 온다(2026-09-04 결제 화면에서 치른 값).
 * 신청 버튼이 실패하면 서버가 준 문장을 **그대로** 보여 준다(무엇을 고치면 되는지 서버가 안다).
 *
 * ## ⚠️ 못 하는 것
 * - 신청 취소가 없다 — 처리는 사람이 이체하는 일이라, 취소는 지급 센터의 반려로 한다(딜은 되돌아온다).
 * - 계좌를 기억하지 않는다 — 은행 계좌번호를 브라우저에 남기지 않는다.
 *
 * ## 🏦 가게 정산 계좌로 받기 (2026-10-26 대표 *"a 해주고"*)
 * 사장님은 정산 계좌를 이미 넣어 뒀는데 여기서 또 치게 했다. 서버가 주인 가게의 정산 계좌를
 * **끝 4자리만** 주면(`store_account`) 그걸 먼저 골라 두고, 신청은 `use_store_account: true` 만 보낸다.
 * 🔴 화면은 전체 계좌번호를 받지도 보내지도 않는다 — 정산 계좌 마스킹(2026-06-12)을 지키기 위해서다.
 * 다른 계좌로 받고 싶으면 `다른 계좌` 를 누르면 종전 입력 칸이 나온다.
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import { BANKS } from '@/shared/banks'
import Sheet from './seller-section/Sheet'

interface RefundRow {
  id: number
  amount: number
  bank_name: string
  bank_account_masked: string
  account_holder: string
  status: 'requested' | 'paid' | 'rejected'
  rejection_reason: string | null
  requested_at: string
  processed_at: string | null
}
interface StoreAccount { store_name: string; bank_name: string; bank_account_masked: string; account_holder: string }
interface RefundState { refundable: number; pending: RefundRow | null; recent: RefundRow[]; store_account?: StoreAccount | null }

const STATUS: Record<RefundRow['status'], string> = {
  requested: '처리 중',
  paid: '입금 완료',
  rejected: '반려',
}

const field = 'w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[17px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

export default function RefundSheet({ onClose, onDone }: {
  onClose: () => void
  /** 신청이 끝났다 — 부르는 쪽이 잔액을 다시 읽는다. */
  onDone?: () => void
}) {
  const [state, setState] = useState<RefundState | null>(null)
  const [failed, setFailed] = useState(false)
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState('')
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [busy, setBusy] = useState(false)
  /** 가게 정산 계좌로 받는다 — 서버가 계좌를 줄 때만 켜진다(기본값). */
  const [useStore, setUseStore] = useState(false)

  const load = () => {
    setFailed(false)
    // 열 때만 뜨는 시트 — api 는 동적으로(`first-screen-static-api` 시험의 반대 방향).
    import('@/lib/api')
      .then(({ default: api }) => api.get('/api/points/refund'))
      .then((r) => {
        if (!r.data?.success) { setFailed(true); return }
        const s = r.data.data as RefundState
        setState(s)
        setAmount(s.refundable > 0 ? String(s.refundable) : '')
        setUseStore(!!s.store_account)
      })
      .catch(() => setFailed(true))
  }
  useEffect(load, [])

  const refundable = state?.refundable ?? 0
  const parsed = Math.floor(Number(amount.replace(/[^0-9]/g, '')) || 0)
  const tooBig = parsed > refundable
  const digits = account.replace(/-/g, '')
  const store = state?.store_account ?? null
  const viaStore = useStore && !!store
  const ready = !!state && !state.pending && parsed > 0 && !tooBig && !busy
    && (viaStore || (!!bank && digits.length >= 8 && holder.trim().length > 0))
  const canForm = !!state && !state.pending && refundable > 0

  async function send() {
    if (!ready) return
    setBusy(true)
    try {
      const { default: api } = await import('@/lib/api')
      const r = await api.post('/api/points/refund', viaStore
        ? { amount: parsed, use_store_account: true }
        : { amount: parsed, bank_name: bank, bank_account: account, account_holder: holder.trim() })
      if (!r.data?.success) { toast.error(r.data?.error || '환급 신청을 하지 못했어요'); return }
      toast.success(`${formatNumber(parsed)}원 환급을 신청했어요`)
      window.dispatchEvent(new Event('pointsBalanceChanged'))
      onDone?.()
      load()
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data
      toast.error(res?.error || '환급 신청을 하지 못했어요')
      load()
    } finally {
      setBusy(false)
    }
  }

  const history = (state?.recent ?? []).filter((r) => r.id !== state?.pending?.id)

  return (
    <Sheet
      title="충전 잔액 환급"
      onClose={onClose}
      footer={canForm ? (
        <button
          type="button"
          disabled={!ready}
          onClick={send}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {parsed > 0 && !tooBig ? `${formatNumber(parsed)}원 환급 신청` : '환급 신청'}
        </button>
      ) : state || failed ? (
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-xl border border-rule-strong text-[15px] font-bold text-gray-900 dark:text-white active:opacity-70"
        >
          확인
        </button>
      ) : undefined}
    >
      {!state && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
          환급 정보를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      )}

      {state?.pending && (
        <div className="px-4 py-4">
          <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">환급 처리 중</p>
          <p className="mt-1 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
            {formatNumber(state.pending.amount)}
            <span className="ml-1 text-[15px] font-bold text-gray-500 dark:text-gray-400">원</span>
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">
              {state.pending.bank_name} {state.pending.bank_account_masked} · {state.pending.account_holder}
            </span>
            {' '}계좌로 보내요. 영업일 기준 3~5일 안에 들어와요.
          </p>
        </div>
      )}

      {state && !state.pending && refundable <= 0 && (
        <div className="px-4 py-6">
          <p className="text-[15px] font-medium text-gray-900 dark:text-white">지금 돌려받을 딜이 없어요</p>
          <p className="mt-2 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            충전하고 쓰지 않은 딜만 현금으로 돌려드려요. 리워드로 받은 딜은 환급 대상이 아니에요.
          </p>
        </div>
      )}

      {canForm && (
        <div className="px-4 py-4">
          <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">돌려받을 수 있는 금액</p>
          <p className="mt-1 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
            {formatNumber(refundable)}
            <span className="ml-1 text-[15px] font-bold text-gray-500 dark:text-gray-400">원</span>
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            충전하고 쓰지 않은 딜이에요. 1딜은 1원이고, 수수료나 세금 없이 그대로 돌려드려요.
          </p>

          <div className="mt-4 pt-4 border-t border-rule space-y-3">
            <label className="block">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">금액</span>
              <input
                inputMode="numeric"
                value={parsed > 0 ? formatNumber(parsed) : ''}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className={`${field} font-bold tabular-nums`}
                aria-label="돌려받을 금액"
              />
              {tooBig && (
                <span className="block mt-2 text-[13px] text-gray-900 dark:text-white">
                  돌려받을 수 있는 금액({formatNumber(refundable)}원)보다 많아요.
                </span>
              )}
            </label>
            {store && (
              <div role="radiogroup" aria-label="받을 계좌" className="space-y-2">
                <span className="block text-[13px] font-medium text-gray-900 dark:text-white">받을 계좌</span>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viaStore}
                  onClick={() => setUseStore(true)}
                  className={`w-full text-left rounded-xl px-3 py-3 border ${viaStore ? 'border-brand bg-brand-tint' : 'border-rule-strong'}`}
                >
                  <span className="block text-[15px] font-medium text-gray-900 dark:text-white">가게 정산 계좌</span>
                  <span className="block mt-1 text-[13px] tabular-nums text-gray-500 dark:text-gray-400">
                    {store.bank_name} {store.bank_account_masked} · {store.account_holder}
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!viaStore}
                  onClick={() => setUseStore(false)}
                  className={`w-full text-left rounded-xl px-3 py-3 border ${!viaStore ? 'border-brand bg-brand-tint' : 'border-rule-strong'}`}
                >
                  <span className="block text-[15px] font-medium text-gray-900 dark:text-white">다른 계좌</span>
                </button>
              </div>
            )}
            {!viaStore && (<>
            <label className="block">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">은행</span>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={field}>
                <option value="">은행을 골라 주세요</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">계좌번호</span>
              <input
                inputMode="numeric"
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/[^\d-]/g, ''))}
                placeholder="000-0000-0000"
                className={`${field} tabular-nums`}
              />
            </label>
            <label className="block">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">예금주</span>
              <input
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="통장에 적힌 이름 그대로"
                className={field}
              />
            </label>
            </>)}
            <p className="pt-1 text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400">
              신청하면 그 금액만큼 딜이 바로 빠지고, 영업일 기준 3~5일 안에 입금돼요.
              처리되지 않으면 딜은 그대로 돌아와요.
            </p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="px-4 pb-4">
          <p className="pt-4 border-t border-rule text-[13px] font-medium text-gray-900 dark:text-white">지난 환급</p>
          <ul className="mt-2 divide-y divide-rule">
            {history.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{formatNumber(r.amount)}원</p>
                  <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                    {formatKSTDate(r.processed_at || r.requested_at)}
                    {r.status === 'rejected' && r.rejection_reason ? ` · ${r.rejection_reason}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-[12px] font-medium ${r.status === 'paid' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {STATUS[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
