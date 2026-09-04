/**
 * 💰 2026-08-31: 이용권 딜 결제 — 보조 결제 버튼과 그 노출 조건.
 *
 * 기본 결제수단은 그대로 **카드**다. 대다수 소비자는 딜 잔액이 0 이고, 살 수 없는 버튼을
 * 띄우면 "딜이 부족합니다"를 눌러 보고서야 알게 된다 — 그래서 **잔액이 충분할 때만** 낸다.
 *
 * 이중 게이트: 클라이언트 `VOUCHER_DEAL_PAYMENT_ENABLED` + 서버
 * `platform_settings.voucher_deal_payment_enabled`. 플래그가 꺼져 있으면 훅은 돌아도
 * 버튼이 안 뜨고, 갈렸을 때는 서버가 `DEAL_PAYMENT_NOT_ALLOWED` 로 막는다.
 *
 * 교환권(`deal_only=1`)은 원래 딜 전용이라 이 버튼과 무관하다(그 흐름은 항상 딜).
 */
import { VOUCHER_DEAL_PAYMENT_ENABLED } from '@/shared/feature-flags'
import { useBalance } from '@/hooks/queries/useBalance'
import { resolveProductFlow } from '@/shared/product-flow'
import { formatNumber } from '@/utils/format'

export function useCanPayWithDeal(opts: { isLoggedIn: boolean; detail: unknown; total: number }) {
  const { data: dealBalance = 0, isError } = useBalance()
  const canPayWithDeal =
    VOUCHER_DEAL_PAYMENT_ENABLED &&
    opts.isLoggedIn &&
    !isError &&
    resolveProductFlow((opts.detail || {}) as never).flow === 'group_buy_toss' &&
    opts.total > 0 &&
    dealBalance >= opts.total
  return { canPayWithDeal, dealBalance }
}

export default function DealPayButton({ show, joining, dealBalance, onPay }: {
  show: boolean; joining: boolean; dealBalance: number; onPay: () => void
}) {
  if (!show) return null
  return (
    <button
      onClick={onPay}
      disabled={joining}
      aria-label={`보유한 딜 ${formatNumber(dealBalance)}딜로 결제하기`}
      style={{ width: '100%', height: 42, marginTop: 8, borderRadius: 12, background: 'transparent', border: '1.5px solid var(--gbd-cta-bg)', color: 'var(--gbd-cta-bg)', fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', cursor: joining ? 'default' : 'pointer' }}
    >
      {joining ? '처리 중…' : `딜로 결제 (보유 ${formatNumber(dealBalance)}딜)`}
    </button>
  )
}
