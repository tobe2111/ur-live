/**
 * 🏪 가게 — 손님에게 보이는 정보 (2026-09-26, 설계 §21 가게 묶음)
 *   대표: *"일단 마이에서 대부분 끝내야 해"*
 *
 * ## 무엇이 달라지나
 * 마이에서 가게에 대해 할 수 있는 일은 **전환** 하나뿐이었다. 상호·연락처·주소·소개는
 * `/seller/business-info` 안에만 있어서, 전화번호 한 자리를 고치려고 대시보드로 나가야 했다.
 *
 * ## 🔴 정산 계좌는 여기 없다 — 일부러다
 * 계좌 변경은 **소유자만**(위임 운영자 403) + **PIN 인증**(412)이 붙는 별개의 등급이다.
 * 같은 폼에 섞으면 상호를 고치려던 사람이 PIN 을 요구받는다. 계좌는 `BankSheet` 가 맡는다.
 * ⇒ 이 시트가 보내는 필드에는 `bank_*`·`account_holder` 가 **없다**(서버의 `bankChanged` 가
 *    거짓이라 PIN 게이트를 아예 지나가지 않는다). 테스트가 그 부재를 고정한다.
 *
 * ## 승인 상태를 여기서 말한다
 * 대기·반려 상태에서도 좌석은 열린다(당근 모델). 화면이 이유를 말하지 않으면 사장님은
 * 고장으로 읽는다 — 마이 카드와 **같은 문장**을 쓴다(두 곳이 다르게 설명하면 더 헷갈린다).
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, Store } from 'lucide-react'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'

export default function StoreSheet({ sellerId, statusNote, canSwitch, onSwitch, onClose, onSaved }: {
  sellerId: number
  /** 마이 카드와 같은 문장 — 승인 대기·반려일 때만 온다. */
  statusNote?: string
  canSwitch: boolean
  onSwitch: () => void
  onClose: () => void
  onSaved?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/profile'))
      .then((r) => {
        if (!alive.current) return
        if (!r.data?.success) { setFailed(true); return }
        const d = r.data.data as Record<string, unknown>
        setBusinessName(String(d?.business_name || d?.name || ''))
        setPhone(String(d?.phone || ''))
        setAddress(String(d?.address || ''))
        setDescription(String(d?.description || ''))
        setLoaded(true)
      })
      .catch(() => { if (alive.current) setFailed(true) })
  }, [sellerId])

  const canSend = loaded && businessName.trim().length > 0 && !busy

  async function save() {
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
      // ⚠️ 계좌 필드를 보내지 않는다 — 보내는 순간 서버가 PIN·소유자 게이트를 켠다(위 머리말).
      const r = await api.put('/api/seller/profile', {
        business_name: businessName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        description: description.trim(),
      })
      if (!r.data?.success) { toast.error(r.data?.error || '저장하지 못했습니다'); return }
      toast.success('가게 정보를 저장했어요')
      onSaved?.()
      onClose()
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data
      toast.error(res?.error || '저장하지 못했습니다')
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const field = 'w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <Sheet
      title="가게"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!canSend}
          onClick={save}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          저장
        </button>
      }
    >
      {!loaded && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          지금은 불러올 수 없어요. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {loaded && (
        <div className="px-4 py-4 space-y-3">
          {statusNote && (
            <p className="rounded-xl bg-wash px-3.5 py-3 text-[12.5px] leading-[1.6] text-gray-500 dark:text-gray-400">
              {statusNote}
            </p>
          )}
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">가게 이름</span>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value.slice(0, 100))} placeholder="손님에게 보이는 이름" className={field} />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">연락처</span>
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, '').slice(0, 20))} placeholder="02-000-0000" className={`${field} tabular-nums`} />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">주소</span>
            <input value={address} onChange={(e) => setAddress(e.target.value.slice(0, 200))} placeholder="손님이 찾아올 주소" className={field} />
          </label>
          <label className="block">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">가게 소개</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="어떤 가게인지 한두 줄로"
              className="w-full rounded-xl border border-rule-strong bg-transparent px-3 py-2.5 text-[15px] leading-[1.6] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </label>

          {canSwitch && (
            <button
              type="button"
              onClick={onSwitch}
              className="w-full flex items-center gap-2.5 mt-1 px-3.5 h-12 rounded-xl bg-surface shadow-lift text-left active:opacity-70"
            >
              <Store className="w-[18px] h-[18px] shrink-0 text-gray-400" aria-hidden="true" />
              <span className="flex-1 text-[14px] font-semibold text-gray-900 dark:text-white">다른 가게로 바꾸기</span>
            </button>
          )}

          <p className="text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400 pt-1">
            사업자등록증과 정산 계좌는 따로 있어요. 계좌는 <b className="font-semibold text-gray-900 dark:text-white">정산</b> 에서 바꿔요.
          </p>
        </div>
      )}
    </Sheet>
  )
}
