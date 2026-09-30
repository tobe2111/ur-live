/**
 * 🪙 **내 딜 잔액 카드** — 교환권 화면 맨 위 (대표 확정 2026-09-30, 안 B "납작 카드")
 *
 * ## 구조 — 한 줄에 금액과 행동 둘
 * ```
 *   내 딜 잔액                      딜 모으기 │ 이용내역
 *   12,000 딜                       ← 28px
 * ```
 * 실측 **70px**(종전 A3 152px). 대표: *"내 딜 잔액 부분이 너무 크달까?"* — 실제로 이 카드 하나가
 * 첫 상품 위 chrome(≈440px)의 3분의 1이었다. 시안 넷(현재/한 줄 바 44/납작 70/상단바 흡수 0)을
 * 렌더해 **B** 로 확정. 근거·측정: `docs/design/vouchers-deal-balance-2026-09-30.md`.
 *
 * ⚠️ 2026-09-14 의 **안 A3(두 층 · 42px · 아래층에 행동 둘)** 은 이 결정으로 대체됐다.
 *   그 결정의 *이유*들은 아래에 살아 있다 — 대체된 것은 **크기와 배치**뿐이다.
 *
 * ## 🔴 되돌리면 안 되는 것 넷 (A3 에서 그대로 승계 — 가드가 고정)
 *  1. **채운 브랜드 버튼 0.** 종전엔 브랜드 블루로 채운 `[내역]` 알약이 화면에서 가장 센 버튼이었다
 *     (주 행동이 아닌데). 블루는 '딜 모으기' **글자** 한 곳에만.
 *  2. **고아 링크 0.** "딜 모으는 방법"이 카드 **밖**에 떠 있었고 잔액 1만 미만일 때만 나왔다
 *     (2026-09-01 인계가 *"고아 링크 40px"* 이라 지적한 자리). 두 행동은 카드 안에 있는다.
 *  3. **"1딜 = 1원 · 현금처럼 사용" 은 안 쓴다** (대표: *"딜의 값어치를 말할 필요는 없어.
 *     어차피 교환권을 통해서 어느 정도는 알거니까."*). 바로 아래가 가격표 붙은 목록이라
 *     **화면이 이미 그 말을 한다.** 지운 이유가 자리 부족이 아니라 중복이다.
 *  4. **잔액 0 은 큰 카드를 쓰지 않는다.** `dealBalance` 는 비로그인 방문자에게도 0 이다.
 *     그대로 쓰면 첫 진입이 "당신은 0" 이라고 알리는 상자로 시작한다(2026-09-01 에 고친 실수).
 *     0 이면 한 줄 바로 접고, 문구도 잔액이 아니라 **할 수 있는 일**을 말한다.
 *
 * ## 🧮 2026-09-16 — 로그인한 사람은 숫자가 오기 전에도 카드를 두고 기다린다
 * 잔액은 마운트 뒤 API 로 온다. 그래서 첫 커밋은 **누구든 `null`** 이고, 이 부품은 그걸 44px 한 줄
 * 바로 그렸다 — 응답이 오면 카드로 바뀌면서 **아래 목록 전체가 한 번 밀렸다.** 딜을 가진
 * 사람일수록 매번 겪는 밀림이다.
 *
 * ⇒ 로그인 여부는 **동기로 알 수 있다**(`getUserIdSync`). 로그인이면 숫자만 비운 같은 카드를 먼저
 * 그리고(=높이 동일), 비로그인이면 종전대로 한 줄 바다. 어느 쪽도 **밀리지 않는다.**
 * ⚠️ 빈 자리에 0 을 적지 않는다 — 모르는 것과 0 은 다르고, 잠깐 0 을 보여 줄 이유가 없다.
 *
 * ## 🔁 이 부품은 마이도 쓴다
 * `user-profile/TeamPointsCard` 가 같은 부품을 쓴다(2026-09-28 통합 — 베끼면 다음 변경에서 또
 * 한쪽만 따라간다). **여기를 고치면 마이도 같이 바뀐다.** 그게 의도다.
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
  /**
   * 로그인한 사람인가(동기 판정). `balance` 가 아직 `null` 일 때 **높이를 잡기 위해서**만 쓴다 —
   * 로그인이면 숫자만 비운 카드, 아니면 한 줄 바. 생략하면 종전대로 전부 한 줄 바다.
   */
  loggedIn?: boolean
  /**
   * 🔁 2026-09-28 — 마이가 이 카드를 같이 쓰게 되면서 생긴 자리.
   *   금액 **아래** 한 줄(예: *"무상 리워드 N딜 포함 · 환급 가능 M딜"*). 없으면 안 그린다.
   *   ⚠️ 글자다, 버튼이 아니다 — 위층에 버튼을 두지 않는 것이 안 A3 의 전부다(가드가 고정).
   */
  note?: string
  /**
   * 🛡️ 조회 실패. **0 으로 위장하지 않는다**(2026-07-02 규칙).
   *   큰 카드에 `—` 를 크게 띄우는 대신 **한 줄 바**로 접고 다시 시도를 준다 —
   *   모르는 값을 42px 로 보여 줄 이유가 없고, 0 바와 높이가 같아 화면이 안 밀린다.
   */
  error?: boolean
  onRetry?: () => void
}

export default function DealBalanceCard({
  balance, variant = 'full', loggedIn = false, note, error = false, onRetry,
}: DealBalanceCardProps) {
  const navigate = useNavigate()
  const compact = variant === 'compact'

  // 🛡️ 조회 실패가 먼저다 — 여기서 갈라 내야 아래 0/기다림 분기를 한 글자도 안 건드린다.
  if (error) {
    return (
      <button
        type="button"
        onClick={onRetry}
        disabled={!onRetry}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-surface shadow-lift active:scale-[0.99] transition-transform disabled:active:scale-100 ${compact ? 'px-3 py-2' : 'h-11 px-4'}`}
      >
        <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate text-left">잔액을 불러오지 못했어요</span>
        {onRetry && <span className="shrink-0 text-[12px] font-bold text-brand-text">다시 시도</span>}
      </button>
    )
  }

  // 0(또는 미조회)은 한 줄 바 — 위 주석의 "당신은 0" 문제.
  // 로그인했는데 숫자가 아직 안 왔다 → 같은 카드를 숫자만 비워 그린다(높이 동일 → 밀림 0).
  const awaiting = balance == null && loggedIn
  if (!balance && !awaiting) {
    return (
      <button
        type="button"
        onClick={() => navigate(EARN_PATH)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-surface shadow-lift active:scale-[0.99] transition-transform ${compact ? 'px-3 py-2' : 'h-11 px-4'}`}
      >
        <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate text-left">딜을 모으면 더 싸게 살 수 있어요</span>
        <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-brand-text">
          모으는 방법 <ArrowRight className="w-3 h-3" />
        </span>
      </button>
    )
  }

  /**
   * 행동 둘. 🔴 **채운 버튼을 만들지 않는다** — 종전 위층 오른쪽의 브랜드 블루 [내역] 알약이
   * 화면에서 가장 센 버튼이었고(주 행동이 아닌데) 그것이 2026-09-14 에 A3 로 간 이유다.
   * 좁은 레일(`compact`)에서는 숫자와 한 줄에 못 들어가므로 **아래로 내린다**(7자리 잔액 기준).
   */
  const actions = (
    <div className={compact ? 'flex items-center gap-3 mt-2' : 'ml-auto shrink-0 flex items-center gap-3 pl-3'}>
      <button
        type="button"
        onClick={() => navigate(EARN_PATH)}
        className="text-[13px] font-bold text-brand-text active:opacity-60 transition-opacity"
      >
        딜 모으기
      </button>
      <span className="w-px h-3 bg-rule" aria-hidden="true" />
      <button
        type="button"
        onClick={() => navigate(HISTORY_PATH)}
        className="text-[13px] font-bold text-gray-500 dark:text-gray-400 active:opacity-60 transition-opacity"
      >
        이용내역
      </button>
    </div>
  )

  return (
    <div className="w-full rounded-xl bg-surface shadow-lift px-4 py-3" aria-busy={awaiting || undefined}>
      <div className={compact ? undefined : 'flex items-center'}>
        <div className="min-w-0">
          <p className="text-gray-500 dark:text-gray-400 tracking-wide mb-1 text-[12px]">내 딜 잔액</p>
          <div className="flex items-baseline gap-1">
            <span className={`font-extrabold text-gray-900 dark:text-white leading-none tracking-tight tabular-nums ${compact ? 'text-[17px]' : 'text-[28px]'}`}>
              {/* ⏳ 숫자를 모를 땐 빈 자리를 둔다 — 0 을 적으면 거짓말이고, 비워 두면 높이만 잡힌다. */}
              {awaiting ? <span className="inline-block w-[2.2em] h-[0.72em] rounded bg-wash align-baseline" aria-hidden="true" /> : formatNumber(balance)}
            </span>
            <span className="font-bold text-gray-400 dark:text-gray-500 text-[13px]">딜</span>
          </div>
          {/* 글자 한 줄. 버튼이 아니다 — 왼쪽은 금액 하나가 주인공이다. */}
          {!awaiting && note && (
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-[12px]">{note}</p>
          )}
        </div>
        {!compact && actions}
      </div>
      {compact && actions}
    </div>
  )
}
