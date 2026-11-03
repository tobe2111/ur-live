/**
 * 🎬 2026-11-03 모션 20차 ① — 파란 주 버튼을 누르면 손가락이 닿은 자리에서 옅은 물결이 퍼진다.
 *
 * 버튼마다 손대지 않고 문서에 리스너 하나를 단다. 대상은 **파란 주 버튼 두 가지 모양**뿐이다:
 *   `.ur-btn-primary`(뜻 클래스) · `bg-brand` + `text-white`(CLAUDE.md "주 행동 버튼은 브랜드 블루 하나다").
 * 막힌 버튼(disabled·aria-disabled)과 `data-no-ripple` 은 건너뛴다. 동작 줄이기면 아무것도 안 한다.
 *
 * 물결은 버튼 안에 잠깐 넣는 칸(그 칸이 모서리를 자른다)에서 transform·opacity 만 움직이고 0.6초 뒤 지운다 —
 * 버튼 크기·글자 위치는 안 바뀐다. 버튼이 static 이면 그동안만 relative 로 두고 되돌린다.
 */
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
injectMotionCss('ur-m-ripple', `@keyframes ur-ripple { from { transform: scale(0); opacity: .45; } to { transform: scale(1); opacity: 0; } }.ur-ripple-box { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }.ur-ripple-dot { position: absolute; border-radius: 50%; background: rgba(255,255,255,.55); animation: ur-ripple .55s ease-out forwards; }@media (prefers-reduced-motion: reduce){.ur-ripple-dot{animation:none!important;opacity:0}}`)

const TARGET = '.ur-btn-primary, button.bg-brand.text-white, a.bg-brand.text-white'

export function installPressRipple(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('pointerdown', (e) => {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      const el = (e.target as Element | null)?.closest?.(TARGET) as HTMLElement | null
      if (!el || el.hasAttribute('data-no-ripple') || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return
      const r = el.getBoundingClientRect()
      const size = Math.hypot(r.width, r.height) * 2
      const box = document.createElement('span')
      box.className = 'ur-ripple-box'
      box.setAttribute('aria-hidden', 'true')
      const dot = document.createElement('span')
      dot.className = 'ur-ripple-dot'
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      box.appendChild(dot)
      const wasStatic = getComputedStyle(el).position === 'static'
      if (wasStatic) el.style.position = 'relative'
      el.appendChild(box)
      window.setTimeout(() => { box.remove(); if (wasStatic && !el.querySelector('.ur-ripple-box')) el.style.position = '' }, 600)
    } catch { /* 물결은 장식 — 실패해도 누름은 그대로 간다 */ }
  }, { passive: true, capture: true })
}
