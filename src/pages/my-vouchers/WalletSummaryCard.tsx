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

export default function WalletSummaryCard({ count, total, t }: {
  count: number
  total: number
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div className="ur-content-narrow px-4 lg:px-8 pt-4">
      <div className="-mx-4 px-4 py-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
            {t('voucher.walletEyebrow', { defaultValue: '쓸 수 있는 이용권' })}
          </p>
          <p className="mt-1 flex items-baseline gap-1 leading-none">
            <span className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-gray-900 dark:text-white">{formatNumber(count)}</span>
            <span className="text-[15px] font-bold text-gray-500 dark:text-gray-400">{t('voucher.heroCountUnit', { defaultValue: '장' })}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">{t('voucher.walletTotal', { defaultValue: '합계' })}</p>
          <p className="mt-1 text-[17px] font-bold tabular-nums text-gray-900 dark:text-white">
            {formatNumber(total)}{t('voucher.won', { defaultValue: '원' })}
          </p>
        </div>
      </div>
      <div className="mt-4" />
    </div>
  )
}
