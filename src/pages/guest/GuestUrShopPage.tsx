/**
 * 🛍️ 로그인 전 **유어샵 탭**(`/u/me`).
 *
 * 2026-10-12 대표 확정(최종안 ②) — 대표: *"유어샵은 인플루언서를 위한 페이지 아니야? 매장들의 이용권들 모아서
 * 하나의 자신들 페이지로 SNS 링크로 담아넣으려는거잖아."* — 주인공은 **SNS 를 하는 사람**이고 사장님은 아래 한 줄이다.
 * 2026-11-03 대표 *"제안대로 다 해줘"*(시안 `docs/design/guest-tabs-v2-2026-11-03.md`):
 *   머리 → **내 유어샵 미리보기**(이름 · 내 링크 칸 · 진열 사진 3칸) → 1·2·3 단계 → 사장님 줄 + 아래 고정 카카오 버튼.
 *
 * 🧪 2026-11-03 대표 *"로그아웃 시에는 이용권도 이렇게 해야지, 실제 이용권으로 하면 어떡해"* — 진열은 **예시 이용권**
 *   (`GuestExampleRows`, 고정 예시 · 색 칸 · 누를 수 없음)이다. 종전(10-12)엔 실제로 파는 이용권을 끌어다 썼다.
 *   데이터 요청이 없으니 응답 도착 때 아래가 밀리던 문제(10-19 CLS 0.39)도 구조적으로 사라졌다.
 *
 * ⚠️ "팔리면 소개비" 를 쓰지 말 것 — 담기(소개) 커미션은 꺼져 있다(`affiliate_program_enabled`).
 * ⚠️ 유어샵은 가입 순간 자동으로 생긴다 — "만들기" 라고 쓰지 않는다(urshop-naming N6).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import Udal from '@/components/mascot/Udal'
import { StoreIcon } from '@/components/icons/urdeal-icons'
import { ListRow } from '@/pages/user-profile/list-grammar'
import GuestDock from './GuestDock'
import GuestSteps from './GuestSteps'
import GuestExampleRows from './GuestExampleRows'
import { GUEST_CLS, GUEST_COPY } from '@/shared/guest-page'
import { useGuestMotion } from './guest-motion'

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
/**
 * 🎬 2026-11-03 로그아웃 유어샵(대표 *"로그아웃 시 나타나는 유어샵, 마이페이지에서도 모션그래픽 넣어줘 중요해"*).
 *   서버 첫 화면이 그리는 위쪽(제목·헤드라인)은 **안 움직인다** — 이미 보이는 글자를 흐렸다 다시 띄우면 깜빡인다.
 *   움직이는 건 그 아래, 앱이 그리는 부분뿐이다:
 *   ① 예시 진열대 — 세 줄이 오른쪽에서 차례로 들어오고 번호가 톡 붙는다(예시라 데이터를 안 기다린다)
 *   ② 내 링크 칸 — '내이름' 이 한 글자씩 쳐진다(진짜로 내 주소가 생기는 느낌)
 *   ③ 1·2·3 단계·사장님 줄 — 화면에 들어올 때 아래에서 차례로 떠오른다
 */
injectMotionCss('ur-m-guestshop', `@keyframes ur-gs-row { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }@keyframes ur-gs-pop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: none; } }@keyframes ur-gs-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }@keyframes ur-gs-caret { 50% { opacity: 0; } }.ur-gs-shelf .ur-gs-rows > * { animation: ur-gs-row .5s cubic-bezier(.2,1,.3,1) backwards; }.ur-gs-shelf .ur-gs-rows > :nth-child(2) { animation-delay: .09s; }.ur-gs-shelf .ur-gs-rows > :nth-child(3) { animation-delay: .18s; }.ur-gs-shelf .ur-gs-n { animation: ur-gs-pop .4s cubic-bezier(.3,1.4,.5,1) .3s backwards; }.ur-gs-shelf .ur-gs-rows > :nth-child(2) .ur-gs-n { animation-delay: .39s; }.ur-gs-shelf .ur-gs-rows > :nth-child(3) .ur-gs-n { animation-delay: .48s; }.ur-gs-caret { display: inline-block; width: 1px; height: 1em; margin-left: 1px; vertical-align: -2px; background: currentColor; animation: ur-gs-caret 1s steps(1) infinite; }.ur-gs-reveal li, .ur-gs-reveal-one { opacity: 0; }.ur-gs-reveal.ur-gs-on li, .ur-gs-reveal-one.ur-gs-on { animation: ur-gs-up .5s cubic-bezier(.2,1,.3,1) both; }.ur-gs-reveal.ur-gs-on li:nth-child(2) { animation-delay: .08s; }.ur-gs-reveal.ur-gs-on li:nth-child(3) { animation-delay: .16s; }.ur-gs-reveal.ur-gs-on li > span:first-child, .ur-gs-reveal-one.ur-gs-on > span:first-child { animation: ur-gs-pop .4s cubic-bezier(.3,1.4,.5,1) .15s backwards; }@media (prefers-reduced-motion: reduce){.ur-gs-shelf .ur-gs-rows > *,.ur-gs-shelf .ur-gs-n,.ur-gs-caret,.ur-gs-reveal.ur-gs-on li,.ur-gs-reveal-one.ur-gs-on,.ur-gs-reveal.ur-gs-on li > span:first-child,.ur-gs-reveal-one.ur-gs-on > span:first-child{animation:none!important}.ur-gs-reveal li,.ur-gs-reveal-one{opacity:1}}`)

/** 화면에 들어오면 `ur-gs-on` 을 한 번 붙인다. 관찰기가 없으면 바로 붙인다(보이기는 해야 한다). */
function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('ur-gs-on'); return }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { el.classList.add('ur-gs-on'); io.disconnect() } }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

/** 헤드라인의 한 구절을 형광펜 칸으로 감싼다(🎬 2차 ①) — 서버 첫 화면(`guest-first-screen.markHtml`)과 같은 모양. */
function MarkedLine({ line, mark }: { line: string; mark: string }) {
  const i = line.indexOf(mark)
  if (i < 0) return <>{line}</>
  return <>{line.slice(0, i)}<span data-motion="mark">{mark}</span>{line.slice(i + mark.length)}</>
}

/** 주소 끝 글자를 한 글자씩 친다. 동작 줄이기면 처음부터 다 보인다. */
function useTyped(word: string, start: boolean) {
  const [n, setN] = useState(() => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? word.length : 0 } catch { return word.length } })
  useEffect(() => {
    if (!start || n >= word.length) return
    const id = window.setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : 110)
    return () => window.clearTimeout(id)
  }, [start, n, word.length])
  return { text: word.slice(0, n), done: n >= word.length }
}

export default function GuestUrShopPage() {
  const { t } = useTranslation()
  const c = GUEST_COPY.shop
  const myName = t('guest.shop.myName', { defaultValue: '내이름' })
  const typed = useTyped(myName, true)
  const stepsRef = useRevealOnce<HTMLDivElement>()
  const ownerRef = useRevealOnce<HTMLDivElement>()
  const rootRef = useRef<HTMLDivElement | null>(null)
  useGuestMotion(rootRef, [typed.done]) // 🎬 2차 — 형광펜·SNS 조각·사장님 줄 화살표(표시는 data-motion, 움직임은 guest-motion.ts)
  const steps = c.steps.map(([a, b], i) => [
    t(`guest.shop.s${i + 1}a`, { defaultValue: a }),
    t(`guest.shop.s${i + 1}b`, { defaultValue: b }),
  ] as const)

  return (
    <div ref={rootRef} className={GUEST_CLS.root}>
      <SEO title={t('guest.shop.seo', { defaultValue: '유어샵 - 유어딜' })} url="/u/me" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.shop.title', { defaultValue: c.title })}
      </h1>

      <div className={GUEST_CLS.hero} data-guest="urshop">
        <h2 className={GUEST_CLS.headline}>
          {t('guest.shop.headline1', { defaultValue: c.headline1 })}<br />
          <MarkedLine line={t('guest.shop.headline2', { defaultValue: c.headline2 })} mark={c.headline2Mark} />
        </h2>
        <p className={GUEST_CLS.sub}>
          {t('guest.shop.sub', { defaultValue: c.sub })}
        </p>

        <section className="mt-5 ur-gs-shelf" aria-label={t('guest.shop.example', { defaultValue: '예시' })}>
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-brand-tint flex items-center justify-center">
              <Udal mood="tip" size={40} />
            </span>
            <span className="flex-1 min-w-0 text-[16px] font-semibold text-gray-900 dark:text-white truncate">
              {t('guest.shop.exampleName', { defaultValue: '유달의 유어샵' })}
            </span>
            <span className="shrink-0 rounded-full bg-brand-tint px-2 py-1 text-[12px] font-medium text-brand-text">
              {t('guest.shop.example', { defaultValue: '예시' })}
            </span>
          </div>
          <p className="mt-3 flex h-10 items-center rounded-xl bg-gray-100 dark:bg-white/5 px-3 text-[13px] text-gray-500 dark:text-gray-400">
            <span>urdeal.kr/u/</span>
            <span className="font-medium text-brand-text" aria-label={myName}>{typed.text}{!typed.done && <span className="ur-gs-caret" aria-hidden="true" />}</span>
            {/* 🎬 2차 ③ — 주소가 다 쳐지면 SNS 색 조각 셋이 톡톡(어디든 걸 수 있다는 뜻) */}
            {typed.done && (
              <span data-motion="chips" className="ml-auto inline-flex gap-1" aria-hidden="true">
                <i className="block w-3.5 h-3.5 rounded" style={{ background: 'linear-gradient(45deg, rgb(249,206,52), rgb(238,42,123), rgb(98,40,215))' }} />
                <i className="block w-3.5 h-3.5 rounded" style={{ background: 'rgb(255,0,0)' }} />
                <i className="block w-3.5 h-3.5 rounded" style={{ background: 'rgb(3,199,90)' }} />
              </span>
            )}
          </p>
          <div className="mt-1">
            <GuestExampleRows numbered motion />
          </div>
        </section>

        <div ref={stepsRef} className="ur-gs-reveal"><GuestSteps steps={steps} /></div>
      </div>

      <div ref={ownerRef} className="mt-2 ur-gs-reveal-one" data-motion="nudge">
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
