/**
 * 🎟️ 로그인 전 **이용권 탭**(`/my-vouchers`) — 2026-10-12 대표 확정 시안(최종안 ①).
 *
 * 종전엔 탭을 누르면 곧장 로그인 화면이었다. 이용권이 무엇인지 모르는 사람에게 "먼저 로그인" 은
 * 물어볼 기회도 없이 문을 닫는 것이다. 그래서 탭은 열고, **개인 데이터 자리만** 카카오 카드로 둔다:
 *   ① 무엇이 좋은가(혜택 넷) + 카카오 버튼 — 로그인하면 이 탭으로 돌아와 내 지갑이 뜬다
 *   ② 지금 많이 사는 이용권 — 홈 피드와 같은 캐시(`usePopularPasses`), 같은 카드(`GroupBuyFeedCard`)
 *
 * 혜택 문구는 라이브에서 실제로 되는 것만이다(`GuestBenefits` 머리말).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import { CouponIcon, ScanIcon, WonCoinIcon, GiftBoxIcon } from '@/components/icons/urdeal-icons'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import { HOME_CARD_IMG_WIDTH_BASE } from '@/shared/home-card-image'
import GuestKakaoButton from './GuestKakaoButton'
import GuestBenefits from './GuestBenefits'
import { usePopularPasses } from './usePopularPasses'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'

const ICON = 20

export default function GuestPassPage() {
  const { t } = useTranslation()
  const { data: items = [] } = usePopularPasses()
  const picks = items.slice(0, 4)

  return (
    <div className={GUEST_CLS.root}>
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.pass.title', { defaultValue: GUEST_COPY.pass.title })}
      </h1>

      <section className={GUEST_CLS.card} data-guest="pass">
        <h2 className={GUEST_CLS.headline}>
          {t('guest.pass.headline1', { defaultValue: GUEST_COPY.pass.headline1 })}<br />
          {t('guest.pass.headline2', { defaultValue: GUEST_COPY.pass.headline2 })}
        </h2>
        <div className="mt-5">
          <GuestBenefits
            items={[
              { icon: <CouponIcon size={ICON} />, title: t('guest.pass.b1', { defaultValue: GUEST_COPY.pass.benefits[0][0] }), desc: t('guest.pass.b1d', { defaultValue: GUEST_COPY.pass.benefits[0][1] }) },
              { icon: <ScanIcon size={ICON} />, title: t('guest.pass.b2', { defaultValue: GUEST_COPY.pass.benefits[1][0] }), desc: t('guest.pass.b2d', { defaultValue: GUEST_COPY.pass.benefits[1][1] }) },
              { icon: <WonCoinIcon size={ICON} />, title: t('guest.pass.b3', { defaultValue: GUEST_COPY.pass.benefits[2][0] }), desc: t('guest.pass.b3d', { defaultValue: GUEST_COPY.pass.benefits[2][1] }) },
              { icon: <GiftBoxIcon size={ICON} />, title: t('guest.pass.b4', { defaultValue: GUEST_COPY.pass.benefits[3][0] }), desc: t('guest.pass.b4d', { defaultValue: GUEST_COPY.pass.benefits[3][1] }) },
            ]}
          />
        </div>
        <div className="mt-6">
          <GuestKakaoButton returnPath="/my-vouchers" />
        </div>
      </section>

      {picks.length > 0 && (
        <section className="mt-8 px-4">
          <h2 className="mb-3 text-[17px] font-bold text-gray-900 dark:text-white">
            {t('guest.pass.popular', { defaultValue: '지금 많이 사는 이용권' })}
          </h2>
          <div className={`grid grid-cols-2 ${DEAL_GRID_GAP}`}>
            {picks.map((p) => (
              <GroupBuyFeedCard key={p.id} p={p} imgWidth={HOME_CARD_IMG_WIDTH_BASE} hideWishlist />
            ))}
          </div>
          <Link
            to="/"
            className="mt-6 flex h-12 items-center justify-center rounded-xl bg-surface shadow-lift text-[15px] font-medium text-gray-900 dark:text-white active:opacity-80"
          >
            {t('guest.pass.more', { defaultValue: '이용권 더 보기' })}
          </Link>
        </section>
      )}
    </div>
  )
}
