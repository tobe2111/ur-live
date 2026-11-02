/**
 * 🎬 장바구니 담기: 점 하나가 누른 자리에서 화면의 장바구니 아이콘으로 날아가고, 아이콘이 톡 튄다
 *    (2026-11-02 시안 4차, 대표 *"좋다 다 해주고"*).
 *
 * 받는 쪽은 `data-cart-icon` 이 붙은 **보이는** 버튼이다(PC 상단 네비 · 상품 상세 머리). 화면에 없으면
 * 날리지 않고 끝낸다 — 담겼다는 알림(토스트)은 호출부가 따로 띄운다. transform·opacity 만, 동작 줄이기면 아무것도 안 한다.
 */
function reducedMotion(): boolean {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function visibleCartIcon(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-cart-icon]'))
  return all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight }) ?? null
}

export function flyToCart(from: Element | null): void {
  if (!from || reducedMotion() || typeof document === 'undefined') return
  const target = visibleCartIcon()
  if (!target) return
  const a = from.getBoundingClientRect(), b = target.getBoundingClientRect()
  const dot = document.createElement('span')
  dot.setAttribute('aria-hidden', 'true')
  dot.style.cssText = `position:fixed;left:${a.left + a.width / 2 - 8}px;top:${a.top + a.height / 2 - 8}px;width:16px;height:16px;border-radius:50%;background:var(--brand,#1C69EF);z-index:20001;pointer-events:none`
  document.body.appendChild(dot)
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const anim = dot.animate(
    [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0.6 }],
    { duration: 560, easing: 'cubic-bezier(.55,0,.3,1)' },
  )
  anim.onfinish = () => {
    dot.remove()
    target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' })
  }
}
