/**
 * 🎬 2026-11-03 모션 21차 ⑥ — PC 에서 '…' 로 잘린 이름에 마우스를 올리면 이름이 옆으로 천천히 흘러 끝까지 보인다.
 *
 * 카드 부품(일부는 로딩 잠금 파일이다)을 고치지 않고 문서에 리스너 하나만 단다. 대상은 **실제로 잘린**
 * `truncate` 글자(가로로 넘친 것)뿐이고, 글자를 다시 감싸지 않는다 — 그 칸의 `scrollLeft` 만 움직인다
 * (넘치는 칸은 이미 overflow:hidden 이라 스크롤 위치를 옮기면 글자가 흐른다). 손을 떼면 처음으로 돌아간다.
 * 마우스가 있는 기기(hover + 정밀 포인터)에서만, 동작 줄이기면 아무것도 안 한다.
 */
export function installHoverMarquee(): void {
  if (typeof window === 'undefined') return
  try {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  } catch { return }
  let cur: HTMLElement | null = null
  let raf = 0
  let wait = 0
  const reset = () => {
    window.clearTimeout(wait); if (raf) cancelAnimationFrame(raf); raf = 0
    if (cur) { cur.scrollLeft = 0; cur.style.textOverflow = '' }
    cur = null
  }
  document.addEventListener('mouseover', (e) => {
    const el = (e.target as Element | null)?.closest?.('.truncate') as HTMLElement | null
    if (el === cur) return
    reset()
    if (!el || !el.closest('a, button, [role="link"]')) return
    const extra = el.scrollWidth - el.clientWidth
    if (extra < 4) return
    cur = el
    wait = window.setTimeout(() => {
      if (cur !== el) return
      el.style.textOverflow = 'clip'
      const dur = Math.min(4000, 600 + extra * 25)
      const t0 = performance.now()
      const step = (now: number) => {
        if (cur !== el) return
        const p = Math.min(1, (now - t0) / dur)
        el.scrollLeft = extra * p
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, 350)
  }, { passive: true })
  document.documentElement.addEventListener('mouseleave', reset) // 창 밖으로 나가면 처음으로
  window.addEventListener('blur', reset)
}
