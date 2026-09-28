/**
 * 🪙 마이의 딜 잔액 — **교환권 탭과 같은 카드를 쓴다** (2026-05-01 TD-018 분할 · 2026-09-28 통합)
 *
 * ## 왜 고쳤나 — 같은 숫자를 두 화면이 반대 스타일로 보여 주고 있었다
 * 2026-09-02 에 대표가 **교환권 탭의 잔액 블록**을 *"검정 슬래브 → 흰 카드 + 큰 잉크 숫자"* 로
 * 확정했는데(CLAUDE.md audit log), **마이만 안 따라왔다.** 그래서 마이에서 이 카드가 화면의
 * 유일한 검정 덩어리였고, 하필 손님 쪽(판매 구역 아래)에 있었다. 표면 규칙 ①(카드는 흰 면 +
 * `shadow-lift`)·⑥(색깔 정보상자 0)에도 어긋났다.
 *
 * ⇒ 스타일을 베껴 오지 않고 **같은 부품을 쓴다**(`vouchers/DealBalanceCard`). 베끼면 다음 변경에서
 *   또 한쪽만 따라간다 — 이 레포가 반복해 당한 클래스이고, 이번 어긋남 자체가 그 증거다.
 *
 * ## 이 파일에 남는 일 — **데이터**다
 * 부품은 표시만 한다. 잔액 조회·실패 재시도·무상 리워드 계산은 여기 남는다:
 *   · `pointsBalanceChanged` 이벤트로 재조회(딜을 쓰고 돌아왔을 때 즉시 맞는다)
 *   · 🛡️ 실패를 **0딜로 위장하지 않는다**(2026-07-02) — `error` 를 부품에 넘겨 `—` + 다시 불러오기
 *   · 💸 무상(리워드) 딜은 사용은 자유지만 **현금 환급 제외**(약관)라 0 이 아니면 한 줄로 알린다
 *
 * ⚠️ 충전 버튼은 여기서 사라졌다 — 충전은 2026-07-18 에 종료됐고(`TOPUP_DISABLED`) 부품의
 *   아래층이 이미 `딜 모으기 / 이용내역` 둘을 같은 무게로 준다. 되살리지 말 것.
 */
import { useEffect, useState } from 'react'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'
import DealBalanceCard from '@/pages/vouchers/DealBalanceCard'

export default function TeamPointsCard() {
  const [balance, setBalance] = useState<number | null>(null)
  // 💸 2026-07-05 버킷: 무상(리워드) 딜 — 사용은 자유, 현금 환급 제외 (약관). 0 이면 표기 생략.
  const [freeBalance, setFreeBalance] = useState(0)
  // 🛡️ 2026-07-02: 에러 구분 — 실패를 "0딜"로 위장하지 않음.
  const [error, setError] = useState(false)

  const fetchBalance = () => {
    import('@/lib/api').then(({ default: api }) => {
      setError(false)
      api.get('/api/points/balance')
        .then(r => {
          if (r.data.success) {
            setBalance(Number(r.data.data.balance ?? 0))
            setFreeBalance(Math.max(0, Number(r.data.data.free_balance ?? 0)))
          } else setError(true)
        })
        .catch(() => { setError(true) })
    })
  }

  useEffect(() => {
    fetchBalance()
    const handler = () => fetchBalance()
    window.addEventListener('pointsBalanceChanged', handler)
    return () => window.removeEventListener('pointsBalanceChanged', handler)
  }, [])

  const note = !error && balance != null && freeBalance > 0
    ? `무상 리워드 ${formatNumber(freeBalance)}딜 포함 · 환급 가능 ${formatNumber(Math.max(0, balance - freeBalance))}딜`
    : undefined

  return (
    <div className="ur-content-medium px-4 lg:px-8 py-3">
      <DealBalanceCard
        balance={balance}
        loggedIn={!!getUserIdSync()}
        note={note}
        error={error}
        onRetry={fetchBalance}
      />
    </div>
  )
}
