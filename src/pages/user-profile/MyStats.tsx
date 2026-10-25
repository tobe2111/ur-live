/**
 * 🔢 마이 상단 **숫자 한 줄** — 대표 확정 **안 C**(2026-09-29, 코레일톡 전체메뉴 형태).
 *
 * ## 무엇을 대체했나
 * 종전엔 같은 숫자들이 **따로따로 카드**였다 — 폰에서는 딜 잔액이 카드 하나(`TeamPointsCard`),
 * PC 에서는 딜·이용권·교환권·쿠폰이 **각각 큰 카드**(`AccountPcPane`)로 넷이었고 **그중 셋이 0** 이었다.
 * 0 을 네 번 말하려고 화면의 절반을 쓰고 있었던 셈이다.
 * 코레일톡은 같은 일을 **구분선 한 줄**로 한다(쿠폰 0 | KTX 마일리지 0). 그게 이 부품이다.
 *
 * ## 규칙
 * - 숫자가 주인공이다(표면 규칙 ③) — 라벨 13px 위, 값 24px 아래.
 * - **값에 단위를 붙이지 않는다**(`10,300딜` 아님 `10,300`) — 라벨이 이미 무엇인지 말한다.
 *   🩸 2026-09-30 (대표 *"홈 / 마이에서 내 딜이 10,30 이렇게 잘려보여 … 모바일 기준으로"*):
 *   단위가 그 잘림의 원인이었다. **실측**(dist 를 실제로 띄워 `scrollWidth` vs `clientWidth`):
 *
 *   | 폭 | 칸 안쪽 | `10,300딜` 필요 | 판정 |
 *   |---|---|---|---|
 *   | 430 | 111px | 105px | 통과(6px 여유 — 그래서 내 화면에선 안 보였다) |
 *   | **390**(아이폰 13) | **97px** | 105px | 🔴 **잘림** — 대표 폰이 이 폭이다 |
 *   | 360(갤럭시) | 87px | 105px | 🔴 잘림 |
 *
 *   이 부품이 베낀 코레일톡 화면도 값에 단위가 없다(`쿠폰 0` · `16:09`) — 단위는 내가 얹은
 *   드리프트였고, 그 17px 가 숫자를 칸 밖으로 밀어냈다. 빼고 안쪽 여백을 `px-4`→`px-3` 으로
 *   조여 세 폭 전부 통과한다. **다시 붙이지 말 것**(가드가 고정한다).
 * - **실패를 0 으로 위장하지 않는다**(머니 표면 룰, 2026-07-02 에 값을 치르고 배운 것):
 *   잔액 조회가 실패하면 `0딜` 이 아니라 `—` 다. 모르는 것과 없는 것은 다르다.
 * - 아직 안 온 값(`undefined`)은 **아예 안 그린다** — 잠깐 0 을 보여 주면 딜 보유자에게
 *   "잔액 없음" 이라고 말하는 꼴이 된다(2026-09-16 잔액 카드와 같은 판단).
 * - 0 은 **회색**이다(잉크로 굵게 0 을 쓰면 화면이 "당신은 0" 이라고 알린다).
 *
 * ## ⚠️ 이 부품이 못 하는 것
 * - 무상(리워드) 딜 안내는 한 줄 아래에 **따로** 붙는다 — 3열 대칭을 깨지 않으려고 셀 안에 안 넣는다.
 * - 재시도 버튼이 없다. 실패하면 `—` 이고, 셀을 누르면 딜 내역 화면으로 간다(거기서 다시 읽는다).
 *   버튼을 세 칸짜리 줄 안에 넣으면 그 칸만 높이가 달라져 줄이 무너진다.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

/** 💸 충전 잔액 환급 — 누를 때만 받는다(첫 화면 번들 밖). */
const RefundSheet = lazy(() => import('./RefundSheet'))

/** 💸 충전은 2026-07-18 에 종료됐다 — 딜의 "자세히" 는 내역이다. */
const DEAL_PATH = TOPUP_DISABLED ? '/my-deal-history' : '/points/charge'

function Cell({ label, to, value, compact = false, foot }: {
  label: string
  to: string
  /** `undefined` = 아직 모름(안 그린다) · `null` = 조회 실패(`—`) · 숫자 = 값 */
  value: number | null | undefined
  /**
   * 🎗️ 2026-10-11 **안 5 띠 모드** — 칸이 폭을 나눠 갖지 않고 **내용만큼만** 차지하고 오른쪽에 붙는다.
   * ⚠️ `flex-1` 과 `flex-none` 을 한 문자열에 같이 쓰지 않는다 — 어느 쪽이 이기는지는 클래스 순서가
   *    아니라 **생성된 CSS 순서**가 정하므로 조용히 뒤집힌다. 그래서 둘 중 하나만 고른다.
   */
  compact?: boolean
  /** 띠 모드에서 값 아래 한 줄(환급 가능 등). 폰 줄에서는 안 쓴다 — 거기선 줄 밖 `<p>` 가 맡는다. */
  foot?: string
}) {
  // 📏 폰 줄의 값은 2026-09-30 에 390px 실측으로 확정된 것이다 — **문자열 그대로 유지**(가드가 고정).
  const box = compact
    ? 'shrink-0 px-5 first:pl-0 last:pr-0 text-right'
    : 'flex-1 min-w-0 px-3 first:pl-4 last:pr-4'
  return (
    <Link to={to} className={`${box} active:opacity-70`}>
      <span className={`flex items-center gap-1 text-[13px] font-medium text-gray-500 dark:text-gray-400${compact ? ' justify-end' : ''}`}>
        <span className="truncate">{label}</span>
        <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
      </span>
      <span className="block mt-1 text-[24px] font-bold tabular-nums leading-tight tracking-[-0.03em] truncate">
        {value === undefined ? (
          /* 아직 안 왔다 — 자리만 잡고 숫자를 지어내지 않는다(높이가 같아 도착해도 안 밀린다). */
          <span className="inline-block w-10 h-[18px] align-middle rounded bg-gray-100 dark:bg-white/[0.06]" aria-hidden="true" />
        ) : value === null ? (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        ) : (
          <span className={value > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
            {formatNumber(value)}
          </span>
        )}
      </span>
      {foot && <span className="block mt-1 text-[12px] font-medium text-gray-500 dark:text-gray-400 truncate">{foot}</span>}
    </Link>
  )
}

export default function MyStats({ voucher, coupon, inline = false }: {
  voucher?: number | null
  coupon?: number | null
  /**
   * 🎗️ 2026-10-11 **안 5**: PC 머리 띠 안에 **그대로 끼워 넣는 모드**(`AccountPcBand`).
   * 칸이 오른쪽에 붙고, 바깥 `ur-content-medium` 래퍼와 줄 밖 안내문을 쓰지 않는다
   * (한 줄 띠 안에서 그 `<p>` 가 두 번째 줄을 만들면 띠가 아니게 된다 — 값 아래 `foot` 가 대신한다).
   * ⚠️ **폰 출력은 한 글자도 안 바뀐다** — `inline` 이 거짓일 때의 경로가 종전과 byte-동일이다.
   */
  inline?: boolean
}) {
  /** `undefined` 아직 · `null` 실패 · 숫자 값 */
  const [balance, setBalance] = useState<number | null | undefined>(undefined)
  const [freeBalance, setFreeBalance] = useState(0)
  /**
   * 💸 2026-10-12 실제로 **신청할 수 있는** 환급액(서버 한도 SSOT — `deal-refund.ts`).
   *   종전엔 `balance − free` 를 "환급 가능" 이라고 말했는데, 그 유상 잔액엔 충전 말고 다른 것도
   *   섞일 수 있어 신청하면 거절되는 숫자였다. 서버가 안 주면(구버전·조회 실패) 0 — 버튼을 안 띄운다.
   */
  const [refundable, setRefundable] = useState(0)
  /** 처리 중인 환급 신청 금액 — 전액 신청 뒤에도 "처리 중" 으로 다시 열 수 있게(서버가 준 값). */
  const [refundPending, setRefundPending] = useState(0)
  const [refundOpen, setRefundOpen] = useState(false)

  useEffect(() => {
    if (!getUserIdSync()) { setBalance(null); return }
    // ⚡ 2026-10-06 — `api` 정적 사용. 동적 import 는 이 요청을 다음 task 로 밀어
    //   형제 여섯(+564~571ms)보다 한 박자 늦게(+836ms) 나갔다. 유일 소비처
    //   `UserProfilePage` 가 이미 `api` 를 정적 import 하므로 청크 비용 0.
    const fetchBalance = () => {
      api.get('/api/points/balance')
        .then((r) => {
          if (r.data.success) {
            setBalance(Number(r.data.data.balance ?? 0))
            setFreeBalance(Math.max(0, Number(r.data.data.free_balance ?? 0)))
            setRefundable(Math.max(0, Math.floor(Number(r.data.data.refundable ?? 0)) || 0))
            setRefundPending(Math.max(0, Math.floor(Number(r.data.data.refund_pending ?? 0)) || 0))
          } else setBalance(null)
        })
        // 🛡️ 실패는 `null` — `0` 으로 떨어뜨리면 화면이 거짓말을 한다.
        .catch(() => setBalance(null))
    }
    fetchBalance()
    // 딜을 쓰고 돌아왔을 때 즉시 맞는다.
    const handler = () => fetchBalance()
    window.addEventListener('pointsBalanceChanged', handler)
    return () => window.removeEventListener('pointsBalanceChanged', handler)
  }, [])

  /** 잔액 아래 한 줄을 그릴 이유가 있는가 — 무상 딜이 섞였거나, 돌려받을 딜이 있다. */
  const showNote = balance != null && (freeBalance > 0 || refundable > 0 || refundPending > 0)
  const refundButton = refundable > 0 || refundPending > 0 ? (
    <button
      type="button"
      onClick={() => setRefundOpen(true)}
      className="shrink-0 h-8 px-3 rounded-full border border-rule-strong text-[12px] font-medium text-gray-900 dark:text-white active:opacity-70"
    >
      {refundable > 0 ? '환급 신청' : '환급 처리 중'}
    </button>
  ) : null
  const refundSheet = refundOpen ? (
    <Suspense fallback={null}>
      <RefundSheet onClose={() => setRefundOpen(false)} />
    </Suspense>
  ) : null

  const cells = (
    /* ➖ 칸 사이 세로 구분선 — `divide-x` 가 첫 칸 앞에는 안 긋는다(코레일톡과 같은 모양). */
    <div className={`flex items-start divide-x divide-rule${inline ? '' : ' py-1'}`}>
      <Cell
        compact={inline}
        label="내 딜"
        to={DEAL_PATH}
        value={balance}
        /* 띠에서는 줄 밖 `<p>` 를 못 쓴다 — 같은 사실을 값 아래 한 줄로 말한다. */
        foot={inline && refundable > 0 ? `환급 가능 ${formatNumber(refundable)}` : undefined}
      />
      <Cell compact={inline} label="이용권" to="/my-vouchers" value={voucher} />
      {/* 🔢 2026-10-18 (대표 *"같은 숫자 하나로 줄여줘"*) — **교환권 칸을 뺐다. 폰·PC 가 같은 세 칸이다.**
          종전엔 PC 에서만 넷째 칸(교환권)이 섰다(폰은 390px ÷ 4 가 너무 좁아서). 그래서 PC 는 교환권
          장수를 이 줄과 아래 '내 교환권' 줄에서 **두 번** 말했고, 폰과 PC 가 다른 칸 수를 보였다.
          ⇒ 교환권 숫자는 **'내 교환권' 줄 한 곳**이다. 이 줄의 셋(딜·이용권·쿠폰)은 반대로 여기가 그 한 곳이라
             아래 목록의 '내 이용권'·'쿠폰함' 줄은 숫자를 안 단다(`ShoppingGroup`). */}
      <Cell compact={inline} label="쿠폰" to="/my-coupons" value={coupon} />
    </div>
  )

  /* 🖥️ 띠 모드: 칸은 링크라 그 안에 버튼을 못 넣는다(중첩 상호작용) — 칸 **옆**에 둔다. */
  if (inline) return (
    <div className="flex items-center gap-4">
      {cells}
      {refundButton}
      {refundSheet}
    </div>
  )

  return (
    <div className="ur-content-medium lg:px-4">
      {cells}
      {/* 💸 무상(리워드) 딜은 사용은 자유지만 **현금 환급 제외**(약관)라, 0 이 아니면 한 줄로 알린다.
          돌려받을 딜이 있으면 그 줄 끝에서 바로 신청한다(2026-10-12 — 종전엔 숫자만 있고 누를 곳이 없었다). */}
      {showNote && (
        <div className="flex items-center gap-3 px-4 pt-2">
          <p className="flex-1 min-w-0 text-[12px] text-gray-500 dark:text-gray-400">
            {refundPending > 0 && refundable <= 0
              ? <>환급 {formatNumber(refundPending)}원 입금을 준비하고 있어요</>
              : freeBalance > 0 && refundable > 0
              ? <>무상 리워드 {formatNumber(freeBalance)}딜 포함 · 환급 가능 {formatNumber(refundable)}딜</>
              : refundable > 0
                ? <>현금으로 돌려받을 수 있는 딜이 {formatNumber(refundable)}딜 있어요</>
                : <>무상 리워드 {formatNumber(freeBalance)}딜 포함 (리워드 딜은 환급 대상이 아니에요)</>}
          </p>
          {refundButton}
        </div>
      )}
      {refundSheet}
    </div>
  )
}
