/**
 * 🪙 **내 딜 잔액 카드** — 교환권 화면 맨 위 (대표 확정 2026-09-14, 안 A3 + 42px)
 *
 * 당근포인트 화면을 레퍼런스로 받아 A/B/C 세 방향을 그리고, A(두 층 카드) 안에서 여섯 배치를
 * 다시 갈라 **A3**로 확정했다. 시안·근거: `docs/design/vouchers-deal-balance-2026-09-14.md`.
 *
 * ## 구조 — 위층은 금액만, 아래층은 행동 둘
 * ```
 *   내 딜 잔액
 *   11,200 딜          ← 42px. 이 카드에서 가장 센 것은 금액 하나다
 *   ─────────────────
 *   딜 모으기 │ 이용내역   ← 같은 무게로 나란히. 채운 버튼은 0개
 * ```
 * 종전에는 위층 오른쪽에 **브랜드 블루로 채운 `[내역]` 알약**이 있어서 화면에서 가장 센 버튼이
 * 내역 보기였다(주 행동이 아닌데). 그리고 "딜 모으는 방법"이 **카드 밖 고아 링크**로 떠 있었고
 * 잔액 1만 미만일 때만 나왔다 — 2026-09-01 인계가 *"고아 링크 40px"* 이라고 지적한 그 자리다.
 * 두 행동을 아래층으로 내려 **고아를 없애고** 위층을 금액에 돌려줬다.
 *
 * ## 🚫 "1딜 = 1원 · 현금처럼 사용" 은 뺐다 (대표 확정)
 * > *"딜의 값어치를 말할 필요는 없어. 어차피 교환권을 통해서 어느 정도는 알거니까."*
 *
 * 바로 아래가 가격표 붙은 이용권 목록이라 그 줄이 하는 일을 **화면이 이미 한다.**
 * ⚠️ 되살리지 말 것 — 지운 이유가 자리 부족이 아니라 중복이다.
 *
 * ## 잔액 0 은 큰 카드를 쓰지 않는다
 * `dealBalance` 는 **비로그인 방문자에게도 0** 이다. 큰 카드를 그대로 쓰면 첫 진입이
 * "당신은 0" 이라고 알리는 상자로 시작한다(2026-09-01 에 이미 한 번 고친 실수).
 * 그래서 0 이면 한 줄 바로 접고, 문구도 잔액이 아니라 **할 수 있는 일**을 말한다.
 */
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

/** 딜을 모으러 가는 곳 — 지금은 동네 이용권 지도(쓰면 쌓인다). */
const EARN_PATH = '/map'
/** 딜 입출금 내역. 충전이 종료돼(2026-07-18) 내역이 이 자리의 유일한 조회 동선이다. */
const HISTORY_PATH = TOPUP_DISABLED ? '/my-deal-history' : '/points/charge'

export interface DealBalanceCardProps {
  /** 서버가 준 잔액. `null` = 아직 못 읽음(0 과 구분해 큰 카드를 섣불리 접지 않는다). */
  balance: number | null
  /** `compact` = PC 좌측 레일(248px). 같은 구조를 좁은 폭으로 낸다. */
  variant?: 'full' | 'compact'
}

export default function DealBalanceCard({ balance, variant = 'full' }: DealBalanceCardProps) {
  const navigate = useNavigate()
  const compact = variant === 'compact'

  // 0(또는 미조회)은 한 줄 바 — 위 주석의 "당신은 0" 문제.
  if (!balance) {
    return (
      <button
        type="button"
        onClick={() => navigate(EARN_PATH)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-[#1D1F29] shadow-lift active:scale-[0.99] transition-transform ${compact ? 'px-3 py-2.5' : 'h-11 px-3.5'}`}
      >
        <span className="text-[12.5px] text-gray-600 dark:text-gray-300 truncate text-left">딜을 모으면 더 싸게 살 수 있어요</span>
        <span className="shrink-0 inline-flex items-center gap-0.5 text-[11.5px] font-bold text-brand-text">
          모으는 방법 <ArrowRight className="w-3 h-3" />
        </span>
      </button>
    )
  }

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift overflow-hidden">
      {/* 위층 — 라벨과 금액만. 버튼을 두지 않는다(그게 A3 의 전부다). */}
      <div className={compact ? 'px-4 pt-4 pb-3.5' : 'px-5 pt-5 pb-4'}>
        <p className={`text-gray-500 dark:text-gray-400 tracking-wide ${compact ? 'text-[11px] mb-1.5' : 'text-[12px] mb-2'}`}>내 딜 잔액</p>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-extrabold text-gray-900 dark:text-white leading-none tracking-tight tabular-nums ${compact ? 'text-[30px]' : 'text-[42px]'}`}>
            {formatNumber(balance)}
          </span>
          <span className={`font-bold text-gray-400 dark:text-gray-500 ${compact ? 'text-[15px]' : 'text-[18px]'}`}>딜</span>
        </div>
      </div>

      {/* 아래층 — 두 행동이 같은 무게로. 브랜드 블루는 '딜 모으기' 글자 한 곳에만. */}
      <div className="h-px bg-rule" />
      <div className="flex">
        <button
          type="button"
          onClick={() => navigate(EARN_PATH)}
          className="flex-1 py-3.5 text-[12.5px] font-bold text-brand-text active:opacity-60 transition-opacity"
        >
          딜 모으기
        </button>
        <span className="w-px bg-rule" aria-hidden="true" />
        <button
          type="button"
          onClick={() => navigate(HISTORY_PATH)}
          className="flex-1 py-3.5 text-[12.5px] font-bold text-gray-700 dark:text-gray-200 active:opacity-60 transition-opacity"
        >
          이용내역
        </button>
      </div>
    </div>
  )
}
