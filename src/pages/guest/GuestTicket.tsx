/**
 * 🎫 이용권 탭 미리보기 — "산 이용권이 지갑에 이렇게 들어온다"(2026-11-03).
 * 실제 상품을 쓰지 않는 **고정 그림**이다 — 서버 첫 화면이 같은 모양을 데이터 없이 그릴 수 있어야
 * 마운트 때 화면이 안 바뀐다. QR 무늬는 `GUEST_QR_PATH`(서버와 같은 path).
 */
import { useTranslation } from '@/lib/i18n-lite'
import { GUEST_CLS, GUEST_COPY, GUEST_QR_PATH } from '@/shared/guest-page'

export default function GuestTicket() {
  const { t } = useTranslation()
  const c = GUEST_COPY.pass.ticket
  return (
    <div className={GUEST_CLS.ticket} aria-hidden="true">
      <div className={GUEST_CLS.ticketBand}>
        <span className={GUEST_CLS.ticketBandTitle}>{t('guest.pass.ticketBand', { defaultValue: c.band })}</span>
        <span className={GUEST_CLS.ticketBandState}>{t('guest.pass.ticketState', { defaultValue: c.state })}</span>
      </div>
      <div className={GUEST_CLS.ticketBody}>
        <span className={GUEST_CLS.ticketQr}>
          <svg viewBox="0 0 21 21" width="100%" height="100%" shapeRendering="crispEdges"><path fill="currentColor" d={GUEST_QR_PATH} /></svg>
        </span>
        <span className={GUEST_CLS.ticketText}>
          <span className={GUEST_CLS.ticketLine1}>{t('guest.pass.ticketLine1', { defaultValue: c.line1 })}</span>
          <span className={GUEST_CLS.ticketLine2}>{t('guest.pass.ticketLine2', { defaultValue: c.line2 })}</span>
        </span>
      </div>
    </div>
  )
}
