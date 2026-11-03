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
import { useEffect, useMemo, useRef, useState } from 'react'
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

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
/**
 * 🎬 2026-11-03 로그아웃 유어샵(대표 *"로그아웃 시 나타나는 유어샵, 마이페이지에서도 모션그래픽 넣어줘 중요해"*).
 *   서버 첫 화면이 그리는 위쪽(제목·헤드라인)은 **안 움직인다** — 이미 보이는 글자를 흐렸다 다시 띄우면 깜빡인다.
 *   움직이는 건 그 아래, 앱이 그리는 부분뿐이다:
 *   ① 예시 진열대 — 이용권이 도착하면 세 줄이 오른쪽에서 차례로 들어오고 번호가 톡 붙는다
 *   ② 프로필 링크 — 'udal' 이 한 글자씩 쳐진다(진짜로 내 주소가 생기는 느낌)
 *   ③ 혜택 셋·사장님 줄 — 화면에 들어올 때 아래에서 차례로 떠오르고 아이콘이 톡
 */
injectMotionCss('ur-m-guestshop', `@keyframes ur-gs-row { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }@keyframes ur-gs-pop { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: none; } }@keyframes ur-gs-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }@keyframes ur-gs-caret { 50% { opacity: 0; } }.ur-gs-shelf .ur-gs-rows > * { animation: ur-gs-row .5s cubic-bezier(.2,1,.3,1) backwards; }.ur-gs-shelf .ur-gs-rows > :nth-child(2) { animation-delay: .09s; }.ur-gs-shelf .ur-gs-rows > :nth-child(3) { animation-delay: .18s; }.ur-gs-shelf .ur-gs-n { animation: ur-gs-pop .4s cubic-bezier(.3,1.4,.5,1) .3s backwards; }.ur-gs-shelf .ur-gs-rows > :nth-child(2) .ur-gs-n { animation-delay: .39s; }.ur-gs-shelf .ur-gs-rows > :nth-child(3) .ur-gs-n { animation-delay: .48s; }.ur-gs-caret { display: inline-block; width: 1px; height: 1em; margin-left: 1px; vertical-align: -2px; background: currentColor; animation: ur-gs-caret 1s steps(1) infinite; }.ur-gs-reveal li, .ur-gs-reveal-one { opacity: 0; }.ur-gs-reveal.ur-gs-on li, .ur-gs-reveal-one.ur-gs-on { animation: ur-gs-up .5s cubic-bezier(.2,1,.3,1) both; }.ur-gs-reveal.ur-gs-on li:nth-child(2) { animation-delay: .08s; }.ur-gs-reveal.ur-gs-on li:nth-child(3) { animation-delay: .16s; }.ur-gs-reveal.ur-gs-on li > span:first-child, .ur-gs-reveal-one.ur-gs-on > span:first-child { animation: ur-gs-pop .4s cubic-bezier(.3,1.4,.5,1) .15s backwards; }@media (prefers-reduced-motion: reduce){.ur-gs-shelf .ur-gs-rows > *,.ur-gs-shelf .ur-gs-n,.ur-gs-caret,.ur-gs-reveal.ur-gs-on li,.ur-gs-reveal-one.ur-gs-on,.ur-gs-reveal.ur-gs-on li > span:first-child,.ur-gs-reveal-one.ur-gs-on > span:first-child{animation:none!important}.ur-gs-reveal li,.ur-gs-reveal-one{opacity:1}}`)
/**
 * 🎬 2026-11-03 로그아웃 2차(대표 *"시안들 다 마음에 든다"*):
 *   ① 헤드라인 'SNS 링크 하나' 형광펜 — 서버가 그린 글자를 **숨기지 않고** 밑에 덧칠만(`ur-gs-mark` 에 `ur-on`)
 *   ② 예시 진열대가 3초마다 한 줄씩 다른 인기 이용권으로 바뀐다(줄이 새로 들어오는 움직임은 ①차 등장 그대로)
 *   ③ 주소가 다 쳐지면 옆에 SNS 색 조각 셋이 톡톡 ④ 혜택 아이콘이 저마다 움직인다(고리 흔들림·톡·동전 돌기)
 *   ⑤ 사장님 줄 화살표가 들어오면 오른쪽으로 두 번 밀린다
 */
injectMotionCss('ur-m-guestshop2', `@keyframes ur-gs-wig { 0%, 100% { transform: none; } 30% { transform: rotate(-14deg); } 65% { transform: rotate(10deg); } }@keyframes ur-gs-flip { 0%, 100% { transform: none; } 50% { transform: scaleX(-1); } }@keyframes ur-gs-nudge { 0%, 100% { transform: none; } 35% { transform: translateX(5px); } }@keyframes ur-gs-chip { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: none; } }.ur-gs-mark { background: linear-gradient(transparent 60%, rgba(28,105,239,.25) 60%) no-repeat 0 0 / 0% 100%; transition: background-size .8s cubic-bezier(.3,.8,.3,1); }.ur-gs-mark.ur-on { background-size: 100% 100%; }.ur-gs-reveal.ur-gs-on li:nth-child(1) svg { animation: ur-gs-wig .6s ease-in-out .55s; }.ur-gs-reveal.ur-gs-on li:nth-child(3) svg { animation: ur-gs-flip .8s ease-in-out .75s; }.ur-gs-reveal-one.ur-gs-on .ur-gs-chev { animation: ur-gs-nudge 1.1s ease-in-out .6s 2; }.ur-gs-chips > i { display: inline-block; width: 14px; height: 14px; border-radius: 4px; animation: ur-gs-chip .35s cubic-bezier(.3,1.4,.5,1) backwards; }.ur-gs-chips > i:nth-child(2) { animation-delay: .1s; }.ur-gs-chips > i:nth-child(3) { animation-delay: .2s; }@media (prefers-reduced-motion: reduce){.ur-gs-mark{transition:none!important}.ur-gs-reveal.ur-gs-on li svg,.ur-gs-reveal-one.ur-gs-on .ur-gs-chev,.ur-gs-chips > i{animation:none!important}}`)

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

/** 헤드라인 안의 한 구절을 형광펜 칸으로 감싼다 — 서버 첫 화면(`guest-first-screen.markHtml`)과 같은 모양. */
function MarkedLine({ line, mark }: { line: string; mark: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  // 테스트·서버 모양 비교에 끼지 않게 조금 뒤에 붙인다(붙는 순간 밑줄이 왼쪽부터 그어진다).
  useEffect(() => { const id = window.setTimeout(() => ref.current?.classList.add('ur-on'), 450); return () => window.clearTimeout(id) }, [])
  const i = line.indexOf(mark)
  if (i < 0) return <>{line}</>
  return <>{line.slice(0, i)}<span ref={ref} className={GUEST_CLS.shopMark}>{mark}</span>{line.slice(i + mark.length)}</>
}

/** 예시 진열대 — 3초마다 한 줄씩 다음 인기 이용권으로 바꾼다. 인기 이용권이 셋 이하이거나 동작 줄이기면 그대로. */
function useRotatingPins(pool: PassItem[], enabled: boolean): PassItem[] {
  const [slots, setSlots] = useState<number[]>([0, 1, 2])
  // 🩸 목록이 새 배열로 와도(빈 목록 기본값 등) 내용이 같으면 다시 시작하지 않는다 — 안 그러면 setSlots 가 다시 그리기를 부르고 끝없이 돈다.
  const sig = pool.map((p) => p.id).join(',')
  useEffect(() => {
    setSlots((s) => (s[0] === 0 && s[1] === 1 && s[2] === 2 ? s : [0, 1, 2]))
    if (!enabled || pool.length <= 3) return
    try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { return }
    let tick = 0, next = 3
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const row = tick++ % 3
      const pick = next++ % pool.length
      setSlots((s) => (s.includes(pick) ? s : s.map((v, k) => (k === row ? pick : v))))
    }, 3000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled])
  return slots.map((i) => pool[i]).filter(Boolean)
}

/** 'udal' 을 한 글자씩 친다. 동작 줄이기면 처음부터 다 보인다. */
function useTyped(word: string, start: boolean) {
  const [n, setN] = useState(() => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? word.length : 0 } catch { return word.length } })
  useEffect(() => {
    if (!start || n >= word.length) return
    const id = window.setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : 110)
    return () => window.clearTimeout(id)
  }, [start, n, word.length])
  return { text: word.slice(0, n), done: n >= word.length }
}

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
        <span className="ur-gs-n shrink-0 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-medium flex items-center justify-center">{n}</span>
      }
    />
  )
}

export default function GuestUrShopPage() {
  const { t } = useTranslation()
  const { data: items = [], isLoading } = usePopularPasses()
  const withPhoto = useMemo(() => items.filter((p) => !!p.image_url).slice(0, 9), [items])
  const real = useRotatingPins(withPhoto, true)
  // 🧱 2026-10-19 — 예시 진열대는 인기 이용권 응답이 와야 그려지는데, 그 전엔 자리가 없어서
  //   도착하는 순간 아래 혜택·가입 버튼이 통째로 425px 밀렸다(라이브 실측 CLS 0.39).
  //   기다리는 동안 **같은 부품(DealRow)으로 같은 개수**를 안 보이게 세워 자리를 잡는다(숫자로 예약하지 않는다).
  const waiting = isLoading && real.length === 0
  const pins: PassItem[] = waiting ? PLACEHOLDER_PINS : real
  const hide = waiting ? ' invisible' : ''
  const typed = useTyped('udal', !waiting && pins.length > 0)
  const benefitsRef = useRevealOnce<HTMLDivElement>()
  const ownerRef = useRevealOnce<HTMLAnchorElement>()

  return (
    <div className={GUEST_CLS.root}>
      <SEO title={t('guest.shop.seo', { defaultValue: '유어샵 - 유어딜' })} url="/u/me" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.shop.title', { defaultValue: GUEST_COPY.shop.title })}
      </h1>

      <div className={GUEST_CLS.shopBody} data-guest="urshop">
        <h2 className={GUEST_CLS.shopHeadline}>
          {t('guest.shop.headline1', { defaultValue: GUEST_COPY.shop.headline1 })}<br />
          <MarkedLine line={t('guest.shop.headline2', { defaultValue: GUEST_COPY.shop.headline2 })} mark={GUEST_COPY.shop.headline2Mark} />
        </h2>
        <p className={GUEST_CLS.shopSub}>
          {t('guest.shop.sub', { defaultValue: GUEST_COPY.shop.sub })}
        </p>

        {pins.length > 0 && (
          <section className={`mt-5 rounded-2xl px-4 pt-4 pb-1${hide}${waiting ? '' : ' ur-gs-shelf'}`} aria-hidden={waiting || undefined} aria-label={t('guest.shop.example', { defaultValue: '예시' })}>
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
            <div className="ur-gs-rows divide-y divide-rule">
              {pins.map((p, i) => <ExamplePin key={p.id} p={p} n={i + 1} />)}
            </div>
          </section>
        )}
        {pins.length > 0 && (
          <p className={`mt-3 flex items-center gap-2 px-1 text-[13px] text-gray-500 dark:text-gray-400${hide}`} aria-hidden={waiting || undefined}>
            <span>{t('guest.shop.linkLabel', { defaultValue: '프로필 링크' })}</span>
            <span className="font-medium text-brand-text" aria-label="urdeal.kr/u/udal">urdeal.kr/u/{typed.text}{!typed.done && <span className="ur-gs-caret" aria-hidden="true" />}</span>
            {typed.done && (
              <span className="ur-gs-chips inline-flex gap-1" aria-hidden="true">
                <i style={{ background: 'linear-gradient(45deg, rgb(249,206,52), rgb(238,42,123), rgb(98,40,215))' }} />
                <i style={{ background: 'rgb(255,0,0)' }} />
                <i style={{ background: 'rgb(3,199,90)' }} />
              </span>
            )}
          </p>
        )}


        <div ref={benefitsRef} className="mt-6 ur-gs-reveal">
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

        <Link ref={ownerRef} to="/partners" className="ur-gs-reveal-one mt-6 flex items-center gap-3 rounded-2xl px-4 py-4 active:opacity-80">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center">
            <StoreIcon size={ICON} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{t('guest.owner.title', { defaultValue: '사장님이세요?' })}</span>
            <span className="block mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('guest.owner.desc', { defaultValue: '내 가게 이용권을 등록하고 팔아 보세요' })}</span>
          </span>
          <ChevronRight className="ur-gs-chev w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
