/**
 * 🎫 2026-09-29 (대표 확정 **B안 — 통장형**) 소개 콘솔의 **돈 한 판**.
 *
 * ## 왜 합쳤나
 * 대표: *"소개 콘솔도 페이지 너무 별로다"* → 무엇이 걸리는지 물었더니 셋을 골랐다 —
 * **섹션이 많다 · 차트가 밋밋하다 · 목록 문법이 안 맞는다.** 종전 콘솔은 판이 **8개**였고
 * 그중 **돈에 관한 것만 셋**이었다(요약 카드 · 출금 카드 · 일별 차트). 셋이 떨어져 있으니
 * "얼마 벌었고 언제 받나" 를 보려면 화면을 세 번 옮겨야 했고, 출금은 한가운데 묻혀 있었다.
 * ⇒ 이 판 하나가 [받을 돈 + 출금] → [이번 달 + 추이] → [최근 출금] 을 순서대로 말한다.
 *
 * ## 확정 디자인 시스템
 *   ④ **티켓 은유** — 위는 브랜드 면(`--brand`), 아래는 카드 면. 두 면이 맞닿는 자리가 구분선이다.
 *   ① 카드 테두리 0 · 들림(`shadow-lift`) 한 값 · 다크에선 들림 없음.
 *   ③ **숫자가 주인공** — 받을 돈 30px, 이번 달 22px, 나머지는 회색 보조.
 *   ⑥ 이모지 0 · 그라디언트 0. 🩸 종전 출금 카드는 `bg-gradient-to-br from-gray-800 to-gray-900`
 *      이었다 — 팔레트 밖이고 `check-design-slop` 이 잡는 평면 그라디언트 클래스다.
 *
 * ## 🔴 서버는 한 글자도 안 바꿨다
 * `지난달 대비` 를 쓰려면 전월 합계가 필요한데 대시보드는 **30일치만** 내려준다. 쿼리를 늘리는 대신
 * 있는 데이터로 정직하게 말한다 — **최근 2주 vs 그 전 2주**. 없는 값을 지어내지 않고, 라벨이
 * 무엇을 비교했는지 그대로 적는다.
 *
 * ## 🕳️ 막대가 밋밋했던 진짜 이유
 * 서버는 `GROUP BY date(created_at)` 이라 **적립이 있는 날만** 내려준다. 종전 차트는 그걸 그대로
 * `map` 해서 그려, 적립이 5일 있으면 막대가 5개였다 — 30일 추이가 아니라 그냥 막대 5개였다.
 * ⇒ 여기서는 **30칸을 날짜로 채운다**(빈 날은 0). 키는 서버와 같은 **UTC 날짜**다
 *    (`date(created_at)` 이 UTC 이므로 KST 로 만들면 하루가 어긋난다).
 */
import { Link } from 'react-router-dom'
import { formatWon, formatNumber, safeNum } from '@/utils/format'
import type { DashboardStats } from '@/features/curator/api/curator-api'
import type { WithdrawalInfo } from '../CuratorEarningsPage'

/** 서버 `date(created_at)`(UTC) 와 같은 키. 클라 TZ 와 무관하게 같은 문자열이 나온다. */
const utcDay = (offsetDays: number) =>
  new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)

/** `2026-08-31` → `8월 31일`. 앞 0 은 떼고, 없으면 빈 문자열(자리만 비운다). */
const startLabel = (iso?: string) => {
  const m = iso?.match(/^\d{4}-(\d{2})-(\d{2})$/)
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : ''
}

/** 30칸을 날짜로 채운다(빈 날 0). 오래된 날 → 오늘 순서. */
export function fillDays(daily: Array<{ date: string; amount: number }>, days = 30) {
  const byDate = new Map(daily.map((d) => [d.date, safeNum(d.amount)]))
  return Array.from({ length: days }, (_, i) => {
    const date = utcDay(days - 1 - i)
    return { date, amount: byDate.get(date) ?? 0 }
  })
}

/**
 * 최근 절반 vs 그 전 절반. 앞 절반이 0이면 **비율을 만들지 않는다** —
 * 0 에서 늘어난 것은 "∞%" 이고, 그런 숫자는 정보가 아니라 소음이다.
 */
export function halfOverHalf(slots: Array<{ amount: number }>) {
  const half = Math.floor(slots.length / 2)
  const prev = slots.slice(0, half).reduce((s, d) => s + d.amount, 0)
  const recent = slots.slice(half).reduce((s, d) => s + d.amount, 0)
  if (prev <= 0) return null
  return { pct: Math.round(((recent - prev) / prev) * 100), prev, recent }
}

export default function EarningsPanel({ stats, info, onWithdraw }: {
  stats: DashboardStats
  info: WithdrawalInfo | null
  onWithdraw: () => void
}) {
  const slots = fillDays(stats.earnings_daily_30d || [])
  const max = Math.max(...slots.map((d) => d.amount), 1)
  const delta = halfOverHalf(slots)
  const today = slots[slots.length - 1]
  const pending = safeNum(stats.pending_earnings)
  const isCash = info?.payout_mode === 'cash'
  const belowMin = !!info && info.available < info.min_withdrawal

  return (
    <section className="rounded-2xl overflow-hidden shadow-lift mb-3">
      {/* ── 티켓 밴드: 이 화면에 온 이유가 첫 줄에 온다 ── */}
      {info && (
        <div className="bg-brand text-white px-4 py-4 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold opacity-80">
              {isCash ? '지금 받을 수 있는 돈' : '내 딜 잔액'}
            </span>
            <span className="block text-[30px] leading-none font-black tracking-[-0.04em] tabular-nums mt-1">
              {isCash ? formatWon(info.available) : `${formatNumber(info.deal_balance)}딜`}
            </span>
          </span>
          {isCash ? (
            <button
              type="button"
              onClick={onWithdraw}
              disabled={belowMin}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-white/20 text-white text-[13px] font-extrabold disabled:opacity-50"
            >
              {belowMin ? `${formatWon(info.min_withdrawal)}부터` : '출금'}
            </button>
          ) : (
            <Link to="/browse" className="shrink-0 px-4 py-2.5 rounded-xl bg-white/20 text-white text-[13px] font-extrabold">
              쓰러 가기
            </Link>
          )}
        </div>
      )}

      {/* ── 본문: 이번 달 + 30일 추이 ── */}
      <div className="bg-surface px-4 pt-3.5 pb-4">
        <div className="flex items-baseline gap-2.5 mb-3">
          <span className="text-[22px] font-black tracking-[-0.03em] tabular-nums text-gray-900 dark:text-white">
            {formatWon(stats.month_earnings)}
          </span>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">30일 적립</span>
          {delta && (
            <span className="ml-auto text-[11.5px] font-bold text-gray-500 dark:text-gray-400">
              최근 2주 <b className={delta.pct >= 0 ? 'text-brand-text' : 'text-sale'}>{delta.pct >= 0 ? '+' : ''}{delta.pct}%</b>
            </span>
          )}
        </div>

        <div className="flex items-end gap-[2px] h-14" aria-hidden="true">
          {slots.map((d, i) => (
            <div
              key={d.date}
              title={`${d.date}: ${formatWon(d.amount)}`}
              className={`flex-1 rounded-[2px] ${i === slots.length - 1 && d.amount > 0 ? 'bg-brand' : 'bg-brand/25'}`}
              style={{ height: `${Math.max(2, (d.amount / max) * 56)}px` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10.5px] text-gray-400 dark:text-gray-500 mt-1.5">
          <span>{startLabel(slots[0]?.date)}</span>
          <span>{today && today.amount > 0 ? `오늘 ${formatWon(today.amount)}` : '오늘'}</span>
        </div>

        {pending > 0 && (
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-2.5">
            적립 예정 {formatNumber(pending)}딜. 구매가 확정되면 더해진다
          </p>
        )}

        {/* 최근 출금 — 돈 이야기를 이 판에서 끝낸다(별도 섹션을 만들지 않는다) */}
        {!!info?.history?.length && (
          <div className="mt-3 pt-3 border-t border-rule space-y-1.5">
            {info.history.slice(0, 3).map((h) => (
              <div key={h.id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-gray-500 dark:text-gray-400 truncate">
                  {formatWon(h.amount)} <span className="text-gray-400 dark:text-gray-500">{h.bank_name}</span>
                </span>
                <span className="shrink-0 font-bold text-gray-500 dark:text-gray-400">{WITHDRAW_LABEL[h.status] ?? h.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** 상태는 **글자로** 말한다 — 색으로만 말하면 색맹·흑백에서 사라진다(표면 규칙 ⑥). */
const WITHDRAW_LABEL: Record<string, string> = {
  paid: '지급 완료', pending: '처리 중', requested: '신청됨', rejected: '반려',
}
