/**
 * 회원 탈퇴 안내 페이지
 *
 * 🩸 2026-10-19 (대표 *"모두 다 가장 이상적으로 개선해줘 · 탈퇴하면 어떻게 각각 하는게 좋을까?"*):
 *   이 화면이 **서버가 실제로 하는 일과 다른 말**을 하고 있었다.
 *     - *"30일 내 복원 시 모든 혜택이 회복됩니다"* — 거짓. 탈퇴 순간 딜 잔액은 0 으로 소멸하고
 *       (`zeroOutUserPoints`), 쿠폰·찜·단골·알림 행은 **삭제**된다(`delete-account.service.ts`).
 *       복원(`restoreUser`)은 users 한 행만 되살린다.
 *     - 우리에게 없는 것(장바구니·최근 본 상품·멤버십 등급·1:1 상담·결제 수단)을 "삭제된다" 고 나열했다.
 *     - 정작 사람이 잃는 **돈**(남은 딜 · 안 쓴 이용권)은 한 줄도 없었다.
 *   ⇒ 문구를 실제 처리 순서에 맞추고, 그 사람의 **실제 숫자**(딜 잔액 · 안 쓴 이용권 장수)를 보여 준다.
 *   🔑 숫자는 마이와 **같은 훅·같은 술어**로 센다(`useBalance` · `useMyVouchers` + `isUsableWalletItem`) —
 *      두 화면이 다른 장수를 말하면 그건 에러가 아니라 거짓말이다(2026-10-07 지갑 사고).
 *   ⚠️ 탈퇴 정책 자체(딜 소멸·이용권 처리·가게 처리)는 머니/삭제 경로라 **이 화면이 바꾸지 않는다** —
 *      `docs/decisions/2026-10-19-account-deletion-assets.md` 에 대표 결재로 올렸다. 화면은 지금의 사실만 말한다.
 *
 * 하단 고정 버튼 바를 걷었다 — 이 경로엔 하단 탭이 떠 있어 그 위에 겹쳤고, 탈퇴는 **다 읽은 뒤** 누르는 버튼이라
 * 본문 끝에 있는 것이 맞다.
 */
import { useState, useEffect } from 'react'
import { WarnIcon, OkIcon, WalletIcon, TicketStubIcon, ClockIcon } from '@/components/icons/urdeal-icons'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation, Trans } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import { Loader2 } from 'lucide-react'
import { getUserId, logout as authLogout } from '@/utils/auth'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { loginPathFromHere } from '@/utils/login-return'
import { useBalance } from '@/hooks/queries/useBalance'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { isUsableWalletItem, isStoreVoucher } from '@/shared/voucher-wallet'
import { formatNumber } from '@/utils/format'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'

/** 탈퇴하면 **바로** 지워지는 것 — `delete-account.service.ts` 의 DELETE/소멸 대상과 같아야 한다(가드가 대조). */
export const GONE_ON_DELETE = ['deal', 'coupons', 'wishlist', 'follows', 'notifications'] as const

const CARD = 'rounded-2xl bg-surface shadow-lift dark:shadow-none p-5'

export default function AccountDeleteWarningPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  // 💸 그 사람이 실제로 잃는 것. fresh — 탈퇴 직전 화면이라 1분 묵은 잔액을 보여 주면 안 된다.
  const balanceQ = useBalance({ fresh: true })
  const vouchersQ = useMyVouchers()
  //   ⚠️ 서버 값을 **받기 전**엔 숫자를 말하지 않는다 — 캐시 seed(없으면 0)를 그대로 쓰면 딜 보유자에게
  //   "소멸될 딜이 없어요" 라고 말한 채 탈퇴 버튼이 열린다. 받기 전 = 확인 중, 실패 = 모름.
  const dealKnown = balanceQ.isFetchedAfterMount && !balanceQ.isError
  const deal = balanceQ.isError ? null : dealKnown ? Math.max(0, Number(balanceQ.data ?? 0)) : null
  const dealChecking = !balanceQ.isError && !dealKnown
  const unusedVouchers = vouchersQ.isError
    ? null
    : (vouchersQ.data ?? []).filter((v) => isUsableWalletItem(v) && isStoreVoucher(v)).length

  useEffect(() => {
    const checkAuth = async () => {
      const userId = await getUserId()
      if (!userId) {
        toast.info(t('accountDeleteWarning.loginRequired'))
        navigate(loginPathFromHere())
      }
    }
    checkAuth()
  }, [navigate])

  // 잃는 딜을 보여 주기 전에는 탈퇴를 열지 않는다(조회 실패는 화면이 따로 경고하므로 막지 않는다).
  const canProceed = agreed && !dealChecking && confirmText === t('accountDeleteWarning.confirmText')

  const handleProceedToDelete = async () => {
    if (!canProceed) {
      toast.error(t('accountDeleteWarning.needAllChecks'))
      return
    }

    const finalConfirm = await confirmDialog({
      message: t('accountDeleteWarning.confirmDialog'),
      danger: true,
    })
    if (!finalConfirm) return

    setIsLoading(true)
    try {
      const userId = await getUserId()
      if (!userId) throw new Error(t('accountDeleteWarning.userIdNotFound'))

      const response = await api.delete('/api/account/delete')
      if (!response.data.success) throw new Error('delete_failed')

      await authLogout()
      navigate('/account/deleted', { replace: true })
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } }
      if (import.meta.env.DEV) console.error('[Account Delete] 탈퇴 실패:', error)
      // 🛡️ 서버 원문(`detail` — DB 에러 문장)은 손님에게 보여 주지 않는다(CLAUDE.md safe-error 룰).
      toast.error(err.response?.status === 401 ? t('accountDeleteWarning.authExpired') : t('accountDeleteWarning.deleteError'))
      if (err.response?.status === 401) {
        // login-return-ok: 탈퇴 **직후**다 — 돌아갈 계정이 없다.
        setTimeout(() => navigate('/login'), 1000)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={SUB_PAGE_CLS}>
      <SEO title={t('accountDeleteWarning.seoTitle')} description={t('accountDeleteWarning.seoDesc')} url="/account/delete-warning" noindex />
      <SubPageHeader title={t('accountDeleteWarning.title')} backLabel={t('accountDeleteWarning.back')} />

      <main className="ur-content-narrow px-4 pt-2 pb-safe-nav flex flex-col gap-3">
        <div className="px-1 pt-2 pb-3">
          <h2 className="text-[24px] font-bold text-gray-900 dark:text-white tracking-[-0.01em]">
            {t('accountDeleteWarning.headline', { defaultValue: '탈퇴하기 전에 확인해 주세요' })}
          </h2>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('accountDeleteWarning.headlineSub', { defaultValue: '30일 안에 같은 카카오 계정으로 다시 로그인하면 계정을 되살릴 수 있어요. 다만 바로 사라지는 것은 되살아나지 않아요.' })}
          </p>
        </div>

        {/* ① 바로 사라지는 것 — 되살려도 안 돌아온다 */}
        <section className={CARD} data-testid="delete-gone">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
            {t('accountDeleteWarning.goneTitle', { defaultValue: '탈퇴하면 바로 사라져요' })}
          </h3>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            {t('accountDeleteWarning.goneSub', { defaultValue: '계정을 되살려도 돌아오지 않아요' })}
          </p>
          <div className="mt-4 flex items-start gap-3">
            <WalletIcon className="w-5 h-5 mt-1 shrink-0 text-gray-900 dark:text-white" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {deal == null
                  ? t('accountDeleteWarning.goneDealUnknown', { defaultValue: '남은 딜' })
                  : t('accountDeleteWarning.goneDeal', { defaultValue: '남은 딜 {{amount}}딜', amount: formatNumber(deal) })}
              </p>
              <p className={`mt-1 text-[13px] leading-relaxed ${deal ? 'text-tone-bad' : 'text-gray-500 dark:text-gray-400'}`}>
                {dealChecking
                  ? t('accountDeleteWarning.dealChecking', { defaultValue: '남은 딜을 확인하는 중이에요…' })
                  : deal == null
                  ? t('accountDeleteWarning.dealLoadFailed', { defaultValue: '잔액을 불러오지 못했어요. 마이에서 확인한 뒤 탈퇴해 주세요.' })
                  : deal > 0
                    ? t('accountDeleteWarning.goneDealHint', { defaultValue: '남은 딜은 탈퇴 즉시 소멸돼요. 먼저 교환권을 사는 데 쓰세요.' })
                    : t('accountDeleteWarning.goneDealZero', { defaultValue: '소멸될 딜이 없어요.' })}
              </p>
            </div>
          </div>
          <p className="mt-4 pt-4 border-t border-rule text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('accountDeleteWarning.goneOthers', { defaultValue: '쿠폰 · 찜한 상품 · 단골 가게 · 알림도 함께 지워져요.' })}
          </p>
        </section>

        {/* ② 30일 동안 보관되는 것 */}
        <section className={CARD} data-testid="delete-kept">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
            {t('accountDeleteWarning.keptTitle', { defaultValue: '30일 동안 보관돼요' })}
          </h3>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            {t('accountDeleteWarning.keptSub', { defaultValue: '30일 안에 같은 카카오 계정으로 로그인하면 돌아와요' })}
          </p>
          <div className="mt-4 flex items-start gap-3">
            <TicketStubIcon className="w-5 h-5 mt-1 shrink-0 text-gray-900 dark:text-white" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {unusedVouchers == null
                  ? t('accountDeleteWarning.keptVouchersUnknown', { defaultValue: '안 쓴 이용권' })
                  : t('accountDeleteWarning.keptVouchers', { defaultValue: '안 쓴 이용권 {{count}}장', count: unusedVouchers })}
              </p>
              <p className={`mt-1 text-[13px] leading-relaxed ${unusedVouchers ? 'text-tone-bad' : 'text-gray-500 dark:text-gray-400'}`}>
                {unusedVouchers
                  ? t('accountDeleteWarning.keptVouchersHint', { defaultValue: '탈퇴한 동안은 매장에서 쓸 수 없어요. 먼저 쓰거나 환불을 요청해 주세요.' })
                  : t('accountDeleteWarning.keptVouchersZero', { defaultValue: '쓰지 않은 이용권이 없어요.' })}
              </p>
              {!!unusedVouchers && (
                <Link to="/my-vouchers" className="mt-2 inline-flex text-[13px] font-semibold text-brand-text">
                  {t('accountDeleteWarning.goVouchers', { defaultValue: '내 이용권 보기' })}
                </Link>
              )}
            </div>
          </div>
          <p className="mt-4 pt-4 border-t border-rule text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('accountDeleteWarning.keptOthers', { defaultValue: '구매·이용 기록과 작성한 리뷰도 그대로 있어요. 리뷰의 이름은 탈퇴회원으로 바뀌어요.' })}
          </p>
        </section>

        {/* ③ 30일 뒤 · 알아 둘 것 */}
        <section className={CARD}>
          <div className="flex items-start gap-3">
            <ClockIcon className="w-5 h-5 mt-1 shrink-0 text-gray-900 dark:text-white" />
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {t('accountDeleteWarning.afterTitle', { defaultValue: '30일이 지나면' })}
              </h3>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('accountDeleteWarning.afterBody', { defaultValue: '계정을 되살릴 수 없어요. 거래 기록은 법에 따라 이름과 연락처 없이 보관돼요.' })}
              </p>
            </div>
          </div>
          <ul className="mt-4 pt-4 border-t border-rule flex flex-col gap-2 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            <li>{t('accountDeleteWarning.noteRefund', { defaultValue: '진행 중인 환불이 있다면 끝난 뒤에 탈퇴해 주세요.' })}</li>
            <li>{t('accountDeleteWarning.noteStore', { defaultValue: '가게를 운영 중이라면 가게 탈퇴를 먼저 해 주세요. 회원 탈퇴는 가게를 닫지 않아요.' })}</li>
          </ul>
        </section>

        {/* 동의 + 최종 확인 */}
        <section className={CARD}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 mt-1 rounded accent-brand shrink-0"
            />
            <span className="text-[15px] text-gray-900 dark:text-white leading-relaxed">
              {deal
                ? t('accountDeleteWarning.agreeDeal', { defaultValue: '위 내용과 딜 {{amount}}딜이 소멸되는 것을 확인했어요', amount: formatNumber(deal) })
                : t('accountDeleteWarning.agree', { defaultValue: '위 내용을 확인했어요' })}
            </span>
          </label>

          <p className="mt-5 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            <Trans
              i18nKey="accountDeleteWarning.confirmInputLabel"
              components={[<strong key="0" className="text-gray-900 dark:text-white" />]}
            />
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('accountDeleteWarning.confirmPlaceholder')}
            className="mt-2 w-full h-12 px-4 rounded-xl bg-warm border border-rule-strong text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand"
          />
          {confirmText && confirmText !== t('accountDeleteWarning.confirmText') && (
            <p className="text-[13px] text-tone-bad mt-2 flex items-center gap-1">
              <WarnIcon className="w-4 h-4" />
              {t('accountDeleteWarning.confirmMismatch')}
            </p>
          )}
          {confirmText === t('accountDeleteWarning.confirmText') && (
            <p className="text-[13px] text-tone-ok mt-2 flex items-center gap-1">
              <OkIcon className="w-4 h-4" />
              {t('accountDeleteWarning.confirmOk', { defaultValue: '확인됐어요' })}
            </p>
          )}
        </section>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            to="/user/profile"
            className="w-full h-12 flex items-center justify-center rounded-2xl bg-brand text-white text-[15px] font-semibold"
          >
            {t('accountDeleteWarning.cancel')}
          </Link>
          <button
            type="button"
            onClick={handleProceedToDelete}
            disabled={!canProceed || isLoading}
            className={`w-full h-12 rounded-2xl text-[15px] font-semibold transition-colors ${
              canProceed && !isLoading
                ? 'text-tone-bad active:bg-wash'
                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('accountDeleteWarning.deleting')}
              </span>
            ) : (
              t('accountDeleteWarning.submit')
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
