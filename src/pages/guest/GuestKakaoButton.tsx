/**
 * 노란 카카오 버튼 — 로그인 전 탭 화면 세 곳이 **이것 하나**를 쓴다(문구만 다르다).
 * 색은 카카오 브랜드 규정값이라 토큰이 아니라 hex 다(로그인 화면 버튼과 같은 값).
 */
import { useTranslation } from '@/lib/i18n-lite'
import { startGuestKakaoLogin, useGuestLoginPrepare } from './guest-login'
import { GUEST_CLS, GUEST_COPY, KAKAO_BUBBLE_PATH } from '@/shared/guest-page'

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
// 🎬 2026-11-03 로그아웃 탭 — 카카오 버튼 위로 빛 한 줄이 몇 초마다 지나간다(누를 곳이 여기라는 신호).
//   버튼의 클래스는 서버 첫 화면(`guest-first-screen`)과 같아야 해서 손대지 않고, 안에 빛 칸만 하나 넣는다(`:has`).
injectMotionCss('ur-m-guestkakao', `button:has(> .ur-gk-shine) { transition: transform .12s ease-out; }button:has(> .ur-gk-shine):active { transform: scale(.97); }@keyframes ur-gk-sweep { 0% { transform: translateX(0); } 45%, 100% { transform: translateX(420%); } }button:has(> .ur-gk-shine) { position: relative; overflow: hidden; }.ur-gk-shine { position: absolute; inset: 0; pointer-events: none; }.ur-gk-shine::before { content: ''; position: absolute; top: 0; bottom: 0; left: -45%; width: 35%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.6), transparent); animation: ur-gk-sweep 3.8s ease-in-out 1.4s infinite; }@media (prefers-reduced-motion: reduce){.ur-gk-shine::before{animation:none!important;opacity:0}button:has(> .ur-gk-shine):active{transform:none}}`)

export default function GuestKakaoButton({ returnPath, label }: { returnPath: string; label?: string }) {
  const { t } = useTranslation()
  useGuestLoginPrepare(returnPath)
  return (
    <button
      type="button"
      onClick={(e) => {
        // 🎬 2026-11-03 로그아웃 2차 ⑥ — 누르면 말풍선이 톡 튄다(카카오로 넘어가기 직전 반응). 동작 줄이기면 없음.
        try { if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) e.currentTarget.querySelector('svg')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' }) } catch { /* 장식 */ }
        startGuestKakaoLogin(returnPath)
      }}
      className={GUEST_CLS.kakao}
    >
      <svg className={GUEST_CLS.kakaoIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d={KAKAO_BUBBLE_PATH} />
      </svg>
      <span>{label ?? t('guest.kakaoStart', { defaultValue: GUEST_COPY.kakaoStart })}</span>
      <span className={GUEST_CLS.kakaoShine} aria-hidden="true" />
    </button>
  )
}
