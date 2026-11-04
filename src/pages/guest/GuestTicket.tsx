/**
 * 🎫 이용권 탭 미리보기 — "산 이용권이 지갑에 이렇게 들어온다".
 * 2026-11-04 대표 *"이용권 티켓 이제 저렇게 안생겼잖아"* · *"가라로 매장 이용권 모습을 보여줘야 하는거 아니야?"*
 *   → 지금 지갑 줄(`my-vouchers/WalletRow`) 모양의 **예시 두 장**(실제 가게·상품 아님).
 * 서버 첫 화면(`worker/utils/guest-first-screen.ts` ticket())이 같은 모양을 그린다 — 고치면 둘 다.
 */
import { useTranslation } from '@/lib/i18n-lite'
import { GUEST_CLS, GUEST_COPY, GUEST_CLOCK } from '@/shared/guest-page'

export default function GuestTicket() {
  const { t } = useTranslation()
  const c = GUEST_COPY.pass
  return (
    <div className={GUEST_CLS.ticket} aria-hidden="true">
      {c.wallet.map((w, i) => (
        <div key={i} className={GUEST_CLS.walletRow}>
          <span className={GUEST_CLS.walletThumb}><img src={w.img} alt="" width={56} height={56} decoding="async" className={GUEST_CLS.walletImg} /></span>
          <span className={GUEST_CLS.walletText}>
            <span className={GUEST_CLS.walletStore}>{t(`guest.pass.w${i + 1}store`, { defaultValue: w.store })}</span>
            <span className={GUEST_CLS.walletName}>{t(`guest.pass.w${i + 1}name`, { defaultValue: w.name })}</span>
            <span className={GUEST_CLS.walletDue}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={GUEST_CLS.walletClock}><circle cx={GUEST_CLOCK.circle.cx} cy={GUEST_CLOCK.circle.cy} r={GUEST_CLOCK.circle.r} /><path d={GUEST_CLOCK.path} /></svg>
              {w.due}
            </span>
          </span>
          <span className={GUEST_CLS.walletUse}>{t('voucher.use', { defaultValue: c.use })}</span>
        </div>
      ))}
    </div>
  )
}
