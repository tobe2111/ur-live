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
// 🎬 2026-11-02 시안 9차 "곧 끝나는 이용권"(대표 "다 해주고") — 열 때 빨간 D-N 표시만 한 번 살짝 흔들린다.
//   줄 전체를 흔들지 않는 이유: 이 줄엔 유달이가 있다(대표 "유달이 움직이는건 더 쓰지 말자").
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-expiry', `@keyframes ur-exp-nudge { 0%,100% { transform: none; } 20% { transform: translateX(-3px) rotate(-4deg); } 40% { transform: translateX(3px) rotate(4deg); } 60% { transform: translateX(-2px); } 80% { transform: translateX(1px); } }.ur-exp-nudge { display: inline-block; animation: ur-exp-nudge .6s cubic-bezier(.36,.07,.19,.97) .4s backwards; }@media (prefers-reduced-motion: reduce){.ur-exp-nudge{animation:none!important}}`)

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
      className="mb-3 w-full flex items-center gap-3 rounded-2xl bg-surface py-3 pl-3 pr-5 text-left active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors"
    >
      <Udal mood="paid" size={52} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{title}</span>
        <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400">{name}</span>
      </span>
      <span className="ur-exp-nudge shrink-0 text-[15px] font-bold tabular-nums text-tone-bad">{d === 0 ? 'D-DAY' : `D-${d}`}</span>
    </button>
  )
}
