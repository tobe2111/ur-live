/**
 * 🎬 2026-11-02 11차 ①·⑩ — 홈 카테고리를 바꾸면 파란 밑줄이 **옛 칸에서 새 칸으로 미끄러진다.**
 *
 * 밑줄의 실체는 각 버튼의 `border-b-2 border-brand` 그대로 둔다 — 서버 첫 화면(`worker/utils/home-first-screen.ts`
 * 의 `catOn`)이 같은 클래스를 글자 그대로 미러하므로 클래스를 바꾸면 첫 화면과 마운트가 갈린다.
 * 그래서 움직임은 **잠깐 떠 있는 막대 하나**(body 에 붙였다 지움)로만 그리고, 그동안 새 칸의 밑줄을 숨긴다.
 * CSS 0 · 동작 줄이기면 아무것도 안 한다 · Web Animations 미지원이면 종전 그대로(툭 바뀜).
 */
export function slideCatUnderline(to: HTMLElement): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { return }
  const nav = to.closest('nav')
  const from = nav?.querySelector<HTMLElement>('[aria-pressed="true"]')
  if (!from || from === to || typeof to.animate !== 'function') return
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  const bar = document.createElement('span')
  bar.setAttribute('aria-hidden', 'true')
  Object.assign(bar.style, {
    position: 'fixed', left: `${a.left}px`, top: `${a.bottom - 2}px`, width: `${a.width}px`, height: '2px',
    background: 'var(--brand)', transformOrigin: 'left', pointerEvents: 'none', zIndex: '40',
  })
  document.body.appendChild(bar)
  to.style.borderBottomColor = 'transparent'
  const anim = bar.animate(
    [{ transform: 'none' }, { transform: `translateX(${b.left - a.left}px) scaleX(${b.width / Math.max(1, a.width)})` }],
    { duration: 280, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' },
  )
  const done = () => { bar.remove(); to.style.borderBottomColor = '' }
  anim.onfinish = done
  anim.oncancel = done
  window.setTimeout(done, 600) // 끝 신호를 못 받아도 밑줄을 숨긴 채 두지 않는다
}
