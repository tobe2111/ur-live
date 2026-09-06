/**
 * 🚦 상태 배지 — 대시보드에서 "지금 어떤 상태인가" 를 **색으로** 말하는 단 하나의 자리 (2026-09-03)
 *
 * ■ 왜 만들었나 — 상태 배지가 전부 같은 회색이었다(라이브 실측)
 *   `tailwind.config.js` 는 2026-06-19 대표 지시("아예 흑백, 기능 빨강만 유지")로 장식 색조를
 *   전부 잉크로 중화한다. 그런데 대시보드 상태 배지는 바로 그 색조로 상태를 구분하고 있었다 —
 *   `대기 amber` · `완료 emerald` · `반려 rose`. 중화 뒤 셋은 **완전히 같은 픽셀**이 된다:
 *
 *     .bg-rose-50    → rgb(248 247 252)      .bg-emerald-50    → rgb(248 247 252)
 *     .text-rose-700 → rgb(61 60 58)         .text-emerald-700 → rgb(61 60 58)
 *
 *   즉 반려된 출금과 승인된 출금이 한 표에서 구분이 안 됐다. 에러가 안 나고 "색이 있는 것처럼"
 *   보여서 몇 달간 아무도 몰랐다 — 이 레포가 반복해 겪은 **조용한 부재**다.
 *
 * ■ 규칙
 *   상태는 **의미 네 가지**로만 말한다. 색조를 새로 고르지 말고 여기서 고를 것.
 *     ok(완료·승인·정상) · warn(대기·검수) · bad(반려·실패·연체) · info(진행중·발송) · neutral(그 외)
 *   대표 원칙("기능 신호는 색 유지")을 지키면서, 소비자 장식색은 그대로 흑백으로 둔다.
 *
 * ⚠️ 이 컴포넌트가 **못** 하는 것: 어떤 상태가 어느 tone 인지 판단(그건 각 화면의 상태표가 안다) ·
 *    색맹 대응(색 말고 라벨이 항상 함께 있어야 하는 이유다 — `children` 을 비우지 말 것).
 */
import type { ReactNode } from 'react'

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'

/** className 만 필요할 때(기존 상태표의 `cls` 자리) 쓴다. */
export const TONE_PILL: Record<StatusTone, string> = {
  ok: 'bg-tone-ok-bg text-tone-ok',
  warn: 'bg-tone-warn-bg text-tone-warn',
  bad: 'bg-tone-bad-bg text-tone-bad',
  info: 'bg-tone-info-bg text-tone-info',
  neutral: 'bg-gray-100 text-gray-500',
}

/** 글자만 tone 으로 물들일 때(표 셀의 숫자 등). */
export const TONE_TEXT: Record<StatusTone, string> = {
  ok: 'text-tone-ok',
  warn: 'text-tone-warn',
  bad: 'text-tone-bad',
  info: 'text-tone-info',
  neutral: 'text-gray-500',
}

export default function StatusPill({
  tone = 'neutral', children, className = '',
}: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONE_PILL[tone]} ${className}`}>
      {children}
    </span>
  )
}
