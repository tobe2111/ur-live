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
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

/** 💸 충전은 2026-07-18 에 종료됐다 — 딜의 "자세히" 는 내역이다. */
const DEAL_PATH = TOPUP_DISABLED ? '/my-deal-history' : '/points/charge'

function Cell({ label, to, value, className = '' }: {
  label: string
  to: string
  /** 칸을 특정 폭에서만 보이게 할 때(교환권은 폰에서 넷째 칸이 되면 숫자가 잘린다). */
  className?: string
  /** `undefined` = 아직 모름(안 그린다) · `null` = 조회 실패(`—`) · 숫자 = 값 */
  value: number | null | undefined
}) {
  return (
    <Link to={to} className={`flex-1 min-w-0 px-3 first:pl-4 last:pr-4 active:opacity-70 ${className}`}>
      <span className="flex items-center gap-1 text-[13px] font-semibold text-gray-500 dark:text-gray-400">
        <span className="truncate">{label}</span>
        <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
      </span>
      <span className="block mt-1 text-[24px] font-extrabold tabular-nums leading-tight tracking-[-0.03em] truncate">
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
    </Link>
  )
}

export default function MyStats({ voucher, gifticon, coupon }: { voucher?: number | null; gifticon?: number | null; coupon?: number | null }) {
  /** `undefined` 아직 · `null` 실패 · 숫자 값 */
  const [balance, setBalance] = useState<number | null | undefined>(undefined)
  const [freeBalance, setFreeBalance] = useState(0)

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

  return (
    <div className="ur-content-medium lg:px-4">
      {/* ➖ 칸 사이 세로 구분선 — `divide-x` 가 첫 칸 앞에는 안 긋는다(코레일톡과 같은 모양). */}
      <div className="flex items-start divide-x divide-rule py-1">
        <Cell label="내 딜" to={DEAL_PATH} value={balance} />
        <Cell label="이용권" to="/my-vouchers" value={voucher} />
        {/* 📱 교환권은 **폰에서 넷째 칸이 되면 칸이 너무 좁다**(390px ÷ 4 = 97px, 안쪽 여백 빼면 73px).
            폰에서는 아래 `내가 산 것` 목록의 '내 교환권' 줄이 같은 숫자를 들고 있으므로 잃는 게 없다. */}
        <Cell className="hidden lg:block" label="교환권" to="/my-gifticons" value={gifticon} />
        <Cell label="쿠폰" to="/my-coupons" value={coupon} />
      </div>
      {/* 💸 무상(리워드) 딜은 사용은 자유지만 **현금 환급 제외**(약관)라, 0 이 아니면 한 줄로 알린다. */}
      {balance != null && freeBalance > 0 && (
        <p className="px-4 pt-2 text-[12px] text-gray-500 dark:text-gray-400">
          무상 리워드 {formatNumber(freeBalance)}딜 포함 · 환급 가능 {formatNumber(Math.max(0, balance - freeBalance))}딜
        </p>
      )}
    </div>
  )
}
