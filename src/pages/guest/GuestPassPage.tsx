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
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import GuestDock from './GuestDock'
import GuestSteps from './GuestSteps'
import GuestTicket from './GuestTicket'
import GuestExampleRows from './GuestExampleRows'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'
import { useGuestMotion } from './guest-motion'

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
/**
 * 🎬 2026-11-04 로그아웃 이용권 탭 모션(대표 *"로그아웃 상태에서의 이용권 페이지도 모션그래픽들을 넣어줄래?"*).
 *   서버 첫 화면이 그리는 위쪽(티켓·1·2·3)은 **안 보이게 시작하지 않는다** — 이미 보이는 걸 흐렸다 띄우면 깜빡인다.
 *   그래서 위쪽은 *보이는 채로* 움직이고, 앱만 그리는 아래(예시)만 들어오며 나타난다:
 *   ① 예시 지갑 두 장이 차례로 '톡' 하고 자리 잡는다(살짝 튐) · 사진은 천천히 다가간다
 *   ② **시연**: 첫 장 [사용] 이 눌리고(물결) 그 위로 QR 이 톡 떠오른다 — "누르면 QR" 을 보여 준다(5초마다)
 *   ③ 헤드라인 '더 싸요' 에 형광펜(guest-motion 의 mark — 유어샵 탭과 같은 한 벌)
 *   ④ 1·2·3 아래 파란 막대가 1→2→3 으로 옮겨 가며 그 숫자가 커진다(구매 → QR → 환불 흐름, 반복)
 *   (2026-11-04 대표 *"저 이용권 페이지에서 이제 모션그래픽 제대로 넣어줘"* — 첫 판이 한 번 튀고 끝나 약했다) ⑤ 예시 이용권이 화면에 들어오면 오른쪽에서 차례로 · 할인율이 톡 ⑥ '보러 가기' 가 떠오른다
 */
injectMotionCss('ur-m-guestpass', `@keyframes ur-gp-land { 0% { transform: translateY(0); } 35% { transform: translateY(-6px); } 70% { transform: translateY(1px); } 100% { transform: none; } }@keyframes ur-gp-kb { from { transform: none; } to { transform: scale(1.1); } }@keyframes ur-gp-press { 0%, 16% { transform: none; } 19% { transform: scale(.86); } 23%, 100% { transform: none; } }@keyframes ur-gp-ring { 0%, 18% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 50%, transparent); } 40%, 100% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--brand) 0%, transparent); } }@keyframes ur-gp-qrpop { 0%, 20% { opacity: 0; transform: translateY(8px) scale(.6); } 26% { opacity: 1; transform: translateY(-2px) scale(1.05); } 30%, 62% { opacity: 1; transform: none; } 70%, 100% { opacity: 0; transform: translateY(-6px) scale(.9); } }@keyframes ur-gp-bar { 0%, 30% { transform: translateX(0); } 34%, 63% { transform: translateX(100%); } 67%, 95% { transform: translateX(200%); opacity: 1; } 99% { transform: translateX(200%); opacity: 0; } 100% { transform: translateX(0); opacity: 0; } }@keyframes ur-gp-numon { 0%, 30% { transform: scale(1.35); } 34%, 100% { transform: none; } }@keyframes ur-gp-row { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }@keyframes ur-gp-pop { 0% { transform: scale(.4); } 70% { transform: scale(1.15); } 100% { transform: none; } }@keyframes ur-gp-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }[data-guest="pass"] .ur-gp-wrow { animation: ur-gp-land .7s cubic-bezier(.3,1.3,.5,1) .15s both; }[data-guest="pass"] .ur-gp-wrow + .ur-gp-wrow { animation-delay: .3s; }[data-guest="pass"] .ur-gp-wrow img { animation: ur-gp-kb 7s ease-in-out 1s infinite alternate; }[data-guest="pass"] .ur-gp-wrow:first-child .ur-gp-use { position: relative; animation: ur-gp-press 5s ease-in-out 1.2s infinite, ur-gp-ring 5s ease-out 1.2s infinite; }[data-guest="pass"] .ur-gp-wrow:first-child .ur-gp-use::after { content: ''; position: absolute; right: -4px; bottom: calc(100% + 8px); width: 52px; height: 52px; border-radius: 10px; background: white url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 21 21' shape-rendering='crispEdges'><path fill-rule='evenodd' fill='black' d='M0 0h7v7h-7zM1 1v5h5v-5zM2 2h3v3h-3zM14 0h7v7h-7zM15 1v5h5v-5zM16 2h3v3h-3zM0 14h7v7h-7zM1 15v5h5v-5zM2 16h3v3h-3zM9 1h1v1h-1zM10 3h1v1h-1zM12 2h1v1h-1zM9 5h1v1h-1zM11 6h1v1h-1zM8 9h1v1h-1zM10 9h1v1h-1zM13 9h1v1h-1zM15 8h1v1h-1zM17 10h1v1h-1zM19 9h1v1h-1zM9 11h1v1h-1zM12 12h1v1h-1zM14 11h1v1h-1zM16 13h1v1h-1zM18 12h1v1h-1zM9 14h1v1h-1zM11 15h1v1h-1zM13 16h1v1h-1zM15 15h1v1h-1zM17 17h1v1h-1zM19 15h1v1h-1zM10 18h1v1h-1zM12 19h1v1h-1zM14 18h1v1h-1zM16 19h1v1h-1zM18 19h1v1h-1zM1 9h1v1h-1zM3 10h1v1h-1zM5 9h1v1h-1zM2 12h1v1h-1zM4 13h1v1h-1zM6 11h1v1h-1z'/></svg>") center / 40px 40px no-repeat; box-shadow: 0 6px 18px rgba(17,20,28,.18); pointer-events: none; opacity: 0; animation: ur-gp-qrpop 5s cubic-bezier(.3,1.3,.5,1) 1.2s infinite; }[data-guest="pass"] ol { position: relative; }[data-guest="pass"] ol::after { content: ''; position: absolute; left: 0; bottom: -1px; width: 33.34%; height: 2px; background: var(--brand); pointer-events: none; animation: ur-gp-bar 4.5s ease-in-out 1s infinite both; }[data-guest="pass"] .ur-gp-num { display: inline-block; animation: ur-gp-numon 4.5s ease-in-out 1s infinite; }[data-guest="pass"] li:nth-child(2) .ur-gp-num { animation-delay: 2.5s; }[data-guest="pass"] li:nth-child(3) .ur-gp-num { animation-delay: 4s; }.ur-gp-shelf .ur-gs-rows > *, .ur-gp-shelf .ur-gp-browse { opacity: 0; }.ur-gp-shelf.ur-gp-on .ur-gs-rows > * { animation: ur-gp-row .5s cubic-bezier(.2,1,.3,1) both; }.ur-gp-shelf.ur-gp-on .ur-gs-rows > :nth-child(2) { animation-delay: .09s; }.ur-gp-shelf.ur-gp-on .ur-gs-rows > :nth-child(3) { animation-delay: .18s; }.ur-gp-shelf.ur-gp-on .ur-gs-rows .text-sale { display: inline-block; animation: ur-gp-pop .4s cubic-bezier(.3,1.4,.5,1) .35s backwards; }.ur-gp-shelf.ur-gp-on .ur-gp-browse { animation: ur-gp-up .5s cubic-bezier(.2,1,.3,1) .32s both; }@media (prefers-reduced-motion: reduce){[data-guest="pass"] .ur-gp-wrow,[data-guest="pass"] .ur-gp-wrow img,[data-guest="pass"] .ur-gp-use,[data-guest="pass"] .ur-gp-num,.ur-gp-shelf.ur-gp-on .ur-gs-rows > *,.ur-gp-shelf.ur-gp-on .ur-gs-rows .text-sale,.ur-gp-shelf.ur-gp-on .ur-gp-browse{animation:none!important}[data-guest="pass"] .ur-gp-use::after,[data-guest="pass"] ol::after{display:none}.ur-gp-shelf .ur-gs-rows > *,.ur-gp-shelf .ur-gp-browse{opacity:1}}`)

/** 화면에 들어오면 `ur-gp-on` 을 한 번 붙인다. 관찰기가 없으면 바로 붙인다(보이기는 해야 한다). */
function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('ur-gp-on'); return }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { el.classList.add('ur-gp-on'); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

/** 헤드라인의 한 구절을 형광펜 칸으로 감싼다 — 서버 첫 화면(`guest-first-screen.markHtml`)과 같은 모양(유어샵 탭의 것과 같은 3줄). */
function MarkedLine({ line, mark }: { line: string; mark: string }) {
  const i = line.indexOf(mark)
  if (i < 0) return <>{line}</>
  return <>{line.slice(0, i)}<span data-motion="mark">{mark}</span>{line.slice(i + mark.length)}</>
}

export default function GuestPassPage() {
  const { t } = useTranslation()
  const c = GUEST_COPY.pass
  const shelfRef = useRevealOnce<HTMLElement>()
  const rootRef = useRef<HTMLDivElement | null>(null)
  useGuestMotion(rootRef) // 🎬 헤드라인 형광펜(data-motion="mark")
  const steps = c.steps.map(([a, b], i) => [
    t(`guest.pass.s${i + 1}a`, { defaultValue: a }),
    t(`guest.pass.s${i + 1}b`, { defaultValue: b }),
  ] as const)

  return (
    <div ref={rootRef} className={GUEST_CLS.root}>
      <SEO title={t('voucher.seoTitle')} description={t('voucher.seoDescription')} url="/my-vouchers" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.pass.title', { defaultValue: c.title })}
      </h1>

      <section className={GUEST_CLS.hero} data-guest="pass">
        <h2 className={GUEST_CLS.headline}>
          {t('guest.pass.headline1', { defaultValue: c.headline1 })}<br />
          <MarkedLine line={t('guest.pass.headline2', { defaultValue: c.headline2 })} mark={c.headline2Mark} />
        </h2>
        <p className={GUEST_CLS.sub}>{t('guest.pass.sub', { defaultValue: c.sub })}</p>
        <GuestTicket />
        <GuestSteps steps={steps} />
      </section>

      <section ref={shelfRef} className="mt-8 ur-gp-shelf">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">
            {t('guest.pass.examples', { defaultValue: '이런 이용권이 있어요' })}
          </h2>
          <span className="rounded-full bg-brand-tint px-2 py-1 text-[12px] font-medium text-brand-text">
            {t('guest.shop.example', { defaultValue: '예시' })}
          </span>
        </div>
        <div className="mt-1 px-4">
          <GuestExampleRows motion />
        </div>
        <div className="mt-5 px-4 ur-gp-browse">
          <Link to="/" className="flex h-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5 text-[15px] font-medium text-gray-900 dark:text-white active:opacity-80">
            {t('guest.pass.browse', { defaultValue: '지금 파는 이용권 보러 가기' })}
          </Link>
        </div>
      </section>

      {/* 2026-11-03 대표 *"맨 밑에 3초만에 끝나요 문장 빼줘"* — 이용권 탭은 버튼 아래 한 줄 없이. */}
      <GuestDock returnPath="/my-vouchers" />
    </div>
  )
}
