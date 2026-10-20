/**
 * 🦦 지갑 위 '곧 끝나는 이용권' 한 줄 (2026-10-09 대표 확정 시안 ③ — "좋다 모두 해줘").
 *
 * 왜 따로 한 줄인가: 접힌 줄의 빨간 `D-N`(2026-10-08)은 **목록을 훑어야** 보인다. 산 이용권을
 * 못 쓰고 날리는 건 대개 "있는 줄 몰라서" 다 — 지갑을 열자마자 첫 줄에서 말해야 한다.
 *
 * 규칙
 *   · 기준은 `URGENT_DAYS`(접힌 줄의 빨강과 **같은 값**). 기준 안에 든 게 없으면 아무것도 안 그린다.
 *   · 가장 급한 한 장만 이름을 대고, 나머지는 `외 N장` 으로 센다(줄이 두 줄이 되면 공지가 아니라 목록이다).
 *   · 누르면 그 이용권의 QR 이 열린다 — 접힌 줄을 누른 것과 같은 동작.
 *   · 유달이는 이 화면의 **한 마리**다(빈 지갑일 땐 이 줄이 안 뜨므로 겹치지 않는다).
 */
import Udal from '@/components/mascot/Udal'
import { daysLeftOf, URGENT_DAYS } from './WalletRow'
import type { Voucher } from './types'

export function pickExpiring(items: Voucher[]): Voucher[] {
  return items.filter((v) => {
    const d = daysLeftOf(v)
    return v.status === 'unused' && d !== null && d <= URGENT_DAYS
  })
}

export default function ExpiryNotice({ items, t, onOpen }: {
  /** 사용 가능한 이용권(만료 가까운 순으로 정렬돼 들어온다). */
  items: Voucher[]
  t: (key: string, opts?: Record<string, unknown>) => string
  onOpen: (v: Voucher) => void
}) {
  const soon = pickExpiring(items)
  if (soon.length === 0) return null
  const first = soon[0]
  const d = daysLeftOf(first) ?? 0
  const title = d === 0
    ? t('voucher.expiryNoticeToday', { defaultValue: '오늘까지 써야 하는 이용권이 있어요' })
    : t('voucher.expiryNoticeDays', { defaultValue: '{{d}}일 남은 이용권이 있어요', d })
  const name = first.product_name + (soon.length > 1 ? t('voucher.expiryNoticeMore', { defaultValue: ' 외 {{n}}장', n: soon.length - 1 }) : '')

  return (
    <button
      type="button"
      onClick={() => onOpen(first)}
      className="mb-4 w-full flex items-center gap-3 rounded-2xl bg-surface shadow-lift py-3 pl-2 pr-4 text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
    >
      <Udal mood="paid" size={52} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{title}</span>
        <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400">{name}</span>
      </span>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-tone-bad">{d === 0 ? 'D-DAY' : `D-${d}`}</span>
    </button>
  )
}
