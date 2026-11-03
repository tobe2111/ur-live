import { createContext, useContext, type ReactNode } from 'react'
import { formatNumber } from '@/utils/format'
import type { StoreRow } from './agency-stores-model'

/**
 * 🧾 에이전시 화면 — **토스 참고 안** (2026-11-03 대표 *"에이전시 화면은 토스 참고 안으로 해주고"*,
 *   시안 캔버스 H1·H2 · 참고 `docs/design/toss-reference-2026-11-03.md`).
 *
 * 무엇이 토스식인가: ① 관련 줄을 **둥근 판(24px)** 하나에 묶고 판 사이 여백(12px)이 구분선 역할을 한다
 *   ② 줄은 **두 줄**(제목 16·600 + 아래 13 회색) ③ 왼쪽은 옅은 블루 **타일**(40px) 안의 아이콘
 *   ④ 큰 숫자 하나(오늘 매출 합계)가 화면의 주인공.
 * ⚠️ 2026-11-02 "흐름 속 판은 평면(A안)" 의 **에이전시 화면 한정 예외**다 — 대표가 범위를 정했다. 판에 그림자는 없다.
 */
export const AgencyRowStyle = createContext<'flat' | 'toss'>('flat')
export const useAgencyRowStyle = () => useContext(AgencyRowStyle)

/** 판 하나 — 흰 면(다크는 한 톤 위) · 모서리 24 · 안쪽 여백은 줄이 갖는다. */
export const TOSS_CARD_CLS = 'rounded-[24px] bg-surface px-5 py-2'

export function TossCard({ title, children, testId }: { title?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <div className={TOSS_CARD_CLS} data-testid={testId}>
      {title && <h3 className="pt-3 pb-1 text-[16px] font-semibold text-gray-900 dark:text-white">{title}</h3>}
      {children}
    </div>
  )
}

/** 줄 왼쪽의 타일 — 옅은 블루 면에 블루 아이콘(진한 블루 면은 '사용처리' 하나로 남긴다). */
export function TossTile({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-[12px] flex items-center justify-center bg-brand-tint text-brand-text">
      {children}
    </span>
  )
}

/** 오늘 매출 — 맡은 매장 전부의 합. 서버가 매장별로 준 `today` 를 더할 뿐, 화면이 계산을 지어내지 않는다. */
export function AgencyTodayCard({ rows }: { rows: StoreRow[] | null }) {
  const withToday = (rows ?? []).filter((r) => r.today)
  const sum = (k: 'todayRevenue' | 'todayOrders' | 'pending' | 'activeProducts') =>
    withToday.reduce((n, r) => n + (r.today?.[k] ?? 0), 0)
  const known = rows !== null && withToday.length > 0
  return (
    <div className="rounded-[24px] bg-surface px-5 pt-5 pb-4" data-testid="agency-today-card">
      <p className="text-[13px] text-gray-500 dark:text-gray-400">오늘 매출{known && withToday.length > 1 ? ` · ${withToday.length}곳 합계` : ''}</p>
      {/* ⏳ 모르면 숫자를 지어내지 않는다 — 자리만 잡는다(0 으로 위장 금지). */}
      <p className="mt-1 text-[28px] font-bold tabular-nums leading-tight text-gray-900 dark:text-white min-h-[36px]">
        {known ? `${formatNumber(sum('todayRevenue'))}원` : rows === null ? '' : '—'}
      </p>
      <div className="mt-4 -mx-5 px-5 pt-3 grid grid-cols-3 border-t border-rule">
        {([['주문', 'todayOrders', '건'], ['확인 대기', 'pending', '건'], ['판매 중', 'activeProducts', '개']] as const).map(([label, k, unit], i) => (
          <div key={k} className={`text-center ${i > 0 ? 'border-l border-rule' : ''}`}>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`mt-1 text-[15px] font-medium tabular-nums ${k === 'pending' && sum('pending') > 0 ? 'text-brand-text' : 'text-gray-900 dark:text-white'}`}>
              {known ? `${formatNumber(sum(k))}${unit}` : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
