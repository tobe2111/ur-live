/**
 * 🎬 로그아웃 탭 모션 한 벌 (2026-11-03 대표 *"로그아웃 페이지들 … 디자인 수정했는데 이렇더라도 모션그래픽 유연하게 적용되게끔"*).
 *
 * 화면 부품은 **표시만 단다** — `data-motion="mark|chips|nudge|draw"`. 움직임은 전부 이 파일의 CSS 한 벌이 정한다.
 * 그래서 디자인이 바뀌어 칸이 옮겨 가도 표시를 같이 옮기면 움직임이 따라간다(클래스 이름·DOM 깊이에 기대지 않는다).
 *
 *   mark  — 글자 밑에 형광펜이 왼쪽부터 그어진다(글자는 그대로 — 서버가 먼저 그린 글자도 숨기지 않는다)
 *   chips — 안의 작은 조각들이 차례로 톡 붙는다
 *   nudge — 안의 마지막 화살표(svg)가 오른쪽으로 두 번 살짝 밀린다(들어가 보라는 신호)
 *   draw  — 안의 줄마다 첫 아이콘이 선을 따라 그려진다
 *
 * 켜는 시점은 `useGuestMotion(rootRef)` — 표시가 화면에 들어오면 `data-motion-on` 을 붙인다. 동작 줄이기면 CSS 가 전부 끈다.
 */
import { useEffect, type RefObject } from 'react'

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
injectMotionCss('ur-m-guestmotion', `@keyframes ur-gmo-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: none; } }@keyframes ur-gmo-nudge { 0%, 100% { transform: none; } 35% { transform: translateX(5px); } }@keyframes ur-gmo-draw { to { stroke-dashoffset: 0; } }[data-motion="mark"] { background: linear-gradient(transparent 60%, rgba(28,105,239,.25) 60%) no-repeat 0 0 / 0% 100%; transition: background-size .8s cubic-bezier(.3,.8,.3,1) .2s; }[data-motion="mark"][data-motion-on] { background-size: 100% 100%; }[data-motion="chips"][data-motion-on] > * { animation: ur-gmo-pop .35s cubic-bezier(.3,1.4,.5,1) backwards; }[data-motion="chips"][data-motion-on] > :nth-child(2) { animation-delay: .1s; }[data-motion="chips"][data-motion-on] > :nth-child(3) { animation-delay: .2s; }[data-motion="nudge"][data-motion-on] svg:last-child { animation: ur-gmo-nudge 1.1s ease-in-out .6s 2; }[data-motion="draw"] :is(a, button) > span:first-child svg > * { stroke-dasharray: 64; stroke-dashoffset: 64; }[data-motion="draw"][data-motion-on] :is(a, button) > span:first-child svg > * { animation: ur-gmo-draw .7s ease-out .25s forwards; }@media (prefers-reduced-motion: reduce){[data-motion="mark"]{transition:none!important}[data-motion][data-motion-on] *,[data-motion][data-motion-on] > *{animation:none!important}[data-motion="draw"] :is(a, button) > span:first-child svg > *{stroke-dashoffset:0!important}}`)

/** 루트 안의 `[data-motion]` 이 화면에 들어오면 `data-motion-on` 을 붙인다(한 번). 관찰기가 없으면 바로 붙인다. */
export function useGuestMotion(root: RefObject<HTMLElement | null>, deps: unknown[] = []): void {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-motion]:not([data-motion-on])'))
    if (targets.length === 0) return
    if (typeof IntersectionObserver === 'undefined') { targets.forEach((t) => t.setAttribute('data-motion-on', '')); return }
    // 테스트·서버 첫 화면 모양 비교에 끼지 않게 한 박자 뒤에 관찰을 시작한다.
    let io: IntersectionObserver | null = null
    const id = window.setTimeout(() => {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute('data-motion-on', ''); io?.unobserve(e.target) } }), { threshold: 0.3 })
      targets.forEach((t) => io!.observe(t))
    }, 300)
    return () => { window.clearTimeout(id); io?.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
