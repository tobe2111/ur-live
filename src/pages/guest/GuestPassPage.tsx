/**
 * 🎟️ 로그인 전 **이용권 탭**(`/my-vouchers`).
 *
 * 2026-10-12 대표 확정(최종안 ①) — 탭을 열고 개인 데이터 자리만 카카오로 대신한다.
 * 2026-11-03 대표 *"제안대로 다 해줘"*(시안 `docs/design/guest-tabs-v2-2026-11-03.md`) — 모양을 바꿨다:
 *   ① 머리(큰 문장 + 한 줄) → ② **티켓 미리보기**(로그인하면 지갑에 이렇게 들어온다) → ③ 1·2·3 단계
 *   → ④ 지금 많이 사는 이용권(홈 피드와 같은 캐시 `usePopularPasses`, 같은 줄 부품 `DealRow`)
 *   + 아래 고정 카카오 버튼(`GuestDock`). 위쪽 ①~③ 은 서버 첫 화면과 같은 모양이다(`worker/utils/guest-first-screen.ts`).
 *
 * 혜택·단계 문구는 라이브에서 실제로 되는 것만이다(꺼진 혜택 금지 — `guest-tabs-2026-10-12.test.tsx` ⑤).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import DealRow from '@/components/deal/DealRow'
import { canonicalDetailPath } from '@/shared/product-flow'
import GuestDock from './GuestDock'
import GuestSteps from './GuestSteps'
import GuestTicket from './GuestTicket'
import { usePopularPasses } from './usePopularPasses'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'

export default function GuestPassPage() {
  const { t } = useTranslation()
  const { data: items = [] } = usePopularPasses()
  const picks = items.slice(0, 4)
  const c = GUEST_COPY.pass
  const steps = c.steps.map(([a, b], i) => [
    t(`guest.pass.s${i + 1}a`, { defaultValue: a }),
    t(`guest.pass.s${i + 1}b`, { defaultValue: b }),
  ] as const)

  return (
    <div className={GUEST_CLS.root}>
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.pass.title', { defaultValue: c.title })}
      </h1>

      <section className={GUEST_CLS.hero} data-guest="pass">
        <h2 className={GUEST_CLS.headline}>
          {t('guest.pass.headline1', { defaultValue: c.headline1 })}<br />
          {t('guest.pass.headline2', { defaultValue: c.headline2 })}
        </h2>
        <p className={GUEST_CLS.sub}>{t('guest.pass.sub', { defaultValue: c.sub })}</p>
        <GuestTicket />
        <GuestSteps steps={steps} />
      </section>

      {picks.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between px-4">
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">
              {t('guest.pass.popular', { defaultValue: '지금 많이 사는 이용권' })}
            </h2>
            <Link to="/" className="text-[13px] text-gray-500 dark:text-gray-400 active:opacity-80">
              {t('guest.pass.more', { defaultValue: '더보기' })}
            </Link>
          </div>
          <div className="mt-1 divide-y divide-rule px-4">
            {picks.map((p) => (
              <DealRow
                key={p.id}
                to={canonicalDetailPath(p) ?? `/pass/${p.id}`}
                surface="plain"
                imageUrl={p.image_url}
                eyebrow={p.restaurant_name || undefined}
                title={p.name}
                price={p.current_price ?? p.price}
                originalPrice={p.original_price}
                discountPct={p.discount_rate}
              />
            ))}
          </div>
        </section>
      )}

      <GuestDock returnPath="/my-vouchers" note={t('guest.pass.dockNote', { defaultValue: c.dockNote })} />
    </div>
  )
}
