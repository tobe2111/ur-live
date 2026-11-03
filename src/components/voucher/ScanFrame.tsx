/**
 * 🎬 사장님 QR 스캔 틀 (2026-11-02 시안 5차 "QR 찾기 → 잡음", 대표 *"5차 시안 다 해주면 좋겠어"*).
 *   찾는 동안: 네 모서리가 숨 쉬듯 살짝 커졌다 작아진다.
 *   잡으면(확인창이 뜨는 순간): 틀이 조여지며 모서리가 파랗게 바뀐다 — 손님 앞에서 "잡았다" 가 보인다.
 *   transform · 색만 움직이고, 동작 줄이기면 멈춘다.
 */
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-scanframe', `@keyframes ur-scan-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }.ur-scan-frame { transition: transform .3s cubic-bezier(.2,1,.3,1); }.ur-scan-frame.seek { animation: ur-scan-breathe 1.4s ease-in-out infinite; }.ur-scan-frame.lock { transform: scale(.62); }.ur-scan-frame i { position: absolute; width: 30px; height: 30px; border: 0 solid rgba(255,255,255,.9); transition: border-color .2s; }.ur-scan-frame.lock i { border-color: var(--brand); }@media (prefers-reduced-motion: reduce){.ur-scan-frame.seek{animation:none!important}.ur-scan-frame{transition:none!important}}`)

const CORNERS = [
  { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 14 },
  { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 14 },
  { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 14 },
  { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 14 },
]

export default function ScanFrame({ locked }: { locked: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className={`ur-scan-frame relative w-52 h-52 ${locked ? 'lock' : 'seek'}`} aria-hidden="true">
        {CORNERS.map((s, k) => <i key={k} style={s} />)}
      </div>
    </div>
  )
}
