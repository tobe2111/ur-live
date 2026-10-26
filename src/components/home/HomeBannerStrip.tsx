import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { runAfterLoad } from '@/lib/after-load'
import { resolveBannerLink, type BannerLink } from './banner-link'
import { useHomeBanners, type HomeBanner } from './useHomeBanners'
import type { BannerSlot } from '@/shared/constants/home-showcase'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'
import { STRIP_BANNER_MAX, STRIP_CLS, HERO_CARD_CLS, HERO_RAIL_CLS, stripBannerImageUrl, heroEdgeFillStyle } from '@/shared/home-strip-banners'

/**
 * 🏠 ③ 중간 배너 (2026-08-04 대표 시안 승인).
 *
 * `inline` = 3열 프로모션, `wide` = 가로 전체 한 줄. 섹션 사이에 놓인다.
 *
 * 📐 **가로 여백(max-w·px)은 갖지 않는다** — 홈 컨테이너 안에 놓이므로 여기서 또 주면
 *    안쪽으로 한 겹 더 들어가 다른 블록과 좌우가 어긋난다. 세로는 **아래쪽(pb)만** —
 *    위가 아니라 아래여야 아무것도 안 그려질 때 유령 여백이 남지 않는다.
 *
 * 🚫 **등록된 배너가 없으면 아무것도 안 그린다**(대표 확정 규칙 — "올리지 않으면 아예
 *    보이지 않도록"). 제목만 남거나 회색 자리가 생기지 않고 레이아웃이 위로 붙는다.
 *
 * 배경은 이미지가 있으면 이미지, 없으면 잉크 톤 단색이다. 배너 문구가 사진 위에서
 * 안 읽히는 사고를 막으려고 어두운 오버레이를 항상 깐다 — 어떤 사진이 올라올지 모른다.
 */

/**
 * 스트립 항목 사이 간격(px). 스크롤러의 `gap-7` 과 **같은 값이어야** 몇 번째 장인지 계산이 맞는다.
 *
 * 🩸 **거터의 두 배(14×2=28)여야 한다** — `gap-3`(12) 이면 다음 장이 오른쪽 거터 안으로 **2px 삐져나온다**
 *    (실측: 카드 14..376 · 다음 장 388 시작 · 화면 390). 간격이 거터 두 벌이면 다음 장이 정확히 화면 밖
 *    (404)에서 시작해 **한 장씩 꽉**(대표 확정 ③)이 글자 그대로 성립한다.
 */
const STRIP_GAP_PX = 28

export function bannerLink(b: HomeBanner): BannerLink {
  return resolveBannerLink(b.link_url, typeof window !== 'undefined' ? window.location.hostname : undefined)
}

/**
 * 링크가 있으면 카드 **전체**가 누르는 자리다 — 우리 주소는 앱 안 이동(`<Link>`), 남의 주소는 새 탭.
 * `clone` 은 순환용 복제 카드(아래 StripRail) — 스크린리더·탭 순서에서 뺀다.
 */
export function BannerWrap({ link, className, style, clone, children }: { link: BannerLink; className: string; style?: React.CSSProperties; clone?: boolean; children: React.ReactNode }) {
  const a11y = clone ? { 'aria-hidden': true as const, tabIndex: -1 } : {}
  if (link?.kind === 'internal') return <Link to={link.to} className={className} style={style} {...a11y}>{children}</Link>
  if (link?.kind === 'external') return <a href={link.href} target="_blank" rel="noopener noreferrer" className={className} style={style} {...a11y}>{children}</a>
  return <div className={className} style={style} {...a11y}>{children}</div>
}

export default function HomeBannerStrip({ variant }: { variant: Extract<BannerSlot, 'strip' | 'inline' | 'wide' | 'vouchers'> }) {
  const banners = useHomeBanners(variant)
  if (banners.length === 0) return null

  /**
   * 🎫 2026-09-05 (대표 "인기 이용권 섹션 위에 배너가 작게" → 시안 **안 3 확정**):
   *   첫 섹션 **위** 옆으로 넘기는 스트립. 렌더는 `StripRail`(아래) 이 맡는다.
   *   ⚠️ 안 2(가로 카드)로 먼저 만들었다가 대표 확정으로 안 3 으로 바꿨다 — 안 2 를 되살리지 말 것.
   */
  if (variant === 'strip') {
    return <StripRail banners={banners.slice(0, STRIP_BANNER_MAX)} />
  }
  // 🎟️ 2026-10-14 교환권 페이지 상단(대표 확정 라안) — 같은 캐러셀을 **한 장씩**(PC 도). PC 는 4:1.
  if (variant === 'vouchers') {
    return <StripRail banners={banners.slice(0, STRIP_BANNER_MAX)} single />
  }

  if (variant === 'wide') {
    const b = banners[0]
    const link = bannerLink(b)
    const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.wide.requestWidth, quality: 76 }) : ''
    return (
      <div className="pb-6">
        <BannerWrap
          link={link}
          className="relative block overflow-hidden rounded-xl isolate min-h-[104px] flex items-center justify-between gap-5 px-6 py-5 bg-gray-900 dark:bg-[#1D1F29] transition-transform hover:scale-[1.004]"
        >
          {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-black/25" aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block text-[17px] font-bold tracking-tight text-white">{b.title}</strong>
            {b.description && <span className="block mt-1 text-[13px] text-white/80">{b.description}</span>}
          </div>
          {link && (
            <span className="shrink-0 px-5 py-2 rounded-lg bg-brand text-white text-[13px] font-medium">
              바로가기
            </span>
          )}
        </BannerWrap>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* 📐 열 수를 **개수에 맞춘다** — 1장을 3열 그리드에 두면 1/3 폭에 홀로 서서
          가로로 긴 홍보 이미지가 잘린다(2026-08-04 대표 신고 화면이 정확히 그랬다). */}
      <div className={`grid gap-3 ${
        banners.length === 1 ? 'grid-cols-1'
        : banners.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {banners.slice(0, 3).map(b => {
          const link = bannerLink(b)
          const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.inline.requestWidth, quality: 76 }) : ''
          return (
            <BannerWrap
              key={b.id}
              link={link}
              className="relative block overflow-hidden rounded-xl isolate min-h-[96px] flex flex-col justify-center px-5 py-4 bg-gray-800 dark:bg-[#1D1F29] transition-transform hover:scale-[1.008]"
            >
              {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/60 to-black/40" aria-hidden="true" />
              {b.description && (
                <small className="block mb-1 text-[12px] font-medium tracking-wide text-white/80">{b.description}</small>
              )}
              <strong className="text-[15px] font-bold leading-snug tracking-tight text-white">{b.title}</strong>
            </BannerWrap>
          )
        })}
      </div>
    </div>
  )
}


/**
 * 🎫 상단 배너 — 거터 안에서 한 장씩 넘기는 2:1 캐러셀 (2026-10-12 대표 확정).
 *
 * ## 2026-10-12 — 96px 띠 → 2:1 배너 (대표 지시 셋을 한 번에)
 * 대표가 NOL·리뷰노트 화면을 보내며 *"이정도 배너 퀄리티는 되어야 하지 않나?"* → 시안 다섯(틀) →
 * *"디자인은 E 정도가 좋은데 … 밑에 지금 인기 이용권이랑 되게 따로 노는 느낌"* → 리듬 맞춘 시안 넷 →
 * *"배너가 너무 화면에 가득 찼다 여백은 좀 있어야지"* + *"좌우로 넘기는 거 자연스럽고 부드럽게"*.
 *
 * 세 가지가 바뀌었다(종전 2026-09-05 "안 3" 을 **대체**한다):
 *   ① **96px 띠 → 2:1** — NOL/리뷰노트 체급. 글자 세 줄(제목 2줄 + 부제 + 버튼)이 들어가는 최소 높이다.
 *   ② **전폭 → 거터 14px** — "따로 논다"의 원인이 크기가 아니라 **리듬**이었다(라이브 실측:
 *      `지금 인기 이용권` 패널은 모서리 14px·안쪽 거터 14px 인데 배너만 전폭·모서리 16px 였다).
 *      ⚠️ 이 14 는 임의값이 아니라 `.ur-home-panel` 의 모바일 값과 같아야 한다 — 어긋나면 다시 따로 논다.
 *   ③ **74% + 다음 장 살짝 보이기 → 한 장씩 꽉** — 대표가 "가득 찼다"고 한 뒤라 요소를 더하지 않는다.
 *      (리뷰노트도 미리보기 없이 한 장씩이다.)
 *
 * ## 장수 표시 = 배너 **안**의 숫자 알약 (2026-10-12 대표 확정 "2로 가자")
 * 대표가 `1 / 4` 알약 화면을 보내며 *"숫자가 이렇게 들어가는거야 형태는"* → 시안 셋(숫자+점 / 숫자만 /
 * 진행 바) 중 **숫자만**. 종전 아래쪽 점 줄을 **대체한다** — 점을 되살리지 말 것.
 *   - 배너 **밖**에 줄을 하나 더 두면 세로를 10px 더 먹고, 그게 "따로 논다"를 만든 바로 그 종류의 층이다.
 *   - 🔑 **누를 수 있게 유지한다** — 점이 갖고 있던 조작(탭으로 다음 장)을 잃지 않는다. 숫자만 두고
 *     조작을 빼면 손가락 스와이프를 모르는 사람에게 둘째 장이 **영원히 안 보인다**.
 *   - 자리는 오른쪽 아래(`right-[26px]` = 거터 14 + 안쪽 12). 왼쪽 아래는 `자세히 보기` 버튼 자리다.
 *
 * ## 왜 JS 캐러셀이 아닌가 (2026-09-05 판단 — 그대로 유효)
 * 네이티브 가로 스크롤 + CSS `scroll-snap` 이면 **라이브러리 0**으로 손가락 감각이 그대로 나온다.
 * 관성·고무줄·접근성(키보드 스크롤)까지 브라우저가 이미 갖고 있는 것을 다시 만들 이유가 없다.
 * "부드럽게"를 위해 더한 것은 셋뿐이다:
 *   - `scroll-smooth` — **점을 눌렀을 때** 미끄러지듯 간다(손가락 스와이프는 원래 네이티브라 안 거친다).
 *   - `overscroll-x-contain` — 끝에서 더 밀어도 **페이지가 따라 움직이거나 브라우저 뒤로가기가 걸리지 않는다.**
 *   - `scroll-px-3.5` — 거터가 있는 스크롤러는 스냅 기준점도 그만큼 밀어 줘야 카드가 거터에 딱 선다.
 *
 * ## 자동 넘김 (2026-10-12 대표 *"자동으로 넘어가게 해줘"* — 종전 "자동 재생 안 함"을 **대체**)
 * 4.5초마다 한 장. 대신 읽는 사람을 방해하지 않게 네 가지에서는 멈춘다:
 *   ① 일시정지 버튼(숫자 알약 왼쪽) — WCAG 2.2.2: 5초 넘게 움직이는 것은 멈출 수 있어야 한다.
 *   ② 손가락·휠이 닿으면 8초 멈춘다 — 바로 움직이면 방금 고른 장을 빼앗는다.
 *   ③ 화면 밖이거나 탭이 숨겨졌을 때 — 아래로 내려 읽는 사람 머리 위에서 혼자 돌 이유가 없다.
 *   ④ `prefers-reduced-motion` — 동작 줄이기를 켠 사람에겐 아예 안 움직이고 버튼도 안 보인다.
 *
 * ## 글자 = 흰색 · 왼쪽 아래 (2026-10-13 대표 *"제주·강원 모두 폰트 흰색 … 글자 위치가 더 내려가야 …
 *    야놀자 스러워야"*) — 2026-10-12 의 "그림 밝기로 글자색 고르기"(`banner-ink.ts`, 이번에 삭제)를 **대체**한다.
 * 배너가 일러스트에서 **실사 사진**(지역별)으로 바뀌자 밝기 판정이 하늘·바다 같은 밝은 면을 보고
 * 짙은 글자를 골라, 같은 줄의 배너가 장마다 다른 글자색이 됐다. 사진 배너의 문법(야놀자·NOL)은
 * 하나다 — **아래쪽만 어둡게 깔고 흰 글자를 왼쪽 아래에.** 그래서 글자색을 고르지 않는다.
 *
 * ## 마지막 장 다음은 첫 장 (2026-10-13 대표 *"마지막페이지에서 또 오른쪽으로 넘기면 첫페이지로"*)
 * 네이티브 스크롤은 끝에서 멈춘다. 그래서 맨 뒤에 **첫 장의 복제**를 하나 두고, 복제에 도착해
 * 멈추면 보이지 않게(애니메이션 없이) 진짜 첫 장 위치로 옮긴다 — 복제와 첫 장이 같은 그림이라
 * 눈에는 이어 넘어간 것으로 보인다. 손가락·숫자 알약·자동 넘김 셋이 같은 길을 쓴다.
 */
/** 한 장에 머무는 시간(ms). */
const AUTO_ADVANCE_MS = 4500
const WARM_BEFORE_ADVANCE_MS = 1500  // 자동 넘김 이만큼 전에 다음 장 사진을 받기 시작한다
/** 손가락을 뗀 뒤 다시 움직이기까지(ms). */
const RESUME_AFTER_TOUCH_MS = 8000

/**
 * 🖥️ PC(lg+) 는 **한 줄에 세 장**(2026-10-13 대표 확정 "시안 a"). 모바일과 같은 2:1 한 장을 PC 폭에 그대로
 *   두면 1440px 에서 높이가 약 670px — 대표 *"너무 무식하게 배너가 크다"*. 세 장이면 약 215px 이다.
 *   ⚠️ `tailwind lg` 와 같은 경계(1024px)여야 카드 폭 클래스와 순환 계산이 같은 화면을 본다.
 */
const PC_QUERY = '(min-width: 1024px)'
const PC_PER_VIEW = 3
/** PC 카드 폭 = (칸 − `STRIP_GAP_PX`(28) 둘) ÷ 3. 모바일은 카드 자신의 w-full. */
const PC_CARD_W = STRIP_CLS.pcCardW

function usePerView(): number {
  const read = () => (typeof window !== 'undefined' && window.matchMedia?.(PC_QUERY).matches ? PC_PER_VIEW : 1)
  const [n, setN] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(PC_QUERY)
    const on = () => setN(mq.matches ? PC_PER_VIEW : 1)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return n
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * `single` — PC 에서도 한 장씩(교환권 페이지 라안). 카드 폭은 칸 전체, 높이는 4:1 로 낮춘다
 *   (2:1 로 두면 PC 목록 칸 1,100px 에 550px 짜리 배너가 서서 목록이 첫 화면에서 사라진다).
 */
function StripRail({ banners, single = false, hero = false }: { banners: HomeBanner[]; single?: boolean; hero?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [heldUntil, setHeldUntil] = useState(0)
  const [onScreen, setOnScreen] = useState(true)
  const [reduceMotion] = useState(prefersReducedMotion)
  const many = banners.length > 1
  /**
   * 🏁 2026-10-19 (대표 *"홈 부분 최대한 신경써서 우선적으로"*) — 첫 화면 밖 배너 사진은 페이지가 다 뜬 뒤에 받는다.
   *   가로 캐러셀 안의 `loading="lazy"` 는 **가로로 옆에 있는** 2·3장을 "곧 보일 것" 으로 보고 첫 화면과 같이 받았다
   *   (라이브 실측 — 장당 ~45KB, 첫 장(LCP)·카드 사진과 회선을 나눠 썼다). 넘기기 전엔 안 보이므로
   *   `load` 뒤 + 한가할 때로 미룬다. 손이 닿거나 자동 넘김이 다가오면 그 즉시 받는다(빈 장이 보이지 않게).
   */
  const [warm, setWarm] = useState(false)
  useEffect(() => (many ? runAfterLoad(() => setWarm(true)) : undefined), [many])
  const pcPerView = usePerView()
  const perView = single ? 1 : pcPerView  // 머리(hero)는 폰 전용이라 pcPerView 가 이미 1 이다

  /**
   * 순환용 — 맨 뒤에 **한 화면만큼**(모바일 1장 · PC 3장) 앞쪽 복제를 둔다. 복제 구간의 첫 칸에 서면
   * 화면이 처음과 똑같으므로, 거기서 애니메이션 없이 진짜 앞쪽으로 옮겨도 눈에 안 보인다.
   */
  const slides = many ? [...banners, ...banners.slice(0, perView)] : banners
  const settleRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(settleRef.current), [])

  const stepPx = () => {
    const first = railRef.current?.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + (hero ? 0 : STRIP_GAP_PX) : 0  // 머리(hero)는 간격 없이 끝에서 끝까지
  }

  /** 숫자는 스크롤 위치에서 파생한다 — 상태를 따로 들고 있으면 손가락과 어긋난다. */
  const onScroll = () => {
    const el = railRef.current
    const step = stepPx()
    if (!el || !step) return
    const i = Math.round(el.scrollLeft / step)
    // 복제 칸(i === 길이)은 첫 장이다 — 숫자는 `1 / N` 으로 보인다.
    setActive(i >= banners.length ? 0 : Math.max(0, i))
    // 복제에 **멈추면** 진짜 첫 장으로 순간이동(스크롤이 끝난 뒤에만 — 도중에 옮기면 손가락과 싸운다).
    window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      const at = Math.round(el.scrollLeft / step)
      if (at >= banners.length) jumpTo(at - banners.length)
    }, 140)
  }

  /** 애니메이션 없이 옮긴다 — `scroll-smooth` 를 잠깐 끄지 않으면 거꾸로 감기는 게 보인다. */
  const jumpTo = (i: number) => {
    const el = railRef.current
    const step = stepPx()
    if (!el || !step) return
    el.style.scrollBehavior = 'auto'
    el.scrollLeft = i * step
    requestAnimationFrame(() => { el.style.scrollBehavior = '' })
  }

  /**
   * 🖱️ 이전 — 첫 장에서 왼쪽이면 복제 구간(처음과 똑같은 화면)으로 순간이동한 뒤 한 칸 미끄러진다.
   *   PC 는 마우스라 가로로 밀 방법이 없어서(대표 *"좌우 스크롤도 안되고"*) 화살표가 유일한 조작이다.
   */
  const goPrev = () => {
    hold()
    if (active > 0) return goTo(active - 1)
    jumpTo(banners.length)
    requestAnimationFrame(() => goTo(banners.length - 1))
  }
  const goNext = () => { hold(); goTo(active + 1) }

  /** 숫자를 누르면 다음 장으로 **미끄러지듯** 간다(`scroll-smooth`). */
  const goTo = (i: number) => {
    const el = railRef.current
    const step = stepPx()
    if (!el || !step) return
    el.scrollTo({ left: i * step, behavior: 'smooth' })
  }

  // ③ 화면 밖이면 안 넘긴다.
  useEffect(() => {
    const el = rootRef.current
    if (!many || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting && e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [many])

  // 자동 넘김 — 장이 바뀔 때마다(손으로 넘겨도) 타이머를 새로 건다.
  useEffect(() => {
    if (!many || paused || reduceMotion || !onScreen) return
    const wait = Math.max(AUTO_ADVANCE_MS, heldUntil - Date.now())
    const pre = window.setTimeout(() => setWarm(true), Math.max(0, wait - WARM_BEFORE_ADVANCE_MS))  // 넘기기 전에 다음 장을 받아 둔다
    const t = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      goTo(active + 1) // 마지막 장 다음은 복제(= 첫 장) — 도착하면 onScroll 이 진짜 첫 장으로 옮긴다
    }, wait)
    return () => { window.clearTimeout(t); window.clearTimeout(pre) }
  }, [many, paused, reduceMotion, onScreen, active, heldUntil, banners.length])

  // ② 손가락이 닿으면 멈춘다(그리고 옆 장 사진을 바로 받는다).
  const hold = () => { setWarm(true); setHeldUntil(Date.now() + RESUME_AFTER_TOUCH_MS) }

  return (
    <div ref={rootRef} className={STRIP_CLS.root} aria-roledescription="carousel" aria-label="이벤트 배너">
      {/* 숫자 알약이 배너 **안**에 떠야 하므로 레일을 포함 블록으로 삼는다(스크롤러 자신에 주면 함께 스크롤된다). */}
      <div className="relative">
        <div
          ref={railRef}
          onScroll={many ? onScroll : undefined}
          onPointerDown={many ? hold : undefined}
          onWheel={many ? hold : undefined}
          className={`${STRIP_CLS.rail} ${many ? STRIP_CLS.railMany : ''} ${hero ? HERO_RAIL_CLS : ''}`}
        >
          {slides.map((b, i) => <StripCard hero={hero} single={single} key={i >= banners.length ? `clone-${i}` : b.id} b={b} many={many} first={i < perView} clone={i >= banners.length} deferImg={!warm && i >= perView} />)}
        </div>
      {many && (
        <>
          {/* 🖥️ PC 좌우 화살표 — 마우스엔 가로 스와이프가 없다. 모바일은 손가락이 있어 숨긴다. */}
          <button type="button" onClick={goPrev} aria-label="이전 배너"
            className="hidden lg:grid absolute left-0 top-1/2 -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white text-gray-900 shadow-lift dark:bg-white dark:text-gray-900">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" onClick={goNext} aria-label="다음 배너"
            className="hidden lg:grid absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 place-items-center rounded-full bg-white text-gray-900 shadow-lift dark:bg-white dark:text-gray-900">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
      {many && (
        <div className={`absolute right-[26px] ${single ? 'top-2' : 'bottom-3'} flex items-center gap-2 ${hero ? HERO_COUNTER_CLS : ''}`}>{/* 🎟️ 교환권 띠: 아래 오른쪽은 그림(유달이·상품) 자리라 넘김 버튼은 위로 */}
          {!reduceMotion && (
            <button
              type="button"
              onClick={() => setPaused(p => !p)}
              aria-label={paused ? '배너 자동 넘김 다시 시작' : '배너 자동 넘김 멈춤'}
              className="h-6 w-6 grid place-items-center rounded-full text-white bg-black/30 backdrop-blur-[6px]"
            >
              {paused ? (
                <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true"><path d="M1 1l7 4-7 4z" fill="currentColor" /></svg>
              ) : (
                <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true"><path d="M1 1v8M7 1v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label={`다음 배너 (${active + 1} / ${banners.length})`}
            className="px-2 py-1 rounded-full text-[12px] font-medium tabular-nums text-white bg-black/30 backdrop-blur-[6px]"
          >
            {active + 1} / {banners.length}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

/**
 * 🎟️ 교환권 띠(single) — 2026-10-14 모바일 나안: 폰·PC 모두 4:1. 폰은 높이가 ~90px 라 설명 줄까지
 *   들어가면 넘친다 → 설명(`span`)은 PC 에서만 보인다(제목 한 줄이 이름표다).
 *   📏 같은 날 대표 *"문장은 한줄로 맞춰줘"*: 제목은 **언제나 한 줄**(폰 15px · PC 24px, 폭 72%).
 *   오른쪽 28% 는 그림(유달이·상품)의 자리라 글자가 거기까지 가지 않는다.
 *   ✂️ 같은 날 대표 *"한줄로 끝내거나, 아니면 차곡차곡 모은 딜로 / 커피 어때요? 이렇게 2줄로. 지금 애매하게 끊기잖아"*:
 *   72% 한 줄은 유달이(그림 56~76%) 위로 글자가 덮였다. ⇒ 폭은 **54%**(유달이 왼쪽까지), 줄은 **최대 두 줄**,
 *   끊는 자리는 **제목에 적은 줄바꿈**이 정한다(`whitespace-pre-line`) — 어드민 제목에 Enter 를 넣으면 그 자리에서 끊긴다.
 *   줄바꿈 없는 제목이 넘치면 **낱말 단위로만** 넘어간다(`keep-all` — 한글 글자 중간에서 끊지 않는다).
 *   ↕️ 같은 날 대표 *"글자를 높이 기준으로 중앙에"*: 띠는 낮아서(폰 ~90px) 글자를 세로 가운데에 둔다.
 *   아래를 어둡게 까는 막(`div` scrim)은 띠에선 뺀다 — 글자가 아래에 있지 않으니 받칠 게 없고,
 *   남겨 두면 오른쪽 아래 상품 카드만 칙칙해진다(라이브에서 확인).
 */
/**
 * 🎟️ 교환권 **머리 배너** (2026-10-14 대표 확정 안 C "배너가 머리" — 모바일). 같은 캐러셀을 화면 끝에서 끝까지,
 *   높이 196px 로 쓴다. 위 오른쪽엔 검색·보관함이 떠 있고 아래 28px 엔 잔액 카드가 걸쳐 올라온다
 *   (`pages/vouchers/VouchersHero`). 그래서 글자는 **왼쪽 위**(아이콘 줄 아래)에 서고 숫자 알약도 왼쪽 위로 간다.
 *   사진은 **오른쪽에 붙여** 자른다 — 4:1 그림의 주인공(유달이·상품)이 오른쪽 28% 에 있다(`BANNER_SLOT_SPECS.vouchers`).
 *   기존 클래스를 덮어쓰는 방식(`!`)이라 홈 배너·교환권 PC 띠의 클래스 문자열은 한 글자도 안 바뀐다.
 *   ⚠️ 196 은 `VOUCHERS_HERO_CLS.hero`(예약 판)·서버 첫 화면과 같은 값이어야 한다 — 시험이 대조한다.
 */
// 🎟️ 2026-10-18 머리 카드·레일 클래스는 `shared/home-strip-banners.ts` 로 옮겼다 — 서버 첫 화면(`worker/utils/vouchers-first-screen.ts`)이 같은 상수로 그린다.
export { HERO_CARD_CLS }
const HERO_COUNTER_CLS = '!right-auto !bottom-auto left-4 !top-3'  // top·bottom 둘 다 걸리면 세로로 늘어나 알약이 가운데로 온다(실측)

/** 머리 배너 — 교환권 페이지 맨 위(모바일). 0장이면 부르는 쪽이 안 그린다. */
export function BannerHeroRail({ banners }: { banners: HomeBanner[] }) {
  return <StripRail banners={banners.slice(0, STRIP_BANNER_MAX)} hero />
}

const SINGLE_CARD_CLS = '!aspect-[4/1] lg:!w-full !py-3 [&>span]:hidden lg:[&>span]:block [&>strong]:!max-w-[54%] [&>strong]:!line-clamp-2 [&>strong]:!whitespace-pre-line [&>strong]:![word-break:keep-all] [&>strong]:!leading-snug [&>strong]:!text-[15px] lg:[&>strong]:!text-[24px] !justify-center [&>div]:hidden'

/** 카드 한 장 — 흰 글자를 왼쪽 아래에(야놀자 문법). 카드 전체가 누르는 자리다. */
function StripCard({ b, many, first, clone, single = false, hero = false, deferImg = false }: { b: HomeBanner; many: boolean; first: boolean; clone?: boolean; single?: boolean; hero?: boolean; deferImg?: boolean }) {
  const link = bannerLink(b)
  const bg = stripBannerImageUrl(b.image_url, single || hero ? 'vouchers' : 'strip')  // 서버 첫 화면과 같은 URL(같은 함수) — 갈리면 사진을 두 번 받는다
  return (
    <BannerWrap
      link={link}
      clone={clone}
      /* 📐 거터(14) 안에서 **한 장이 꽉**. 모서리 14px 는 `.ur-home-panel`(모바일) 과 같은 값이다.
         🩸 `w-[calc(100%-1.75rem)]` 로 쓰면 **거터가 두 번 빠진다** — `w-full` 이 맞다(= 362 × 181, 2:1).
         📍 `justify-end` + 아래 여백 — 글자가 카드 **아래**에 앉는다(가운데에 뜨면 사진의 주인공을 가린다). */
      /* shape-lock-ok — 14px 는 임의값이 아니라 `.ur-home-panel`(모바일) 의 radius 와 **같은 값**이다. */
      className={`relative ${many ? STRIP_CLS.cardMany : STRIP_CLS.cardOne} ${many ? PC_CARD_W : ''} ${STRIP_CLS.card} ${single ? SINGLE_CARD_CLS : ''} ${hero ? HERO_CARD_CLS : ''}`}
      /* 🎨 사진이 없으면 **브랜드 면**(대표 확정 "E"). */
      style={bg ? (hero ? heroEdgeFillStyle(bg) : undefined) : { background: 'var(--brand-grad)' }}
    >
      {bg && !deferImg && (
        <img
          src={bg} alt="" aria-hidden="true"
          loading={first ? 'eager' : 'lazy'}
          fetchPriority={first ? 'high' : 'auto'}
          decoding="async"
          className={STRIP_CLS.img}
          onError={(e) => cfImageOnError(e.currentTarget, b.image_url)}
        />
      )}
      {/* 아래쪽만 어둡게 — 흰 글자 자리를 받친다. 위쪽 사진은 그대로 둔다(전면을 덮으면 사진이 탁해진다). */}
      {bg && <div className={STRIP_CLS.scrim} aria-hidden="true" />}
      {/* 📏 2026-10-14 대표 "배너 속 글자 크기들이 커" — 제목 24→17 · 설명 13→12. 사진이 주인공이고 글자는 이름표다. */}
      {/* 글자는 **늘 흰색** — 테마가 아니라 사진 위에 서므로 dark: 짝도 같은 값이다. 오른쪽 아래 숫자 알약 자리를 비운다(max-w). */}
      <strong className={STRIP_CLS.title}>{b.title}</strong>
      {b.description && (
        <span className={STRIP_CLS.desc}>{b.description}</span>
      )}
    </BannerWrap>
  )
}
