/**
 * 🔴 출금(환급) — 마이 안에서 (2026-09-25, 설계 §19-2, 대표 *"출금도 마이에서 돼야해"*)
 *
 * ## 🚫 절대 혼동하지 말 것 — `account/withdraw` 는 **탈퇴**다
 * 이 화면이 부르는 것은 **`POST /api/seller/deal-withdraw`** 하나다.
 * `POST /api/seller/account/withdraw` 는 이름이 비슷하지만 **셀러 탈퇴(계정 삭제)** 이고,
 * 상품을 전부 내리고 매장을 지운다. 잘못 배선해도 **에러가 안 난다**(그 API 는 성공한다).
 * 설계 §19-0 에 경위가 있고, 가드가 이 파일에 그 문자열이 못 들어오게 막는다.
 *
 * ## 화면은 돈을 옮기지 않는다
 * 잔액도 금액 한도도 **서버가 준 값**(`GET /deal-balance` 의 `withdrawable`)이다. 여기서 계산하지 않는다.
 * 실제 차감은 서버의 원자 CAS 이고, 동시 클릭은 409 로 거절된다(머니 룰 #1).
 *
 * ## 🏦 입금 계좌는 **서버에서 받아서 되돌려준다** (localStorage 금지)
 * `settlements` 행의 `bank_name/account_number/account_holder` 는 **요청 본문에 실린 값 그대로** 저장되고,
 * 어드민 지급 센터는 그 행만 읽는다(`sellers` 로 폴백하지 않는다 — 실측). 그래서 안 보내면
 * **송금할 계좌가 없는 지급 행**이 생긴다(에러 없이). 셀러 대시보드는 이 값을 `localStorage`
 * (`seller_bank_name` …)에서 읽는데, 그 키는 **좌석을 따라 안 바뀐다** — 가게를 옮긴 뒤 출금하면
 * **직전 가게 계좌로 송금 행이 생긴다.** 그래서 여기서는 좌석 인증된 `GET /api/seller/profile`
 * 이 돌려준 값만 쓰고, 계좌가 비어 있으면 **신청 자체를 막는다**(§15-3 규칙 ③).
 *
 * ## 🔑 412 가 넷이다 — 각각을 사람 말로 번역한다
 * 서버는 `BUSINESS_REGISTRATION_REQUIRED` · `PIN_REQUIRED` · `ACCOUNT_REVERIFICATION_REQUIRED` 로
 * 막고, 금액이 모자라면 400 을 준다. "출금 실패" 한 마디로 묶으면 사장님은 **무엇을 해야 하는지 모른다.**
 */
import { useEffect, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'

/** 서버 `deal-withdraw` 의 최소 금액. 여기서 정하는 값이 아니라 **서버와 맞춘 값**이다. */
export const MIN_WITHDRAW = 10_000

/** 서버가 주는 막힘 코드 → 사장님이 할 수 있는 행동. */
const BLOCKED: Record<string, string> = {
  BUSINESS_REGISTRATION_REQUIRED: '사업자등록증이 아직 확인되지 않았어요. 전체 도구 › 사업자 정보에서 올리면 확인 후 출금할 수 있어요.',
  PIN_REQUIRED: '돈이 나가는 일이라 PIN 확인이 필요해요.',
  ACCOUNT_REVERIFICATION_REQUIRED: '정산 계좌가 최근 바뀌어 관리자 확인을 기다리는 중이에요. 확인되면 출금할 수 있어요.',
}

/** 입금 계좌 — 좌석 인증된 서버 응답에서만 온다. */
interface Payout { bank_name: string; account_number: string; account_holder: string }

/** 뒤 4자리만 남긴다 — 확인에는 충분하고, 화면 캡처로 전부 새지 않는다. */
export function maskAccount(v: string): string {
  const digits = String(v || '').replace(/[^0-9]/g, '')
  if (digits.length <= 4) return digits
  return `${'*'.repeat(Math.min(4, digits.length - 4))}${digits.slice(-4)}`
}

export default function WithdrawSheet({ sellerId, onClose, onDone, onFixPin, onFixBank, onHistory }: {
  sellerId: number
  onClose: () => void
  onDone?: () => void
  /** PIN 이 없거나 확인이 필요할 때 — 대시보드로 보내지 않고 **그 자리에서** 연다(§20-5). */
  onFixPin?: () => void
  /** 정산 계좌가 없을 때 — 같은 이유로 그 자리에서 연다. */
  onFixBank?: () => void
  /**
   * 🧾 지난 정산으로. **여기서 목록을 그리지 않는다** — 보내는 화면과 받은 기록은 다른 일이고,
   *   한 시트에 합치면 돈을 보내려던 사람이 과거 목록을 스크롤해야 한다(§20-6).
   */
  onHistory?: () => void
}) {
  const [available, setAvailable] = useState<number | null>(null)
  const [notice, setNotice] = useState<string>('')
  const [bizVerified, setBizVerified] = useState<boolean | null>(null)
  const [payout, setPayout] = useState<Payout | null>(null)
  const [failed, setFailed] = useState(false)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api')
      .then(({ default: api }) => Promise.all([
        api.get('/api/seller/deal-balance'),
        // 🏦 입금 계좌를 서버에서 받아 **그대로 되돌려준다**. localStorage 는 좌석을 안 따라간다.
        api.get('/api/seller/profile').catch(() => null),
      ]))
      .then(([bal, prof]) => {
        if (!alive) return
        if (!bal.data?.success) { setFailed(true); return }
        const d = bal.data.data as { withdrawable?: number; business_verified?: boolean; notice?: string }
        setAvailable(Number(d?.withdrawable) || 0)
        setBizVerified(!!d?.business_verified)
        setNotice(typeof d?.notice === 'string' ? d.notice : '')
        const p = prof?.data?.success ? (prof.data.data as {
          bank_name?: string | null; bank_account?: string | null; account_holder?: string | null
        }) : null
        // sellers 의 컬럼은 `bank_account` 인데 settlements 는 `account_number` 다 — 여기서 옮긴다.
        if (p?.bank_name && p?.bank_account) {
          setPayout({
            bank_name: String(p.bank_name),
            account_number: String(p.bank_account),
            account_holder: String(p.account_holder || ''),
          })
        }
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sellerId])

  const parsed = Math.floor(Number(amount.replace(/[^0-9]/g, '')) || 0)
  const tooSmall = parsed > 0 && parsed < MIN_WITHDRAW
  const tooBig = available != null && parsed > available
  // 계좌가 없으면 **보내지 않는다** — 송금 못 하는 지급 행을 만드는 것이 아무것도 안 하는 것보다 나쁘다.
  const canSend = parsed >= MIN_WITHDRAW && !tooBig && !busy && bizVerified === true && payout !== null

  async function send() {
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
      if (!payout) { toast.error('정산 계좌가 등록되어 있지 않습니다'); return }
      // 🔴 계좌는 **서버가 준 값을 그대로** 돌려보낸다(화면이 목적지를 지어내지 않는다).
      const r = await api.post('/api/seller/deal-withdraw', {
        amount: parsed,
        bank_name: payout.bank_name,
        account_number: payout.account_number,
        account_holder: payout.account_holder,
      })
      if (!r.data?.success) { toast.error(r.data?.error || '출금 신청을 하지 못했습니다'); return }
      toast.success(`${formatNumber(parsed)}원 출금을 신청했습니다`)
      onDone?.()
      onClose()
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data
      // 🔑 PIN 은 **그 자리에서** 푼다 — 돈이 나가는 흐름 한복판에서 화면을 바꾸지 않는다.
      if (res?.code === 'PIN_REQUIRED' && onFixPin) { toast.error(BLOCKED.PIN_REQUIRED); onFixPin(); return }
      const help = res?.code ? BLOCKED[res.code] : undefined
      toast.error(help || res?.error || '출금 신청을 하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="출금 신청"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {parsed >= MIN_WITHDRAW ? `${formatNumber(parsed)}원 출금 신청` : '출금 신청'}
        </button>
      }
    >
      {available === null && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          잔액을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {available !== null && (
        <div className="px-4 py-4">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">지금 받을 수 있는 금액</p>
          <p className="text-[30px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white mt-1">
            {formatNumber(available)}
            <span className="text-[16px] font-bold text-gray-500 dark:text-gray-400 ml-1">원</span>
          </p>
          {notice && <p className="text-[12.5px] leading-[1.6] text-gray-500 dark:text-gray-400 mt-2">{notice}</p>}

          {bizVerified === false && (
            <p className="text-[13px] leading-[1.6] text-gray-900 dark:text-white mt-4 pt-4 border-t border-rule">
              {BLOCKED.BUSINESS_REGISTRATION_REQUIRED}
            </p>
          )}

          {bizVerified && (
            <>
              <label className="block mt-4 pt-4 border-t border-rule">
                <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">얼마를 받을까요</span>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`최소 ${formatNumber(MIN_WITHDRAW)}원`}
                  className="w-full h-12 rounded-xl border border-rule-strong bg-transparent px-3 text-[16px] font-bold tabular-nums text-gray-900 dark:text-white placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </label>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setAmount(String(available))}
                  disabled={available < MIN_WITHDRAW}
                  className="h-9 px-3 rounded-full border border-rule-strong text-[13px] font-semibold text-gray-900 dark:text-white active:opacity-70 disabled:opacity-40"
                >
                  전액
                </button>
              </div>
              {tooSmall && (
                <p className="text-[12.5px] text-gray-900 dark:text-white mt-2">
                  최소 {formatNumber(MIN_WITHDRAW)}원부터 신청할 수 있어요.
                </p>
              )}
              {tooBig && (
                <p className="text-[12.5px] text-gray-900 dark:text-white mt-2">
                  받을 수 있는 금액({formatNumber(available)}원)보다 많아요.
                </p>
              )}
              {payout ? (
                <p className="text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400 mt-4">
                  <span className="text-gray-900 dark:text-white font-semibold">
                    {payout.bank_name} {maskAccount(payout.account_number)}
                    {payout.account_holder ? ` · ${payout.account_holder}` : ''}
                  </span>
                  {' '}으로 보내요.
                  돈이 나가는 일이라 PIN 확인을 한 번 더 요청할 수 있어요.
                </p>
              ) : (
                <div className="mt-4">
                  <p className="text-[13px] leading-[1.6] text-gray-900 dark:text-white">
                    정산 계좌가 아직 등록되지 않았어요. 받을 계좌를 넣어야 보낼 수 있어요.
                  </p>
                  {onFixBank && (
                    <button
                      type="button"
                      onClick={onFixBank}
                      className="mt-2 h-11 px-4 rounded-xl border border-rule-strong text-[14px] font-bold text-gray-900 dark:text-white active:opacity-70"
                    >
                      계좌 등록하기
                    </button>
                  )}
                </div>
              )}

              {/* 🧾 신청한 뒤 "어디까지 왔나" 는 여기서 연다(조회 전용 별도 시트). */}
              {onHistory && (
                <button
                  type="button"
                  onClick={onHistory}
                  className="w-full mt-4 pt-3 border-t border-rule flex items-center text-left active:opacity-70"
                >
                  <span className="flex-1 text-[13.5px] font-semibold text-gray-900 dark:text-white">지난 정산 보기</span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
