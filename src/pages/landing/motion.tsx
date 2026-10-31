/**
 * 🎬 랜딩 움직임 키트 — `/partners` · `/influencer` · `/about` 이 같이 쓴다 (2026-10-31).
 *
 * 대표: *"홈페이지들 각각 ai 가 만든 티가 나면 안되고, 애니메이션? 움직이는 효과도 나는 대기업급 페이지가
 *   돼야하는데"* → *"세 페이지 다 그렇게 진행해줘. 또 고급 효과들 없어?"*
 *
 * ■ 라이브러리를 안 쓴다 — IntersectionObserver · requestAnimationFrame · CSS 만. 세 페이지는 lazy 청크라
 *   이 파일과 `motion.css` 는 그 청크에만 실린다(앱 첫 화면 무게 0).
 *
 * ■ 규칙 (`motion.css` 머리말과 같다)
 *   ① transform·opacity 만 움직인다 — 레이아웃을 건드리면 밀림이 생긴다.
 *   ② 동작 줄이기(`prefers-reduced-motion`)면 숨기기·움직이기를 **아예 하지 않는다**.
 *   ③ 숨기는 클래스는 JS 가 마운트 뒤에 붙인다 — 그 전에는 내용이 그대로 보인다.
 *      그리고 **이미 화면 안에 있던 요소는 숨기지 않는다**(첫 화면이 깜빡이지 않게).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import './motion.css'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 요소가 화면에 들어오면 한 번 `true`. 동작 줄이기면 처음부터 `true`. */
export function useInViewOnce<T extends Element>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { rootMargin, threshold: 0.08 })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, seen])
  return [ref, seen] as const
}

type RevealKind = 'up' | 'fade' | 'scale' | 'left' | 'right'

/**
 * 스크롤해서 들어올 때 아래에서 올라오며 나타난다. `delay` 로 형제끼리 차례를 준다.
 * ⚠️ 첫 화면에 이미 보이는 요소는 숨기지 않는다 — 마운트 직후 위치를 재서 화면 밖일 때만 가린다.
 */
export function Reveal({
  as: Tag = 'div', kind = 'up', delay = 0, className = '', style, children, ...rest
}: {
  as?: ElementType
  kind?: RevealKind
  delay?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null)
  const [state, setState] = useState<'idle' | 'hidden' | 'in'>('idle')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) return // 이미 보인다 — 건드리지 않는다
    setState('hidden')
  }, [])

  useEffect(() => {
    if (state !== 'hidden') return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { setState('in'); io.disconnect() }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 })
    io.observe(el)
    return () => io.disconnect()
  }, [state])

  const cls = state === 'idle' ? className : `${className} ur-rv${state === 'in' ? ' ur-rv-in' : ''}`
  return (
    <Tag ref={ref} className={cls} data-rv={kind === 'up' ? undefined : kind}
      style={delay ? { ...style, ['--rv-delay' as string]: `${delay}ms` } : style} {...rest}>
      {children}
    </Tag>
  )
}

/** 제목 한 줄 — 마스크 안에서 밀려 올라온다. `<h1>` 안에 줄마다 하나씩 쓴다(글자는 그대로 h1 의 자식이라 검색엔진·시험이 읽는다). */
export function Line({ i = 0, children }: { i?: number; children: ReactNode }) {
  return (
    <span className="ur-line"><span style={{ ['--line-delay' as string]: `${80 + i * 110}ms` }}>{children}</span></span>
  )
}

/** 첫 화면 등장 지연값 — `className="ur-load"` 와 함께 `style={loadDelay(240)}` 로 쓴다. */
export const loadDelay = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` })

/**
 * 숫자가 0 에서 목표값까지 세어 올라간다. `"90%"` · `"0원"` · `"1만원"` 처럼 **문자열 안의 첫 숫자만** 센다
 * (단위는 그대로 둔다). 숫자가 없으면 그냥 보여 준다.
 * 화면 읽기 프로그램에는 처음부터 최종값을 준다(`aria-label`).
 */
export function CountUp({ value, ms = 1400, className = '' }: { value: string; ms?: number; className?: string }) {
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(value)
  const target = m ? Number(m[2].replace(/,/g, '')) : NaN
  const [ref, seen] = useInViewOnce<HTMLSpanElement>('0px')
  const [n, setN] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!m || !Number.isFinite(target) || prefersReducedMotion()) return
    setN(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!seen || n === null || !Number.isFinite(target)) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 4)
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen])

  const shown = m && n !== null ? `${m[1]}${n.toLocaleString('ko-KR')}${m[3]}` : value
  return <span ref={ref} aria-label={value} className={className}><span aria-hidden>{shown}</span></span>
}

/** 숫자가 바뀔 때 이전 값에서 새 값으로 미끄러진다(계산기 결과). */
export function useTweened(target: number, ms = 450): number {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (prefersReducedMotion()) { setV(target); from.current = target; return }
    const a = from.current
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const cur = Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3)))
      setV(cur); from.current = cur
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** 머리글 아래 얇은 진행 막대 — 페이지를 얼마나 읽었는지. 부모가 `position: relative|sticky` 여야 한다. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      el.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])
  return <div ref={ref} aria-hidden className="ur-progress" />
}

/**
 * 마우스를 따라 살짝 기울어진다(넓은 화면 · 마우스 기기만). 첫 화면 폰 묶음에 쓴다.
 * 기울기는 최대 6도 — 그 이상이면 글자가 읽히지 않는다.
 */
export function Tilt({ children, className = '', max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) return
    const host = el.parentElement ?? el
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--tilt-y', `${(x * max).toFixed(2)}deg`)
      el.style.setProperty('--tilt-x', `${(-y * max).toFixed(2)}deg`)
    }
    const leave = () => { el.style.setProperty('--tilt-y', '0deg'); el.style.setProperty('--tilt-x', '0deg') }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
    return () => { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave) }
  }, [max])
  return <div ref={ref} className={`ur-tilt ${className}`}>{children}</div>
}

/** 카드 위에서 커서를 따라오는 은은한 빛 + 살짝 떠오름. */
export function spotHandlers() {
  return {
    onPointerMove: (e: RPointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
      e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
    },
  }
}

/** 같은 줄을 두 벌 이어 붙여 끊김 없이 흐르게 한다. 마우스를 올리면 멈춘다. */
export function Marquee({ children, seconds = 48, className = '' }: { children: ReactNode; seconds?: number; className?: string }) {
  return (
    <div className={`ur-marquee-wrap overflow-hidden ${className}`}>
      <div className="ur-marquee" style={{ ['--marquee-s' as string]: `${seconds}s` }}>
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  )
}

/**
 * 지금 화면 한가운데를 지나는 단계의 번호. 고정 화면 스토리(폰은 멈추고 글이 지나간다)에 쓴다.
 * 각 단계 요소에 `data-step={i}` 를 달고 그 묶음의 ref 를 넘긴다.
 */
export function useActiveStep(count: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'))
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 })
    steps.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [count])
  return [ref, active] as const
}
