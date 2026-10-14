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

const ICON = 20

export default function GuestPassPage() {
  const { t } = useTranslation()
  const { data: items = [] } = usePopularPasses()
  const picks = items.slice(0, 4)

  return (
    <div className="min-h-[100dvh] bg-warm pb-8">
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" noindex />
      <h1 className="px-4 pt-4 pb-2 text-[17px] font-bold tracking-tight text-gray-900 dark:text-white">
        {t('guest.pass.title', { defaultValue: '내 이용권' })}
      </h1>

      <section className="mx-4 mt-2 rounded-2xl bg-surface shadow-lift p-5" data-guest="pass">
        <h2 className="text-[24px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
          {t('guest.pass.headline1', { defaultValue: '동네 가게,' })}<br />
          {t('guest.pass.headline2', { defaultValue: '미리 사면 더 싸요' })}
        </h2>
        <div className="mt-5">
          <GuestBenefits
            items={[
              { icon: <CouponIcon size={ICON} />, title: t('guest.pass.b1', { defaultValue: '정가보다 할인가로' }), desc: t('guest.pass.b1d', { defaultValue: '가게마다 정해 둔 할인가로 미리 사 둬요' }) },
              { icon: <ScanIcon size={ICON} />, title: t('guest.pass.b2', { defaultValue: '매장에선 QR만 보여주면 끝' }), desc: t('guest.pass.b2d', { defaultValue: '산 이용권은 여기 지갑에 바로 들어와요' }) },
              { icon: <WonCoinIcon size={ICON} />, title: t('guest.pass.b3', { defaultValue: '안 쓰면 100% 자동환불' }), desc: t('guest.pass.b3d', { defaultValue: '못 가게 돼도 걱정 없어요' }) },
              { icon: <GiftBoxIcon size={ICON} />, title: t('guest.pass.b4', { defaultValue: '친구에게 선물하기' }), desc: t('guest.pass.b4d', { defaultValue: '산 이용권을 카톡으로 보낼 수 있어요' }) },
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
            className="mt-6 flex h-12 items-center justify-center rounded-xl bg-surface shadow-lift text-[15px] font-semibold text-gray-900 dark:text-white active:opacity-80"
          >
            {t('guest.pass.more', { defaultValue: '이용권 더 보기' })}
          </Link>
        </section>
      )}
    </div>
  )
}
