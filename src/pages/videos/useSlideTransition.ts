import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

/**
 * 🎬 유어쇼츠 뷰어 — 넘길 때 **화면이 손가락을 따라 밀려 올라가는** 전환 (2026-10-19 대표
 * *"영상 스와이프할 때 효과? 자연스럽게 넘어간다던지"*).
 *
 * ## 왜 진짜 세로 목록(스크롤 스냅)이 아닌가
 * 재생기는 **하나만 산다**(VideosPage 머리말 — 열 개를 띄우면 폰이 멈춘다). 그래서 옆 영상은
 * 재생기가 아니라 **썸네일**로 그린다: 손가락을 따라 지금 화면이 밀리고 다음 썸네일이 따라 들어오며,
 * 다 넘어간 순간 재생기가 그 영상으로 갈아 끼워진다. 재생이 시작될 때까지 그 썸네일이 덮개로
 * 남았다가 사라지므로 검은 화면이 번쩍이지 않는다.
 *
 * ## 판정은 그대로다
 * 넘김 판정(이동 중 60px · 뗄 때 판정 · 취소 처리)은 VideosPage 의 제스처 층이 한다. 이 훅은
 * **그림만** 바꾼다 — `go(d)` 가 즉시 바꾸던 것을 밀어 올린 뒤 바꾸고, 임계 전에는 손가락을 따라간다.
 *
 * - `prefers-reduced-motion` 이면 애니메이션 없이 종전처럼 즉시 넘어간다.
 * - 끝(첫·마지막 영상)에서는 손가락의 1/3 만 따라가다 제자리로 돌아온다(더 없다는 뜻).
 */
export const SLIDE_MS = 260
/** 재생이 시작되지 않아도 덮개를 이만큼 뒤엔 걷는다(자동재생이 막힌 브라우저 — 탭하면 뜬다). */
export const COVER_MAX_MS = 2500

function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false } catch { return false }
}

export function useSlideTransition(opts: {
  count: number
  idx: number
  setIdx: (i: number) => void
  idOf: (i: number) => string | null
}) {
  const { count, idx, setIdx, idOf } = opts
  const [shift, setShift] = useState(0)
  const [animating, setAnimating] = useState(false)
  /** 방금 넘어온 영상 — 재생이 시작될 때까지 썸네일 덮개를 씌운다. */
  const [coverId, setCoverId] = useState<string | null>(null)
  const busy = useRef(false)
  const live = useRef({ count, idx, setIdx, idOf })
  live.current = { count, idx, setIdx, idOf }

  const go = useCallback((d: 1 | -1) => {
    const { count: n, idx: i, setIdx: set, idOf: id } = live.current
    if (busy.current) return
    const next = i + d
    if (next < 0 || next >= n) { setAnimating(true); setShift(0); return }
    if (prefersReducedMotion()) { set(next); return }
    busy.current = true
    setAnimating(true)
    setShift(-d * window.innerHeight)
    window.setTimeout(() => {
      setAnimating(false)
      set(next)
      setCoverId(id(next))
      setShift(0)
      busy.current = false
    }, SLIDE_MS)
  }, [])

  /** 손가락을 따라간다(임계 전). 끝에서는 1/3 만. */
  const drag = useCallback((dy: number) => {
    if (busy.current) return
    const { count: n, idx: i } = live.current
    const atEdge = (dy > 0 && i === 0) || (dy < 0 && i >= n - 1)
    setAnimating(false)
    setShift(atEdge ? dy / 3 : dy)
  }, [])

  /** 넘기지 않고 놓았을 때 — 제자리로 돌아간다. */
  const settle = useCallback(() => {
    if (busy.current) return
    setAnimating(true)
    setShift(0)
  }, [])

  /** 재생이 시작되면 덮개를 걷는다. 시작 신호가 안 와도 `COVER_MAX_MS` 뒤엔 걷는다. */
  const uncover = useCallback(() => setCoverId(null), [])
  useEffect(() => {
    if (!coverId) return
    const t = window.setTimeout(() => setCoverId(null), COVER_MAX_MS)
    return () => window.clearTimeout(t)
  }, [coverId])

  const slideStyle = useMemo<CSSProperties>(() => ({
    transform: shift ? `translate3d(0, ${shift}px, 0)` : undefined,
    transition: animating ? `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none',
  }), [shift, animating])

  return { go, drag, settle, slideStyle, coverId, uncover }
}
