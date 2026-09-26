/**
 * 🔑 PIN — 마이 안에서 걸고 확인한다 (2026-09-26, 설계 §20-5)
 *   대표: *"모두 마이에서 하도록"*
 *
 * ## 왜 출금 시트가 이걸 부르나
 * `deal-withdraw` 는 **PIN 쿠키**를 요구한다(412 `PIN_REQUIRED`). 종전엔 그 순간 사장님을
 * 셀러 대시보드(`/seller/profile`)로 보냈다 — **돈이 나가는 흐름 한복판에서 화면이 통째로 바뀐다.**
 * 여기서 걸고 확인하면 출금 시트로 그대로 돌아온다.
 *
 * ## 두 단계다 — 거는 것과 확인하는 것
 *   - 안 걸려 있으면 `set-pin` (그 뒤 바로 `verify-pin`)
 *   - 걸려 있으면 `verify-pin` 만 — 쿠키가 나와야 출금이 통과한다
 *
 * ## 🔑 비밀번호가 필요한 계정인지 **미리 알 수 없다**
 * 서버는 `linked_user_id` 가 없는 셀러(= 소비자 계정과 안 묶인 매장)에만 현재 비밀번호를 요구한다.
 * 그리고 `/store/new` 로 만든 매장은 **설계상 그 값이 비어 있다**(§15-2) — 즉 마이로 들어온 사장님
 * 중에도 요구받는 사람이 있다. 그래서 **먼저 비밀번호 없이 시도**하고, 서버가 `PASSWORD_REQUIRED`
 * 를 주면 그때 칸을 연다. ⚠️ 한국어 문장으로 분기하지 않는다 — 문구를 다듬는 순간 깨진다.
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'

export default function PinSheet({ sellerId, onClose, onDone }: {
  sellerId: number
  onClose: () => void
  /** 확인까지 끝났다 — 부르는 쪽(출금)이 이어서 진행한다. */
  onDone?: () => void
}) {
  const [pinSet, setPinSet] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [password, setPassword] = useState('')
  const [needPassword, setNeedPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/pin-status'))
      .then((r) => { if (alive) setPinSet(r.data?.success ? !!r.data.data?.pin_set : false) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sellerId])

  const digitsOk = /^\d{4,6}$/.test(pin)
  const matchOk = pinSet ? true : pin === confirm
  const canSend = digitsOk && matchOk && !busy && (!needPassword || password.length > 0)

  async function submit() {
    if (!canSend) return
    try {
      assertSeat(sellerId)
    } catch (e) {
      if (e instanceof SeatMismatchError) { toast.error('가게가 바뀌었어요. 다시 열어 주세요'); onClose(); return }
      throw e
    }
    setBusy(true)
    try {
      const { default: api } = await import('@/lib/api')
      if (!pinSet) {
        const body: Record<string, string> = { pin }
        if (needPassword) body.current_password = password
        try {
          await api.post('/api/seller/set-pin', body)
        } catch (err) {
          const res = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
          if (res?.code === 'PASSWORD_REQUIRED') {
            // 이 계정은 비밀번호가 필요하다 — 칸을 열고 멈춘다(사장님이 채우면 다시 보낸다).
            setNeedPassword(true)
            toast.error('이 매장은 비밀번호 확인이 필요해요')
            return
          }
          toast.error(res?.error || 'PIN 을 걸지 못했습니다')
          return
        }
      }
      // 걸었든 이미 걸려 있었든 — **확인**까지 해야 쿠키가 나오고 출금이 통과한다.
      const v = await api.post('/api/seller/verify-pin', { pin })
      if (!v.data?.success) { toast.error(v.data?.error || 'PIN 이 맞지 않습니다'); return }
      toast.success('확인됐어요')
      onDone?.()
      onClose()
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data
      toast.error(res?.error || 'PIN 확인에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[16px] font-bold tabular-nums tracking-[0.2em] text-gray-900 dark:text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <Sheet
      title={pinSet ? 'PIN 확인' : 'PIN 설정'}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!canSend}
          onClick={submit}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {pinSet ? '확인' : '설정하고 계속'}
        </button>
      }
    >
      {pinSet === null && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          지금은 확인할 수 없어요. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {pinSet !== null && (
        <div className="px-4 py-4 space-y-3">
          <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            돈이 나가는 일에는 PIN 을 한 번 더 확인해요. 숫자 4~6자리예요.
          </p>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="4~6자리"
              className={field}
            />
          </label>
          {!pinSet && (
            <label className="block">
              <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">한 번 더</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="같은 숫자"
                className={field}
              />
              {confirm.length > 0 && !matchOk && (
                <span className="block mt-1.5 text-[12.5px] text-gray-900 dark:text-white">두 숫자가 달라요.</span>
              )}
            </label>
          )}
          {needPassword && (
            <label className="block pt-1">
              <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">매장 비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="매장 로그인 비밀번호"
                className="w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <span className="block mt-1.5 text-[12.5px] text-gray-500 dark:text-gray-400">
                이 매장은 소비자 계정과 따로 만들어져서 한 번 확인이 필요해요.
              </span>
            </label>
          )}
        </div>
      )}
    </Sheet>
  )
}
