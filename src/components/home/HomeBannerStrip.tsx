import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useHomeBanners, type HomeBanner } from './useHomeBanners'
import type { BannerSlot } from '@/shared/constants/home-showcase'
import { inkForLuminance, measureTitleLuminance, type BannerInk } from './banner-ink'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'

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

function bannerHref(b: HomeBanner): string {
  return b.link_url ? safeInternalPath(b.link_url, '') : ''
}

function Wrap({ href, className, style, children }: { href: string; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return href
    ? <Link to={href} className={className} style={style}>{children}</Link>
    : <div className={className} style={style}>{children}</div>
}

export default function HomeBannerStrip({ variant }: { variant: Extract<BannerSlot, 'strip' | 'inline' | 'wide'> }) {
  const banners = useHomeBanners(variant)
  if (banners.length === 0) return null

  /**
   * 🎫 2026-09-05 (대표 "인기 이용권 섹션 위에 배너가 작게" → 시안 **안 3 확정**):
   *   첫 섹션 **위** 옆으로 넘기는 스트립. 렌더는 `StripRail`(아래) 이 맡는다.
   *   ⚠️ 안 2(가로 카드)로 먼저 만들었다가 대표 확정으로 안 3 으로 바꿨다 — 안 2 를 되살리지 말 것.
   */
  if (variant === 'strip') {
    return <StripRail banners={banners.slice(0, 5)} />
  }

  if (variant === 'wide') {
    const b = banners[0]
    const href = bannerHref(b)
    const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.wide.requestWidth, quality: 76 }) : ''
    return (
      <div className="pb-6">
        <Wrap
          href={href}
          className="relative block overflow-hidden rounded-xl isolate min-h-[104px] flex items-center justify-between gap-5 px-6 py-5 bg-gray-900 dark:bg-[#1D1F29] transition-transform hover:scale-[1.004]"
        >
          {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-black/25" aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block text-[17px] font-black tracking-tight text-white">{b.title}</strong>
            {b.description && <span className="block mt-1 text-[13px] text-white/80">{b.description}</span>}
          </div>
          {href && (
            <span className="shrink-0 px-5 py-2 rounded-lg bg-brand text-white text-[13px] font-bold">
              바로가기
            </span>
          )}
        </Wrap>
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
          const href = bannerHref(b)
          const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.inline.requestWidth, quality: 76 }) : ''
          return (
            <Wrap
              key={b.id}
              href={href}
              className="relative block overflow-hidden rounded-xl isolate min-h-[96px] flex flex-col justify-center px-5 py-4 bg-gray-800 dark:bg-[#1D1F29] transition-transform hover:scale-[1.008]"
            >
              {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/60 to-black/40" aria-hidden="true" />
              {b.description && (
                <small className="block mb-1 text-[12px] font-bold tracking-wide text-white/80">{b.description}</small>
              )}
              <strong className="text-[15px] font-bold leading-snug tracking-tight text-white">{b.title}</strong>
            </Wrap>
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
 * ## 글자색은 그림이 정한다 (2026-10-12 대표 *"배경을 그라데이션으로 하니까 촌스러운데"*)
 * 파스텔 그림 위에 검은 스크림을 덮으면 그림이 탁해진다. 그림 왼쪽 아래(글자 자리) 밝기를 재서
 * 밝으면 짙은 글자 + 스크림 없음, 어두우면 흰 글자 + 종전 스크림(`banner-ink.ts`).
 */
/** 한 장에 머무는 시간(ms). */
const AUTO_ADVANCE_MS = 4500
/** 손가락을 뗀 뒤 다시 움직이기까지(ms). */
const RESUME_AFTER_TOUCH_MS = 8000

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function StripRail({ banners }: { banners: HomeBanner[] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [heldUntil, setHeldUntil] = useState(0)
  const [onScreen, setOnScreen] = useState(true)
  const [reduceMotion] = useState(prefersReducedMotion)
  const many = banners.length > 1

  const stepPx = () => {
    const first = railRef.current?.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + STRIP_GAP_PX : 0
  }

  /** 숫자는 스크롤 위치에서 파생한다 — 상태를 따로 들고 있으면 손가락과 어긋난다. */
  const onScroll = () => {
    const el = railRef.current
    const step = stepPx()
    if (!el || !step) return
    const i = Math.round(el.scrollLeft / step)
    setActive(Math.max(0, Math.min(banners.length - 1, i)))
  }

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
    const t = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      goTo(active + 1 >= banners.length ? 0 : active + 1)
    }, wait)
    return () => window.clearTimeout(t)
  }, [many, paused, reduceMotion, onScreen, active, heldUntil, banners.length])

  // ② 손가락이 닿으면 멈춘다.
  const hold = () => setHeldUntil(Date.now() + RESUME_AFTER_TOUCH_MS)

  return (
    <div ref={rootRef} className="pb-4" aria-roledescription="carousel" aria-label="이벤트 배너">
      {/* 숫자 알약이 배너 **안**에 떠야 하므로 레일을 포함 블록으로 삼는다(스크롤러 자신에 주면 함께 스크롤된다). */}
      <div className="relative">
        <div
          ref={railRef}
          onScroll={many ? onScroll : undefined}
          onPointerDown={many ? hold : undefined}
          onWheel={many ? hold : undefined}
          className={`flex gap-7 px-[14px] ${many ? 'overflow-x-auto snap-x snap-mandatory scroll-px-[14px] scroll-smooth overscroll-x-contain scrollbar-hide' : ''}`}
        >
          {banners.map((b, i) => <StripCard key={b.id} b={b} many={many} first={i === 0} />)}
        </div>
      {many && (
        <div className="absolute right-[26px] bottom-3 flex items-center gap-2">
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
            onClick={() => goTo((active + 1) % banners.length)}
            aria-label={`다음 배너 (${active + 1} / ${banners.length})`}
            className="px-2 py-1 rounded-full text-[12px] font-semibold tabular-nums text-white bg-black/30 backdrop-blur-[6px]"
          >
            {active + 1} / {banners.length}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

/** 카드 한 장. 글자색은 그림 밝기로 정한다(`banner-ink.ts`). */
function StripCard({ b, many, first }: { b: HomeBanner; many: boolean; first: boolean }) {
  const href = bannerHref(b)
  const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.strip.requestWidth, quality: 76 }) : ''
  const [ink, setInk] = useState<BannerInk>('light')
  const dark = !!bg && ink === 'dark'
  return (
    <Wrap
      href={href}
      /* 📐 거터(14) 안에서 **한 장이 꽉**. 모서리 14px 는 `.ur-home-panel`(모바일) 과 같은 값이다.
         🩸 `w-[calc(100%-1.75rem)]` 로 쓰면 **거터가 두 번 빠진다** — `w-full` 이 맞다(= 362 × 181, 2:1). */
      /* shape-lock-ok — 14px 는 임의값이 아니라 `.ur-home-panel`(모바일) 의 radius 와 **같은 값**이다. */
      className={`relative ${many ? 'snap-start shrink-0 w-full' : 'flex-1'} overflow-hidden rounded-[14px] isolate aspect-[2/1] flex flex-col justify-center px-5 py-4 transition-transform active:scale-[.995]`} /* shape-lock-ok (위 사유) */
      /* 🎨 사진이 없으면 **브랜드 면**(대표 확정 "E"). */
      style={bg ? undefined : { background: 'var(--brand-grad)' }}
    >
      {bg && (
        <img
          src={bg} alt="" aria-hidden="true"
          loading={first ? 'eager' : 'lazy'}
          fetchPriority={first ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 -z-10 w-full h-full object-cover"
          onLoad={(e) => { const L = measureTitleLuminance(e.currentTarget); if (L != null) setInk(inkForLuminance(L)) }}
          onError={(e) => cfImageOnError(e.currentTarget, b.image_url)}
        />
      )}
      {/* 어두운 그림일 때만 덮는다 — 밝은(파스텔) 그림은 짙은 글자로 읽히고, 덮으면 탁해진다. */}
      {bg && !dark && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-transparent" aria-hidden="true" />}
      {/* 글자색은 **테마가 아니라 그림**이 정하므로 dark: 짝을 같은 값으로 못 박는다. */}
      <strong className={`block max-w-[62%] text-[24px] font-extrabold leading-[1.18] tracking-[-.03em] line-clamp-2 ${dark ? 'text-gray-900 dark:text-gray-900' : 'text-white'}`}>{b.title}</strong>
      {b.description && (
        <span className={`block max-w-[62%] mt-1 text-[13px] line-clamp-1 ${dark ? 'text-gray-700 dark:text-gray-700' : 'text-white/85'}`}>{b.description}</span>
      )}
      {href && (
        /* light-fixed — 흰 알약 + 블루 글자는 그림·브랜드 면 위에만 선다(페이지 배경에 닿지 않는다). */
        <span className="inline-flex self-start mt-3 px-4 py-2 rounded-lg bg-white text-[13px] font-bold text-brand-text"> {/* light-fixed */}
          자세히 보기
        </span>
      )}
    </Wrap>
  )
}
