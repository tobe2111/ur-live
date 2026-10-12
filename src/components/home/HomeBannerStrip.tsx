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

/** 스트립 항목 사이 간격(px). 위 `gap-2` 와 **같은 값이어야** 점 계산이 맞는다. */
const STRIP_GAP_PX = 8

function bannerHref(b: HomeBanner): string {
  return b.link_url ? safeInternalPath(b.link_url, '') : ''
}

function Wrap({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href
    ? <Link to={href} className={className}>{children}</Link>
    : <div className={className}>{children}</div>
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
 * 🎠 상단 배너 — 2:1 3D 카드 캐러셀 (2026-10-12 대표 확정 — 시안 `docs/design/home-banner-3d.md`).
 *
 * 대표: *"메인 페이지에 있는 배너 디자인을 이 세션에서 계속 맡을거야. 퀄리티가 상당해야해"* →
 * NOL 레퍼런스 *"이렇게 3d 디자인이 좋겠어"* → ***"2:1(362×181) 배너 크기야"*** → ***"자동으로 넘어가게 해줘"***.
 *
 * ## 무엇이 바뀌었나 (2026-09-05 "안 3" 96px 띠를 대체)
 * - **틀이 2:1 카드다.** 폰은 좌우 16px(헤더 로고·탭과 같은 선) 안 꽉 찬 한 장(390 폰 358 × 179 · 394 폰 362 × 181),
 *   PC 는 같은 2:1 카드
 *   **세 장이 나란히**(가로 전체 2:1 이면 700px 가 넘어 첫 화면을 통째로 먹는다).
 * - **저절로 넘어간다**(대표 확정). 종전 "자동 재생 금지"는 이 결정으로 폐기됐다. 대신 아래 넷을
 *   지킨다 — 하나라도 빠지면 *읽던 사람이 방해받는다*는 옛 우려가 그대로 돌아온다:
 *   ① 멈춤 버튼(누르면 다시 안 움직인다) ② 손가락이 닿으면 그 자리에서 멈춘다(놓고 한참 뒤 재개)
 *   ③ 화면 밖이거나 탭이 숨겨지면 안 넘긴다 ④ 기기의 '동작 줄이기'가 켜져 있으면 아예 안 넘긴다.
 * - 점 대신 **`n / N` 알약**. 글자는 그림에 굽지 않고 코드로 얹는다(선명 · 어드민 수정 · 스크린리더).
 *
 * ## 왜 JS 캐러셀 라이브러리가 아닌가
 * 네이티브 가로 스크롤 + CSS `scroll-snap` 이면 손가락 감각(관성·고무줄·키보드)을 브라우저가 이미 준다.
 * 자동 넘김도 그 스크롤을 `scrollTo` 로 미는 것뿐이라 손가락과 같은 길을 탄다.
 * 현재 장(`active`)은 **스크롤 위치에서 파생**한다 — 상태를 따로 들고 있으면 손가락과 어긋난다.
 */
const AUTO_ADVANCE_MS = 4500
/** 손가락을 뗀 뒤 다시 움직이기까지(ms). 바로 움직이면 방금 고른 장을 빼앗는다. */
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
  const n = banners.length

  /** 한 칸 폭(카드 + 간격). PC 에서 세 장이 보여도 한 번에 한 장씩 민다. */
  const stepPx = () => {
    const first = railRef.current?.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + STRIP_GAP_PX : 0
  }

  const onScroll = () => {
    const el = railRef.current
    const step = stepPx()
    if (!el || !step) return
    const i = Math.round(el.scrollLeft / step)
    setActive(Math.max(0, Math.min(n - 1, i)))
  }

  // ③ 화면 밖이면 안 넘긴다 — 아래로 내려 읽는 사람 머리 위에서 혼자 돌 이유가 없다.
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
      const el = railRef.current
      const step = stepPx()
      if (!el || !step || document.visibilityState !== 'visible') return
      // 끝까지 갔으면(PC 는 마지막 장들이 한 화면에 같이 보인다) 처음으로 돌아간다.
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: atEnd ? 0 : (active + 1) * step, behavior: 'smooth' })
    }, wait)
    return () => window.clearTimeout(t)
  }, [many, paused, reduceMotion, onScreen, active, heldUntil])

  // ② 손가락이 닿으면 멈춘다.
  const hold = () => setHeldUntil(Date.now() + RESUME_AFTER_TOUCH_MS)

  const cardBasis =
    n >= 3 ? 'basis-full lg:basis-[calc((100%-16px)/3)]'
    : n === 2 ? 'basis-full lg:basis-[calc((100%-8px)/2)]'
    : 'basis-full lg:basis-1/2'

  return (
    <div ref={rootRef} className="px-4 lg:px-0 pb-4" aria-roledescription="carousel" aria-label="이벤트 배너">
      <div
        ref={railRef}
        onScroll={many ? onScroll : undefined}
        onPointerDown={many ? hold : undefined}
        onWheel={many ? hold : undefined}
        className={`flex gap-2 ${many ? 'overflow-x-auto snap-x snap-mandatory scrollbar-hide' : ''}`}
      >
        {banners.map((b, i) => <StripCard key={b.id} b={b} first={i === 0} snap={many} basis={cardBasis} />)}
      </div>
      {many && (
        <div className="relative">
          {/* 카드 오른쪽 아래에 얹는다(NOL 레퍼런스). 레일 밖에 두어야 스크롤과 같이 밀려가지 않는다. */}
          <div className="absolute right-3 -top-[36px] lg:hidden flex items-center gap-2">
            <StripControls active={active} n={n} paused={paused || reduceMotion} canPlay={!reduceMotion} onToggle={() => setPaused(p => !p)} />
          </div>
          <div className="hidden lg:flex justify-end pt-2">
            <StripControls active={active} n={n} paused={paused || reduceMotion} canPlay={!reduceMotion} onToggle={() => setPaused(p => !p)} tone="field" />
          </div>
        </div>
      )}
    </div>
  )
}

/** 카드 한 장. 글자색은 그림 밝기로 정한다(`banner-ink.ts`). */
function StripCard({ b, first, snap, basis }: { b: HomeBanner; first: boolean; snap: boolean; basis: string }) {
  const href = bannerHref(b)
  const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.strip.requestWidth, quality: 80 }) : ''
  const [ink, setInk] = useState<BannerInk>('light')
  const dark = ink === 'dark'
  return (
    <Wrap
      href={href}
      className={`relative ${snap ? 'snap-start shrink-0' : ''} ${basis} aspect-[2/1] overflow-hidden rounded-xl lg:rounded-2xl isolate bg-brand`}
    >
      {bg && (
        <img
          src={bg} alt="" aria-hidden="true"
          /* 첫 장은 첫 화면에 그대로 보이는 그림이라 미루지 않는다. 나머지는 넘길 때 받는다. */
          loading={first ? 'eager' : 'lazy'}
          fetchPriority={first ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 -z-10 w-full h-full object-cover"
          onLoad={(e) => { const L = measureTitleLuminance(e.currentTarget); if (L != null) setInk(inkForLuminance(L)) }}
          onError={(e) => cfImageOnError(e.currentTarget, b.image_url)}
        />
      )}
      {/* 🎨 2026-10-12 대표 *"배경을 그라데이션으로 하니까 촌스러운데"* — 그림 위에 덮던 검은 그라데이션을 뺐다.
          배너 그림은 단색 바탕으로 만든다(어드민 규격 안내). 글자색은 그림이 정하고(파스텔 = 짙은 글자),
          흰 글자일 때만 옅은 그림자를 준다 — 그림의 색은 그대로 남는다.
          글자색은 **테마가 아니라 그림**이 정하므로 dark: 짝을 **같은 값**으로 못 박는다(테마가 바뀌어도 안 변한다). */}
      <div className={`absolute left-5 bottom-4 max-w-[58%] ${dark ? 'text-gray-900 dark:text-gray-900' : 'text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.22)]'}`}>
        <strong className="block text-[24px] font-bold leading-[1.25] tracking-[-0.02em] line-clamp-2 [text-wrap:balance]">{b.title}</strong>
        {b.description && (
          <span className={`block mt-2 text-[13px] font-medium truncate ${dark ? 'text-gray-700 dark:text-gray-700' : 'text-white/85'}`}>{b.description}</span>
        )}
      </div>
    </Wrap>
  )
}

function StripControls({ active, n, paused, canPlay, onToggle, tone = 'card' }: {
  active: number; n: number; paused: boolean; canPlay: boolean; onToggle: () => void; tone?: 'card' | 'field'
}) {
  const pill = tone === 'card'
    ? 'bg-black/30 text-white backdrop-blur-md'
    /* PC 는 카드 아래 홈 색면(--home-field, 테마 무관 잉크) 위에 놓인다 — 흰 반투명이 맞다. */
    : 'bg-white/10 text-white hover:bg-white/15'
  return (
    <>
      {canPlay && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={paused ? '배너 자동 넘김 다시 시작' : '배너 자동 넘김 멈춤'}
          className={`h-6 w-6 grid place-items-center rounded-full ${pill}`}
        >
          {paused ? (
            <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true"><path d="M1 1l7 4-7 4z" fill="currentColor" /></svg>
          ) : (
            <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true"><path d="M1 1v8M7 1v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          )}
        </button>
      )}
      <span className={`h-6 px-3 rounded-full grid place-items-center text-[12px] font-semibold tabular-nums ${pill}`}>
        {active + 1} / {n}
      </span>
    </>
  )
}
