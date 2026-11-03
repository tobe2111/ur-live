/**
 * 🎬 (사장님 마이 전용 — `src/hooks` 에 두면 모든 화면의 공용 유틸 청크에 실린다. 2026-11-02 화면별 무게 예산 실측)
 * 🎬 숫자가 0(또는 from)에서 목표값까지 올라가는 움직임 (2026-11-02 대표 *"이전에 만든 모션그래픽 다 적용해줘"*).
 *
 * - **처음 값이 도착했을 때 한 번만** 돈다(데이터가 늦게 와도 그때 시작). 그 뒤 값이 바뀌면 바로 그 값을
 *   보여준다 — 매번 다시 올라가면 새로고침마다 숫자가 출렁여 읽을 수 없다.
 * - 값이 아직 없으면(undefined·NaN) 그대로 돌려준다 — 호출부의 "아직 모름" 처리를 망가뜨리지 않는다.
 * - '동작 줄이기' 면 처음부터 목표값. 끝은 언제나 정확한 목표값이다.
 * - `resetKey` 가 바뀌면(예: 사장님이 매장을 바꿈) 새 값에서 **한 번 더** 올라간다.
 */
import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function useCountUp<T extends number | null | undefined>(target: T, opts: { from?: number; delayMs?: number; durationMs?: number; resetKey?: string | number | null } = {}): T | number {
  const { from = 0, delayMs = 0, durationMs = 700, resetKey } = opts
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const raf = useRef(0)
  const ready = typeof target === 'number' && Number.isFinite(target)
  const lastKey = useRef(resetKey)
  useEffect(() => {
    if (lastKey.current === resetKey) return
    lastKey.current = resetKey
    setProgress(0)
    setPhase('idle')
  }, [resetKey])

  useEffect(() => {
    if (phase !== 'idle' || !ready) return
    if (prefersReducedMotion() || target === from) { setPhase('done'); return }
    setPhase('run')
  }, [phase, ready, target, from])

  useEffect(() => {
    if (phase !== 'run') return
    let t0 = 0
    const start = window.setTimeout(() => {
      const step = (now: number) => {
        if (!t0) t0 = now
        const p = Math.min(1, (now - t0) / durationMs)
        setProgress(1 - Math.pow(1 - p, 3))
        if (p < 1) raf.current = requestAnimationFrame(step)
        else setPhase('done')
      }
      raf.current = requestAnimationFrame(step)
    }, delayMs)
    return () => { window.clearTimeout(start); cancelAnimationFrame(raf.current) }
  }, [phase, delayMs, durationMs])

  if (phase !== 'run' || !ready) return target
  return Math.round(from + ((target as number) - from) * progress)
}
