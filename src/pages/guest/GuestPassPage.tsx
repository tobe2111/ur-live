/**
 * 🎟️ 로그인 전 **이용권 탭**(`/my-vouchers`).
 *
 * 2026-10-12 대표 확정(최종안 ①) — 탭을 열고 개인 데이터 자리만 카카오로 대신한다.
 * 2026-11-03 대표 *"제안대로 다 해줘"*(시안 `docs/design/guest-tabs-v2-2026-11-03.md`) — 모양을 바꿨다:
 *   ① 머리(큰 문장 + 한 줄) → ② **티켓 미리보기**(로그인하면 지갑에 이렇게 들어온다) → ③ 1·2·3 단계
 *   → ④ 예시 이용권(`GuestExampleRows` — 실제 상품 아님, 2026-11-03 대표 *"실제 이용권으로 하면 어떡해"*)
 *   + 아래 고정 카카오 버튼(`GuestDock`). 위쪽 ①~③ 은 서버 첫 화면과 같은 모양이다(`worker/utils/guest-first-screen.ts`).
 *
 * 혜택·단계 문구는 라이브에서 실제로 되는 것만이다(꺼진 혜택 금지 — `guest-tabs-2026-10-12.test.tsx` ⑤).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import GuestDock from './GuestDock'
import GuestSteps from './GuestSteps'
import GuestTicket from './GuestTicket'
import GuestExampleRows from './GuestExampleRows'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'

export default function GuestPassPage() {
  const { t } = useTranslation()
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

      <section className="mt-8">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">
            {t('guest.pass.examples', { defaultValue: '이런 이용권이 있어요' })}
          </h2>
          <span className="rounded-full bg-brand-tint px-2 py-1 text-[12px] font-medium text-brand-text">
            {t('guest.shop.example', { defaultValue: '예시' })}
          </span>
        </div>
        <div className="mt-1 px-4">
          <GuestExampleRows />
        </div>
        <Link to="/" className="mx-4 mt-4 flex h-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-[15px] font-medium text-gray-900 dark:text-white active:opacity-80">
          {t('guest.pass.browse', { defaultValue: '지금 파는 이용권 보러 가기' })}
        </Link>
      </section>

      {/* 2026-11-03 대표 *"맨 밑에 3초만에 끝나요 문장 빼줘"* — 이용권 탭은 버튼 아래 한 줄 없이. */}
      <GuestDock returnPath="/my-vouchers" />
    </div>
  )
}
