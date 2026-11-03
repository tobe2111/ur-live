/**
 * 🚪 탈퇴 전에 먼저 정리할 것 (2026-10-19 대표 결재 *"권장안대로 해줘"* — `docs/decisions/2026-10-19-account-deletion-assets.md` 안 2)
 *
 * 숫자는 **서버가 센다**(`GET /api/account/delete-blockers` → `countAccountDeleteBlockers`). 같은 함수가 탈퇴 요청도
 * 막으므로 화면과 서버가 다른 말을 할 수 없다 — 화면이 이용권을 따로 세면 두 숫자가 갈린다(2026-10-07 지갑 사고).
 *
 * 막고 끝내지 않는다 — 항목마다 정리하러 가는 길을 붙인다:
 *   안 쓴 이용권 → 내 이용권 · 환급할 충전 딜 → 같은 화면에서 환급 시트 · 주인인 가게 → 가게 관리(가게 탈퇴).
 */
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { TicketStubIcon, WalletIcon, StoreIcon, ClockIcon, AlertIcon } from '@/components/icons/urdeal-icons'
import { formatNumber } from '@/utils/format'
import { sellerEntryPath } from '@/lib/seller-deep-link'

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-03 15차 ⑦ — '먼저 정리' 할 것들이 위에서부터 차례로 나오고, 각 줄의 빨간 그림이 톡 켜진다(무엇이 남았는지 하나씩 읽히게).
injectMotionCss('ur-m-delblock', `@keyframes ur-db-up { from { opacity: 0; transform: translateY(10px); } }@keyframes ur-db-pop { 0% { transform: scale(.5); } 60% { transform: scale(1.15); } 100% { transform: none; } }.ur-db-rows > * { animation: ur-db-up .35s cubic-bezier(.2,.9,.3,1) backwards; }.ur-db-rows > *:nth-child(2) { animation-delay: 90ms; }.ur-db-rows > *:nth-child(3) { animation-delay: 180ms; }.ur-db-rows > *:nth-child(4) { animation-delay: 270ms; }.ur-db-rows > * > span:first-child { animation: ur-db-pop .35s cubic-bezier(.3,1.3,.5,1) .15s backwards; }@media (prefers-reduced-motion: reduce){.ur-db-rows > *,.ur-db-rows > * > span:first-child{animation:none!important}}`)
const RefundSheet = lazy(() => import('@/pages/user-profile/RefundSheet'))

export interface AccountDeleteBlockers {
  unused_vouchers: number
  refundable_deal: number
  deal_refund_pending: boolean
  owned_stores: number
}

/** 가게 탈퇴가 있는 화면(가게 관리 맨 아래 `SellerWithdrawSection`). 마이 시트로 열린다. */
export const STORE_WITHDRAW_PATH = '/seller/stores'

function Row({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-4 border-b border-rule last:border-b-0">
      <span className="w-5 h-5 mt-1 shrink-0 text-tone-bad">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}

const LINK_CLS = 'inline-flex text-[13px] font-medium text-brand-text'

export default function DeleteBlockers({
  blockers,
  failed,
  onRetry,
  onRefunded,
}: {
  blockers: AccountDeleteBlockers | null
  failed: boolean
  onRetry: () => void
  onRefunded: () => void
}) {
  const { t } = useTranslation()
  const [refundOpen, setRefundOpen] = useState(false)

  if (failed) {
    return (
      <section className="rounded-2xl p-5" data-testid="delete-blockers-failed">
        <div className="flex items-start gap-3">
          <AlertIcon className="w-5 h-5 mt-1 shrink-0 text-tone-bad" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-gray-900 dark:text-white">
              {t('accountDeleteWarning.blockersFailed', { defaultValue: '탈퇴할 수 있는지 확인하지 못했어요' })}
            </p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('accountDeleteWarning.blockersFailedSub', { defaultValue: '남은 이용권·딜·가게를 확인한 뒤에 탈퇴할 수 있어요.' })}
            </p>
            <button type="button" onClick={onRetry} className={`mt-2 ${LINK_CLS}`}>
              {t('accountDeleteWarning.retry', { defaultValue: '다시 확인' })}
            </button>
          </div>
        </div>
      </section>
    )
  }
  if (!blockers) return null

  const rows: ReactNode[] = []
  if (blockers.unused_vouchers > 0) {
    rows.push(
      <Row
        key="vouchers"
        icon={<TicketStubIcon className="w-5 h-5" />}
        title={t('accountDeleteWarning.blockVouchers', { defaultValue: '안 쓴 이용권 {{count}}장', count: blockers.unused_vouchers })}
        body={t('accountDeleteWarning.blockVouchersBody', { defaultValue: '탈퇴하면 매장에서 쓸 수 없어요. 먼저 쓰거나 환불을 요청해 주세요.' })}
        action={<Link to="/my-vouchers" className={LINK_CLS}>{t('accountDeleteWarning.goVouchers', { defaultValue: '내 이용권 보기' })}</Link>}
      />,
    )
  }
  if (blockers.refundable_deal > 0) {
    rows.push(
      <Row
        key="deal"
        icon={<WalletIcon className="w-5 h-5" />}
        title={t('accountDeleteWarning.blockDeal', { defaultValue: '환급할 수 있는 충전 딜 {{amount}}딜', amount: formatNumber(blockers.refundable_deal) })}
        body={t('accountDeleteWarning.blockDealBody', { defaultValue: '충전한 딜은 탈퇴하면 사라져요. 먼저 환급을 신청해 주세요.' })}
        action={
          <button type="button" onClick={() => setRefundOpen(true)} className={LINK_CLS}>
            {t('accountDeleteWarning.goRefund', { defaultValue: '환급 신청' })}
          </button>
        }
      />,
    )
  }
  if (blockers.deal_refund_pending) {
    rows.push(
      <Row
        key="pending"
        icon={<ClockIcon className="w-5 h-5" />}
        title={t('accountDeleteWarning.blockPending', { defaultValue: '딜 환급을 처리하고 있어요' })}
        body={t('accountDeleteWarning.blockPendingBody', { defaultValue: '입금이 끝난 뒤에 탈퇴할 수 있어요.' })}
      />,
    )
  }
  if (blockers.owned_stores > 0) {
    rows.push(
      <Row
        key="store"
        icon={<StoreIcon className="w-5 h-5" />}
        title={t('accountDeleteWarning.blockStore', { defaultValue: '운영 중인 가게 {{count}}곳', count: blockers.owned_stores })}
        body={t('accountDeleteWarning.blockStoreBody', { defaultValue: '회원 탈퇴는 가게를 닫지 않아요. 가게 탈퇴를 먼저 해 주세요.' })}
        action={<Link to={sellerEntryPath(STORE_WITHDRAW_PATH)} className={LINK_CLS}>{t('accountDeleteWarning.goStore', { defaultValue: '가게 관리로 가기' })}</Link>}
      />,
    )
  }
  if (rows.length === 0) return null

  return (
    <section className="rounded-2xl px-5 pt-5 pb-1" data-testid="delete-blockers">
      <h3 className="text-[15px] font-medium text-gray-900 dark:text-white">
        {t('accountDeleteWarning.blockersTitle', { defaultValue: '먼저 정리해 주세요' })}
      </h3>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        {t('accountDeleteWarning.blockersSub', { defaultValue: '아래를 정리해야 탈퇴할 수 있어요' })}
      </p>
      <div className="mt-1 ur-db-rows">{rows}</div>
      {refundOpen && (
        <Suspense fallback={null}>
          <RefundSheet onClose={() => setRefundOpen(false)} onDone={onRefunded} />
        </Suspense>
      )}
    </section>
  )
}
