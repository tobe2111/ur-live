/**
 * 🛍️ 로그인 전 **유어샵 탭**(`/u/me`).
 *
 * 2026-10-12 대표 확정(최종안 ②) — 대표: *"유어샵은 인플루언서를 위한 페이지 아니야? 매장들의 이용권들 모아서
 * 하나의 자신들 페이지로 SNS 링크로 담아넣으려는거잖아."* — 주인공은 **SNS 를 하는 사람**이고 사장님은 아래 한 줄이다.
 * 2026-11-03 대표 *"제안대로 다 해줘"*(시안 `docs/design/guest-tabs-v2-2026-11-03.md`):
 *   머리 → **내 유어샵 미리보기**(이름 · 내 링크 칸 · 진열 사진 3칸) → 1·2·3 단계 → 사장님 줄 + 아래 고정 카카오 버튼.
 *
 * 예시 진열은 지어내지 않는다 — 사진 세 칸은 **지금 실제로 파는 이용권**(홈 피드 인기순 캐시)이다.
 * 주인 이름만 마스코트 "유달"이고 "예시 화면이에요" 를 단다.
 *
 * ⚠️ "팔리면 소개비" 를 쓰지 말 것 — 담기(소개) 커미션은 꺼져 있다(`affiliate_program_enabled`).
 * ⚠️ 유어샵은 가입 순간 자동으로 생긴다 — "만들기" 라고 쓰지 않는다(urshop-naming N6).
 */
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import Udal from '@/components/mascot/Udal'
import { StoreIcon } from '@/components/icons/urdeal-icons'
import DealMiniCard from '@/components/deal/DealMiniCard'
import { ListRow } from '@/pages/user-profile/list-grammar'
import { canonicalDetailPath } from '@/shared/product-flow'
import GuestDock from './GuestDock'
import GuestSteps from './GuestSteps'
import { usePopularPasses, type PassItem } from './usePopularPasses'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'

/** 자리 잡기용 — 화면엔 안 보인다(`invisible`). 같은 부품·같은 개수로 자리를 잡는다(숫자로 예약하지 않는다). */
const PLACEHOLDER_PINS = [1, 2, 3].map((i) => ({ id: -i, name: ' ', price: 0, image_url: null })) as unknown as PassItem[]

export default function GuestUrShopPage() {
  const { t } = useTranslation()
  const { data: items = [], isLoading } = usePopularPasses()
  const real = items.filter((p) => !!p.image_url).slice(0, 3)
  // 🧱 2026-10-19 — 응답 전엔 자리가 없어 도착하는 순간 아래가 통째로 밀렸다(라이브 실측 CLS 0.39).
  const waiting = isLoading && real.length === 0
  const pins: PassItem[] = waiting ? PLACEHOLDER_PINS : real
  const c = GUEST_COPY.shop
  const steps = c.steps.map(([a, b], i) => [
    t(`guest.shop.s${i + 1}a`, { defaultValue: a }),
    t(`guest.shop.s${i + 1}b`, { defaultValue: b }),
  ] as const)

  return (
    <div className={GUEST_CLS.root}>
      <SEO title={t('guest.shop.seo', { defaultValue: '유어샵 - 유어딜' })} url="/u/me" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.shop.title', { defaultValue: c.title })}
      </h1>

      <div className={GUEST_CLS.hero} data-guest="urshop">
        <h2 className={GUEST_CLS.headline}>
          {t('guest.shop.headline1', { defaultValue: c.headline1 })}<br />
          {t('guest.shop.headline2', { defaultValue: c.headline2 })}
        </h2>
        <p className={GUEST_CLS.sub}>
          {t('guest.shop.sub', { defaultValue: c.sub })}
        </p>

        {pins.length > 0 && (
          <section className="mt-5" aria-label={t('guest.shop.example', { defaultValue: '예시' })}>
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-brand-tint flex items-center justify-center">
                <Udal mood="tip" size={40} />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold text-gray-900 dark:text-white truncate">
                  {t('guest.shop.exampleName', { defaultValue: '유달의 유어샵' })}
                </span>
                <span className="block text-[13px] text-gray-500 dark:text-gray-400">
                  {t('guest.shop.exampleNote', { defaultValue: '예시 화면이에요' })}
                </span>
              </span>
            </div>
            <p className="mt-3 flex h-10 items-center rounded-xl bg-gray-100 dark:bg-white/5 px-3 text-[13px] text-gray-500 dark:text-gray-400">
              <span>urdeal.kr/u/</span>
              <span className="font-medium text-brand-text">{t('guest.shop.myName', { defaultValue: '내이름' })}</span>
            </p>
            <div className={`mt-3 grid grid-cols-3 gap-2${waiting ? ' invisible' : ''}`} aria-hidden={waiting || undefined}>
              {pins.map((p) => (
                <DealMiniCard
                  key={p.id}
                  to={canonicalDetailPath(p) ?? `/pass/${p.id}`}
                  imageUrl={p.image_url}
                  title={p.name}
                  price={Number(p.current_price ?? p.price) > 0 ? Number(p.current_price ?? p.price) : null}
                  className="min-w-0"
                  imgWidth={240}
                />
              ))}
            </div>
          </section>
        )}

        <GuestSteps steps={steps} />
      </div>

      <div className="mt-2">
        <ListRow
          icon={<StoreIcon size={18} />}
          label={t('guest.owner.sell', { defaultValue: '사장님이세요? 내 가게 이용권 팔기' })}
          to="/partners"
        />
      </div>

      <GuestDock returnPath="/u/me" note={t('guest.shop.ctaNote', { defaultValue: c.dockNote })} />
    </div>
  )
}
