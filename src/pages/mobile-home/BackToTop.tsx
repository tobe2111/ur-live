/**
 * ⬆️ 맨 위로 버튼 — 2026-11-02 시안 6차(대표 *"다 넣어줘"*).
 *
 * 홈 피드를 한참 내리면(화면 두 장 남짓) 오른쪽 아래에서 솟아오르고, 누르면 부드럽게 맨 위로 올라간 뒤 사라진다.
 * 자리는 **지도 알약과 같은 높이의 오른쪽**이다 — 알약이 가운데라 둘이 겹치지 않는다. 폰 전용(`lg:hidden`).
 * 스크롤 리스너는 `passive` 이고 상태는 보임/숨김 둘뿐이라 스크롤마다 다시 그리지 않는다.
 */
import { useEffect, useState } from 'react'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-top', `.ur-top { opacity: 0; transform: translateY(16px) scale(.8); pointer-events: none; transition: opacity .2s ease-out, transform .3s cubic-bezier(.2,1,.3,1); }.ur-top.on { opacity: 1; transform: none; pointer-events: auto; }@media (prefers-reduced-motion: reduce){.ur-top{transition:none!important}}`)

const SHOW_AFTER = 1400

export default function BackToTop() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const read = () => setOn(window.scrollY > SHOW_AFTER)
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [])
  const goTop = () => {
    let reduce = false
    try { reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { /* 미지원 */ }
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }
  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="맨 위로"
      tabIndex={on ? 0 : -1}
      className={`ur-top ${on ? 'on' : ''} lg:hidden hide-on-keyboard fixed right-4 z-40 w-11 h-11 rounded-full bg-surface text-gray-900 dark:text-white shadow-lift flex items-center justify-center`}
      style={{ bottom: 'calc(56px + 12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
    </button>
  )
}
