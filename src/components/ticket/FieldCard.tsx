/**
 * 🎫 필드 카드 — 고른 값을 보여 주는 한 장 (2026-09-14 대표 확정 "안 B · 두 상세가 같은 부품")
 *
 * ## 왜 생겼나
 * 대표 신고: *"숙소 이용권에서 일자, 인원 버튼 세로 높이가 짧고 디자인 전반적으로 별로야."*
 * 그 자리를 재 보니 높이는 증상이었고 넷이 겹쳐 있었다 —
 *   ① 테두리 세 겹(바깥 카드 + 트리거 2개) ② 값인데 라벨 없이 가운데 정렬 버튼처럼
 *   ③ 날짜·박수가 14px 한 굵기 한 줄(좁으면 통째로 잘림) ④ "1박" 을 박스 안·밖에서 두 번
 *
 * 그리고 더 큰 것: **숙소 상세와 공구 상세가 서로 다른 체계 위에 지어져 있었다**
 * (숙소=Tailwind+티켓 토큰 / 공구=`--gbd-*` 인라인 스타일). 대표 *"두 상세가 같은 부품을 쓰도록 해줘"*.
 * ⇒ 이 파일이 그 **한 부품**이다. 두 상세가 여기서 같은 행을 그린다.
 *
 * ## 규칙 (docs/design/ticket-completion-reference-2026-09.md §1)
 *   1. **테두리 0** · 화이트만 `shadow-lift`(다크는 자동 none)
 *   2. 카드 *안* 구분선만 `border-rule`(투명 잉크) — 실선 hex 금지
 *   3. 모서리 16(`rounded-2xl`)
 *   4. **숫자가 주인공** — 값은 굵고 크게, 라벨은 작고 회색
 *
 * ## 쓰지 말 것
 * `border border-*` · `shadow-sm~2xl` · 행마다 테두리. 이 부품이 존재하는 이유가 그것들을 없애는 것이다.
 */
import type { ReactNode } from 'react'

/** 테두리 없는 카드 한 장. 자식 행 사이 구분선은 각 행이 스스로 긋는다. */
export function FieldCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift ${className}`}>
      {children}
    </div>
  )
}

/** 행 공통 껍데기 — 누를 수 있으면 button, 아니면 div. 두 번째 행부터 위에 구분선. */
function RowShell({
  onClick, ariaLabel, divider, children, minH,
}: { onClick?: () => void; ariaLabel?: string; divider: boolean; children: ReactNode; minH: string }) {
  const cls = `w-full flex items-center gap-3 px-4 text-left ${minH} ${
    divider ? 'border-t border-rule' : ''
  } ${onClick ? 'active:bg-black/[0.03] dark:active:bg-white/[0.04] transition-colors' : ''}`
  if (!onClick) return <div className={cls}>{children}</div>
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cls}>
      {children}
    </button>
  )
}

/** 오른쪽 끝 꺾쇠 — "누르면 펼쳐진다" 는 신호. 아이콘 폰트 없이 CSS 로 그린다. */
function Caret() {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 w-2 h-2 -mt-0.5 rotate-45 border-r-[1.7px] border-b-[1.7px] border-gray-400 dark:border-gray-500"
    />
  )
}

const LABEL = 'text-[11.5px] font-bold text-gray-500 dark:text-gray-400 leading-none'

/**
 * 라벨 + 값 한 행. 오른쪽에 컨트롤(스테퍼 등)을 두면 꺾쇠 대신 그것이 온다.
 * 공구 상세의 '수량' 행과 숙소의 '인원' 행이 **같은 이 행**이다.
 */
export function FieldRow({
  label, value, hint, right, onClick, divider = false,
}: {
  label: string
  value: ReactNode
  /** 라벨 옆 작은 부연 — 예: "1인당 최대 2개" */
  hint?: ReactNode
  /** 오른쪽 컨트롤. 주면 꺾쇠 대신 이것이 온다. */
  right?: ReactNode
  onClick?: () => void
  divider?: boolean
}) {
  return (
    <RowShell onClick={onClick} ariaLabel={onClick ? `${label} 변경` : undefined} divider={divider} minH="min-h-[58px] py-2.5">
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={LABEL}>{label}</span>
          {hint ? <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{hint}</span> : null}
        </span>
        <span className="block mt-[3px] text-[15px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white truncate">
          {value}
        </span>
      </span>
      {right ?? (onClick ? <Caret /> : null)}
    </RowShell>
  )
}

/**
 * 좌·우 두 값 사이에 배지 하나 — 체크인 · **1박** · 체크아웃.
 *
 * 🔑 가운데 배지가 두 날짜를 잇는 **관계**를 그림으로 말한다. 그래서 박수를 다른 줄에서
 * 또 말할 필요가 없다(대표 지적 ④ 가 여기서 닫힌다).
 */
export function FieldSplit({
  leftLabel, leftValue, leftSub, badge, rightLabel, rightValue, rightSub, onClick, divider = false,
}: {
  leftLabel: string
  leftValue: string
  /** 값 뒤에 작게 — 예: 요일 "월" */
  leftSub?: string
  badge: ReactNode
  rightLabel: string
  rightValue: string
  rightSub?: string
  onClick?: () => void
  divider?: boolean
}) {
  return (
    <RowShell onClick={onClick} ariaLabel={onClick ? '날짜 변경' : undefined} divider={divider} minH="min-h-[66px] py-2.5">
      <span className="flex-1 min-w-0">
        <span className={`block ${LABEL}`}>{leftLabel}</span>
        <span className="block mt-[3px] text-[17px] font-extrabold tracking-[-0.02em] tabular-nums text-gray-900 dark:text-white">
          {leftValue}
          {leftSub ? <span className="ml-[3px] text-[13px] font-bold">{leftSub}</span> : null}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-brand px-2.5 py-[3px] text-[11px] font-extrabold tabular-nums text-white">
        {badge}
      </span>
      <span className="flex-1 min-w-0 text-right">
        <span className={`block ${LABEL}`}>{rightLabel}</span>
        <span className="block mt-[3px] text-[17px] font-extrabold tracking-[-0.02em] tabular-nums text-gray-900 dark:text-white">
          {rightValue}
          {rightSub ? <span className="ml-[3px] text-[13px] font-bold">{rightSub}</span> : null}
        </span>
      </span>
    </RowShell>
  )
}

/** 카드 맨 아래 각주 한 줄 — 고르는 값이 아니라 고정 안내(체크인/체크아웃 시각 등). */
export function FieldNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-rule px-4 py-[11px] text-[12px] tabular-nums text-gray-500 dark:text-gray-400">
      {children}
    </div>
  )
}
