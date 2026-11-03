/**
 * 🎫 지갑 요약 카드 — 2026-10-14 대표 확정 **안 B "정돈된 목록 + 추천"**.
 *
 * 대표: *"이 이용권 페이지도 좀 개선해줄래? 디자인이 너무 별로야"* → 시안 셋 → *"이용권은 B"*.
 * 종전 머리글은 `38,500 원` 하나라 그 숫자가 **무엇의 합**인지 안 말했다. 이 카드는 왼쪽에 장수를 크게,
 * 오른쪽에 그 합계를 작게 — "2장, 합쳐서 38,500원" 으로 읽힌다.
 *
 * 🔢 장수는 **여기 한 곳**에서만 말한다(2026-10-08 대표 *"굳이 없어도 될 것 같아"* 의 불변식을 옮겼다 —
 *   그때는 탭 배지가 그 한 곳이었다). 아래 탭에 개수를 다시 붙이면 같은 숫자를 40px 안에서 두 번 말한다.
 */
import { formatNumber } from '@/utils/format'

export default function WalletSummaryCard({ total, t }: {
  total: number
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  // 🧾 2026-11-03 토스 참고(시안 I1) — 맨 위 요약에서 **목록 아래 합계 판**으로. 장수는 목록 판 머리가 말한다(한 곳).
  return (
    <div className="mt-3 rounded-2xl bg-surface px-5 py-4 flex items-center justify-between gap-3" data-testid="wallet-summary-card">
      <div className="min-w-0">
        <p className="text-[16px] font-semibold text-gray-900 dark:text-white">{t('voucher.walletTotalTitle', { defaultValue: '쓸 수 있는 이용권 합계' })}</p>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('voucher.walletTotalSub', { defaultValue: '산 가격 기준' })}</p>
      </div>
      <p className="shrink-0 text-[20px] font-bold tabular-nums text-gray-900 dark:text-white">
        {formatNumber(total)}{t('voucher.won', { defaultValue: '원' })}
      </p>
    </div>
  )
}
