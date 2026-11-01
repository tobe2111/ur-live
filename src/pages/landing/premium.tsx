/**
 * 💎 랜딩 고급화 키트 — `/partners` · `/influencer` · `/about` 이 같이 쓴다 (2026-11-01).
 *
 * 대표: *"아직 좀 아쉬움이 남는데 더 고급스럽게 하려면?"* → 시안 여섯 가지 → *"전부 세 페이지에 모두 적용해줘."*
 *
 * ■ 부품
 *   `useLandingFont`  ⑥ 제목 전용 글꼴(명조)을 이 세 페이지에서만 불러온다
 *   `PhotoHero`       ① 실사진을 꽉 채운 첫 화면
 *   `DeviceStage`     ③ 실제 폰 모양 두 대 + 화면 영상(라이브 녹화) + 사용 완료 알림
 *   `ToneScroll`      ④ 스크롤 따라 바탕·글자색이 함께 바뀌는 묶음
 *   `GiantNumber`     ⑤ 화면을 채우는 숫자가 지나가는 만큼 파랗게 찬다
 *
 * ■ 규칙(`motion.tsx` 와 같다): 라이브러리 없음 · transform·opacity 만 · 동작 줄이기면 끈다 ·
 *   **숨긴 채로 기다리는 글자는 없다**(JS 가 없거나 늦으면 끝 상태로 보인다).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { prefersReducedMotion } from './motion'
import './premium.css'

/** ⑥ 제목 글꼴 — 첫 진입에 한 번 `<link>` 를 붙인다. 앱의 다른 화면은 이 글꼴을 받지 않는다. */
export const LANDING_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;800&family=Inter+Tight:wght@800&display=swap'

export function useLandingFont() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('ur-landing-font')) return
    const link = document.createElement('link')
    link.id = 'ur-landing-font'
    link.rel = 'stylesheet'
    link.href = LANDING_FONT_HREF
    document.head.appendChild(link)
  }, [])
}

/**
 * ① 실사진 첫 화면 — 사진이 아주 천천히 다가오고, 아래(폰)·왼쪽(PC)으로 짙어지는 막 위에 글자가 앉는다.
 * 사진 주소는 `LANDING_PHOTOS` 한 곳에서 고른다(실제 매장 촬영본으로 바꿀 때 한 줄만 바뀐다).
 */
export const LANDING_PHOTOS = {
  partners: { src: '/static/partners/deal-photo.jpg', position: '50% 50%', alt: '유어딜 입점 매장의 돈가스 한 상' },
  influencer: { src: '/static/partners/deal-photo.jpg', position: '20% 30%', alt: '동네 맛집 메뉴 사진' },
  about: { src: '/static/partners/deal-photo.jpg', position: '75% 60%', alt: '유어딜에서 파는 동네 가게 메뉴' },
} as const

export function PhotoHero({ photo, className = '', children }: {
  photo: keyof typeof LANDING_PHOTOS
  className?: string
  children: ReactNode
}) {
  const p = LANDING_PHOTOS[photo]
  return (
    <section data-photo-hero={photo} className={`ur-photo-hero ur-panel-ink text-white ${className}`}>
      <img src={p.src} alt={p.alt} width={1080} height={1080} decoding="async"
        // React 18 은 `fetchPriority` 를 모른다(경고) — 소문자 속성으로 그대로 넘긴다
        {...({ fetchpriority: 'high' } as Record<string, string>)}
        className="ur-photo-hero-img" style={{ objectPosition: p.position }} />
      {children}
    </section>
  )
}

/** ③ 화면 하나 — 영상이 있으면 영상(포스터 먼저), 없으면 캡처. */
export type DeviceScreen = { shot: string; video?: string; alt: string; tag: string; live?: boolean }

function Device({ screen, className = '' }: { screen: DeviceScreen; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  // 영상은 화면에 들어왔을 때만 재생한다(안 보이는 동안 배터리·데이터를 쓰지 않는다). 동작 줄이기면 포스터만.
  useEffect(() => {
    const v = ref.current
    if (!v || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { v.play().catch(() => {}) } else v.pause()
    }, { threshold: 0.2 })
    io.observe(v)
    return () => io.disconnect()
  }, [])
  return (
    <div className={`ur-device ${className}`}>
      <div className="ur-device-screen">
        {screen.video ? (
          <video ref={ref} src={screen.video} poster={screen.shot} muted loop playsInline preload="none"
            aria-label={screen.alt} width={430} height={930} />
        ) : (
          <img src={screen.shot} alt={screen.alt} width={430} height={930} loading="lazy" decoding="async" />
        )}
      </div>
      <span className="ur-device-tag" data-live={screen.live ? 1 : 0}>{screen.tag}</span>
    </div>
  )
}

export function DeviceStage({ back, front, toast, className = '' }: {
  back: DeviceScreen
  front: DeviceScreen
  /** 사용 완료 같은 알림 한 줄. 굵은 첫 줄 + 작은 둘째 줄. */
  toast?: { title: string; sub: string }
  className?: string
}) {
  return (
    <div className={`ur-device-stage relative h-[420px] sm:h-[520px] lg:h-[620px] ${className}`}>
      <div className="absolute left-[4%] top-[8%] w-[46%] max-w-[16.5rem] ur-float">
        <Device screen={back} className="ur-device-back" />
      </div>
      <div className="absolute right-[4%] top-0 z-[2] w-[46%] max-w-[16.5rem] ur-float-late">
        <Device screen={front} className="ur-device-front" />
      </div>
      {toast ? (
        <div className="ur-device-toast bg-white text-gray-900 dark:bg-[#1D1F29] dark:text-white">
          <span aria-hidden className="w-8 h-8 rounded-full bg-brand text-white grid place-items-center text-[15px] font-bold shrink-0">✓</span>
          <span className="text-[13px] leading-snug"><b className="block text-[15px] font-bold">{toast.title}</b>{toast.sub}</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * ④ 스크롤 따라 바뀌는 바탕 — 안쪽 `[data-tone]` 중 화면 가운데를 지나는 것의 색으로 바탕·글자가 함께 바뀐다.
 * 첫 색은 맨 처음 `[data-tone]` 이라 마운트 전후로 색이 튀지 않는다(`initial` 을 그 값과 맞춘다).
 */
export type Tone = 'ink' | 'paper' | 'tint'

export function ToneScroll({ initial, className = '', children }: { initial: Tone; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [tone, setTone] = useState<Tone>(initial)
  useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const zones = Array.from(root.querySelectorAll<HTMLElement>('[data-tone]'))
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) setTone(e.target.getAttribute('data-tone') as Tone)
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 })
    zones.forEach((z) => io.observe(z))
    return () => io.disconnect()
  }, [])
  return <div ref={ref} data-tone-active={tone} className={`ur-tone ${className}`}>{children}</div>
}

/**
 * ⑤ 거대한 숫자 — `value` 는 숫자 부분, `unit` 은 작게. 뜻(`label`)은 화면 읽기 프로그램에 그대로 준다.
 * `fill`(0~1)까지만 파랗게 찬다 — 예: 사장님 몫 90% 면 0.9.
 */
export function GiantNumber({ value, unit, label, fill = 1 }: { value: string; unit?: string; label: string; fill?: number }) {
  const ref = useRef<HTMLParagraphElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const max = Math.max(0, Math.min(1, fill)) * 100
    if (prefersReducedMotion()) { el.style.setProperty('--fill', `${max}%`); return }
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)))
      el.style.setProperty('--fill', `${(p * max).toFixed(1)}%`)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [fill])
  return (
    <>
      <span className="sr-only">{label}</span>
      <p ref={ref} aria-hidden className="ur-giant select-none">{value}{unit ? <small>{unit}</small> : null}</p>
    </>
  )
}
