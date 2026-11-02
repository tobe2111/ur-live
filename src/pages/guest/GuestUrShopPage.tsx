/**
 * 🛍️ 로그인 전 **유어샵 탭**(`/u/me`) — 2026-10-12 대표 확정 시안(최종안 ②).
 *
 * 대표: *"유어샵은 인플루언서를 위한 페이지 아니야? 매장들의 이용권들 모아서 하나의 자신들 페이지로
 * SNS 링크로 담아넣으려는거잖아."* — 그래서 이 화면의 주인공은 **SNS 를 하는 사람**이고,
 * 사장님은 아래 작은 카드 하나다(사장님에겐 `/partners` 가 따로 있다).
 *
 * 예시 진열대는 지어내지 않는다 — 진열되는 세 줄은 **지금 실제로 파는 이용권**(홈 피드 인기순 캐시)이다.
 * 주인 이름만 마스코트 "유달"이고 `예시` 표시를 단다.
 *
 * ⚠️ 혜택에 "팔리면 소개비" 를 쓰지 말 것 — 담기(소개) 커미션은 꺼져 있다(`affiliate_program_enabled`).
 *   지금 실제로 돈이 되는 길은 매장이 주는 **협업 코드**다(`redeemInfluencerCode` — 매장이 정한 몫).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { ChevronRight } from 'lucide-react'
import SEO from '@/components/SEO'
import Udal from '@/components/mascot/Udal'
import { UrShopIcon, TicketStubIcon, WonCoinIcon, StoreIcon } from '@/components/icons/urdeal-icons'
import DealRow from '@/components/deal/DealRow'
import { canonicalDetailPath } from '@/shared/product-flow'
import GuestKakaoButton from './GuestKakaoButton'
import GuestBenefits from './GuestBenefits'
import { usePopularPasses, type PassItem } from './usePopularPasses'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'

const ICON = 20

/** 자리 잡기용 — 화면엔 안 보인다(`invisible`). 줄 높이를 정하는 칸(눈썹·한 줄 제목·가격)만 채운다. */
const PLACEHOLDER_PINS = [1, 2, 3].map((i) => ({ id: -i, name: '\u00a0', restaurant_name: '\u00a0', price: 0, image_url: null })) as unknown as PassItem[]

/**
 * 진열 한 줄 — 진짜 유어샵이 쓰는 **같은 줄 부품**(`DealRow`, 안 s3 의 평면 표면)이다.
 * 예시가 실제 유어샵과 다르게 생기면 "만들면 이렇게 된다" 가 거짓말이 된다.
 */
function ExamplePin({ p, n }: { p: PassItem; n: number }) {
  return (
    <DealRow
      to={canonicalDetailPath(p) ?? `/pass/${p.id}`}
      surface="plain"
      imageUrl={p.image_url}
      eyebrow={p.restaurant_name || undefined}
      title={p.name}
      price={p.current_price ?? p.price}
      originalPrice={p.original_price}
      discountPct={p.discount_rate}
      leading={
        <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-medium flex items-center justify-center">{n}</span>
      }
    />
  )
}

export default function GuestUrShopPage() {
  const { t } = useTranslation()
  const { data: items = [], isLoading } = usePopularPasses()
  const real = items.filter((p) => !!p.image_url).slice(0, 3)
  // 🧱 2026-10-19 — 예시 진열대는 인기 이용권 응답이 와야 그려지는데, 그 전엔 자리가 없어서
  //   도착하는 순간 아래 혜택·가입 버튼이 통째로 425px 밀렸다(라이브 실측 CLS 0.39).
  //   기다리는 동안 **같은 부품(DealRow)으로 같은 개수**를 안 보이게 세워 자리를 잡는다(숫자로 예약하지 않는다).
  const waiting = isLoading && real.length === 0
  const pins: PassItem[] = waiting ? PLACEHOLDER_PINS : real
  const hide = waiting ? ' invisible' : ''

  return (
    <div className={GUEST_CLS.root}>
      <SEO title={t('guest.shop.seo', { defaultValue: '유어샵 - 유어딜' })} url="/u/me" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.shop.title', { defaultValue: GUEST_COPY.shop.title })}
      </h1>

      <div className={GUEST_CLS.shopBody} data-guest="urshop">
        <h2 className={GUEST_CLS.shopHeadline}>
          {t('guest.shop.headline1', { defaultValue: GUEST_COPY.shop.headline1 })}<br />
          {t('guest.shop.headline2', { defaultValue: GUEST_COPY.shop.headline2 })}
        </h2>
        <p className={GUEST_CLS.shopSub}>
          {t('guest.shop.sub', { defaultValue: GUEST_COPY.shop.sub })}
        </p>

        {pins.length > 0 && (
          <section className={`mt-5 rounded-2xl px-4 pt-4 pb-1${hide}`} aria-hidden={waiting || undefined} aria-label={t('guest.shop.example', { defaultValue: '예시' })}>
            <div className="flex items-center gap-3 pb-3 border-b border-rule">
              <span className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-brand-tint flex items-center justify-center">
                <Udal mood="tip" size={48} />
              </span>
              <span className="flex-1 min-w-0 text-[17px] font-bold text-gray-900 dark:text-white truncate">
                {t('guest.shop.exampleName', { defaultValue: '유달의 유어샵' })}
              </span>
              <span className="shrink-0 rounded-full bg-brand-tint px-2 py-1 text-[12px] font-medium text-brand-text">
                {t('guest.shop.example', { defaultValue: '예시' })}
              </span>
            </div>
            <div className="divide-y divide-rule">
              {pins.map((p, i) => <ExamplePin key={p.id} p={p} n={i + 1} />)}
            </div>
          </section>
        )}
        {pins.length > 0 && (
          <p className={`mt-3 flex items-center gap-2 px-1 text-[13px] text-gray-500 dark:text-gray-400${hide}`} aria-hidden={waiting || undefined}>
            <span>{t('guest.shop.linkLabel', { defaultValue: '프로필 링크' })}</span>
            <span className="font-medium text-brand-text">urdeal.kr/u/udal</span>
          </p>
        )}


        <div className="mt-6">
          <GuestBenefits
            items={[
              { icon: <UrShopIcon size={ICON} />, title: t('guest.shop.b1', { defaultValue: '여러 가게를 링크 하나로' }), desc: t('guest.shop.b1d', { defaultValue: '담은 이용권이 내 페이지 한곳에 진열돼요' }) },
              { icon: <TicketStubIcon size={ICON} />, title: t('guest.shop.b2', { defaultValue: '"2번 이용권"이면 끝' }), desc: t('guest.shop.b2d', { defaultValue: '번호가 붙어서 영상·글에서 말하기 쉬워요' }) },
              { icon: <WonCoinIcon size={ICON} />, title: t('guest.shop.b3', { defaultValue: '매장과 협업하면 판매 수익' }), desc: t('guest.shop.b3d', { defaultValue: '협업 코드를 넣으면 팔릴 때마다 정해진 몫을 받아요' }) },
            ]}
          />
        </div>

        <div className="mt-6">
          {/* 유어샵은 **가입 순간 자동으로 생긴다**(KakaoAuthService.upsertUser) — "만들기" 라고 하면 거짓말이다
              (urshop-naming N6). 그래서 버튼은 시작하기, 아래 한 줄이 무엇을 받는지 말한다. */}
          <GuestKakaoButton returnPath="/u/me" />
          <p className="mt-2 text-center text-[13px] text-gray-500 dark:text-gray-400">
            {t('guest.shop.ctaNote', { defaultValue: '가입하면 내 유어샵이 바로 준비돼요' })}
          </p>
        </div>

        <Link to="/partners" className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-4 active:opacity-80">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center">
            <StoreIcon size={ICON} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{t('guest.owner.title', { defaultValue: '사장님이세요?' })}</span>
            <span className="block mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('guest.owner.desc', { defaultValue: '내 가게 이용권을 등록하고 팔아 보세요' })}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
