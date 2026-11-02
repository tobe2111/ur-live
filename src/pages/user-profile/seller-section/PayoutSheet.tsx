/**
 * 💰 정산 — 매주 자동으로 들어오는 돈 (2026-10-12 대표 *"응 모두 해주고 가장 이상적으로 UI까지 짜줘"*)
 *
 * ## 무엇을 대체했나
 * 마이 › 정산("쌓인 돈 받기")은 `WithdrawSheet` 를 열었고, 그 시트는 `seller_deal_balances` 를
 * 읽어 **출금 신청**을 받았다. 그 잔액은 **코드 어디에서도 적립되지 않는다**(2026-10-12 전수 grep —
 * 유일한 `+` 쓰기는 교환권 발송 실패 롤백). 그래서 사장님은 늘 *"받을 수 있는 금액 0원"* 을 봤고,
 * 진짜 돈(주간 자동 정산)은 이 자리에서 **한 번도 보이지 않았다.**
 * 2026-07-01 대표 승인 *"자동 정산 하나로 통일"* 이 대시보드에서는 이미 이 모양이었다
 * (`AutoPayoutSection`) — 마이에만 옛 길이 남아 있었다.
 *
 * ## 신청 버튼이 없는 이유
 * 셀러 돈은 원장(`seller:N`)에 쌓이고, 매주 자동으로 집계돼(`payouts`) 어드민이 송금한다.
 * 사장님이 할 일은 **계좌를 등록해 두는 것** 하나다 — 그래서 이 시트의 유일한 행동이 그것이다.
 *
 * ## 🔴 화면이 금액을 만들지 않는다
 * 숫자는 전부 `GET /api/seller/payouts` 가 준 값이다(미지급 · 유보 · 송금 대기 · 지급 완료).
 * 유보일도 서버 값(`hold_days`)을 그대로 쓴다 — 화면이 지어내면 유보일을 바꾼 날 안내가 거짓말이 된다.
 * 실패는 0 이 아니라 "불러오지 못했다" 다(머니 표면 룰).
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import { currentSeatId } from '@/lib/seller-seat'
import Sheet from './Sheet'
import { useCountUp } from '../useCountUp' // 🎬 2026-11-02 시안 3차: 정산 예정 금액이 0원부터 올라간다

interface PayoutRow {
  id: number
  amount: number
  period_start: string | null
  period_end: string | null
  status: string
  sent_at: string | null
}
interface PayoutData {
  payable: number
  held?: number
  hold_days?: number
  scheduled_total: number
  sent_total: number
  payouts: PayoutRow[]
  scope?: 'owner' | 'operator'
}

/** 서버 status → 사람 말. 모르는 값은 그대로 보여 준다(조용히 '완료' 로 바꾸지 않는다). */
const STATUS: Record<string, string> = {
  pending: '송금 대기',
  approved: '송금 예정',
  sent: '입금 완료',
  failed: '송금 실패',
  cancelled: '취소',
}

export default function PayoutSheet({ sellerId, onClose, onFixBank }: {
  sellerId: number
  onClose: () => void
  /** 정산 계좌가 없을 때 — 그 자리에서 연다(돌아오면 이 시트로). */
  onFixBank?: () => void
}) {
  const [data, setData] = useState<PayoutData | null>(null)
  const [hasBank, setHasBank] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    // 🪑 좌석이 맞을 때만 부른다 — 안 맞으면 남의 가게 정산이 뜬다.
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    // 열 때만 뜨는 시트 — api 는 동적으로(첫 화면 묶음과 무관, `first-screen-static-api` 시험의 반대 방향).
    import('@/lib/api')
      .then(({ default: api }) => Promise.all([
        api.get('/api/seller/payouts'),
        api.get('/api/seller/profile').catch(() => null),
      ]))
      .then(([p, prof]) => {
        if (!alive) return
        if (!p.data?.success) { setFailed(true); return }
        setData(p.data.data as PayoutData)
        const pr = prof?.data?.success ? (prof.data.data as { bank_name?: string | null; bank_account?: string | null }) : null
        setHasBank(prof ? !!(pr?.bank_name && pr?.bank_account) : null)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sellerId])

  const payable = data?.payable ?? 0
  const held = Math.min(payable, Math.max(0, data?.held ?? 0))
  const nextRun = Math.max(0, payable - held)
  const nextRunShown = useCountUp(data ? nextRun : undefined, { durationMs: 800 }) ?? nextRun
  const scheduled = data?.scheduled_total ?? 0
  const sent = data?.sent_total ?? 0
  const holdDays = data?.hold_days ?? 0

  return (
    <Sheet
      title="정산"
      onClose={onClose}
      footer={hasBank === false && onFixBank ? (
        <button
          type="button"
          onClick={onFixBank}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80"
        >
          정산 계좌 등록하기
        </button>
      ) : undefined}
    >
      {!data && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
          정산 정보를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      )}

      {data && (
        <div className="px-4 py-4">
          <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">다음 정산에 들어갈 돈</p>
          <p className="mt-1 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
            {formatNumber(nextRunShown)}
            <span className="ml-1 text-[15px] font-bold text-gray-500 dark:text-gray-400">원</span>
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
            매주 자동으로 모아 등록하신 계좌로 보내요. 따로 신청하지 않아도 돼요.
          </p>
          {data.scope === 'operator' && (
            <p className="mt-2 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
              가게(사장님) 계좌로 들어가는 돈이에요. 함께 일한 뒤의 몫만 보여요.
            </p>
          )}

          <dl className="mt-4 pt-4 border-t border-rule space-y-3">
            {held > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-gray-500 dark:text-gray-400">
                  기다리는 돈
                  {holdDays > 0 && <span className="block text-[12px]">카드 대금이 들어오는 데 {holdDays}일 걸려요</span>}
                </dt>
                <dd className="text-[15px] font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(held)}원</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-gray-500 dark:text-gray-400">송금 대기</dt>
              <dd className={`text-[15px] font-bold tabular-nums ${scheduled > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{formatNumber(scheduled)}원</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-gray-500 dark:text-gray-400">지금까지 받은 돈</dt>
              <dd className={`text-[15px] font-bold tabular-nums ${sent > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{formatNumber(sent)}원</dd>
            </div>
          </dl>

          {hasBank === false && (
            <p className="mt-4 pt-4 border-t border-rule text-[13px] leading-[1.6] text-gray-900 dark:text-white">
              정산 계좌가 아직 없어요. 계좌를 넣어 두면 다음 정산부터 그리로 보내요.
            </p>
          )}

          <p className="mt-5 pt-4 border-t border-rule text-[13px] font-bold text-gray-900 dark:text-white">정산 내역</p>
          {data.payouts.length === 0 ? (
            <p className="mt-2 text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400">
              아직 없어요. 이용권이 사용되면 그 금액이 매주 모여 여기에 쌓여요.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-rule">
              {data.payouts.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{formatNumber(p.amount)}원</p>
                    <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                      {p.period_start && p.period_end ? `${formatKSTDate(p.period_start)}~${formatKSTDate(p.period_end)}` : ''}
                      {p.sent_at ? ` · ${formatKSTDate(p.sent_at)} 입금` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[12px] font-semibold ${p.status === 'sent' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {STATUS[p.status] ?? p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}
