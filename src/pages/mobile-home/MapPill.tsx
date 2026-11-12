/**
 * 🗺️ 모바일 홈 지도 알약 (2026-10-14 대표 확정 — 다안 · A *"작은 잉크 알약"*).
 *
 * 종전엔 위치 제목 옆 [목록|지도] 전환이 지도로 가는 길이었는데, 머리 전체가 `sticky` 라 늘 화면
 * 위쪽을 차지했다. 그 전환을 걷고 **하단 탭 바로 위 가운데**에 알약 하나를 늘 띄운다(에어비앤비 방식).
 *
 * - 크기: 높이 32px · 13px 글자 — 시안 1차(48px)는 "좀 큰데?" 로 반려됐다.
 * - 색: 라이트 = 잉크 면 + 흰 글자 / 다크 = 흰 면 + 잉크 글자. **늘 바탕의 반대**라 어떤 사진 위에서도
 *   읽힌다(다크에서 검정을 그대로 두면 바탕에 묻힌다 — 시안에서 확인).
 * - 자리: 하단 탭(56px + 홈 인디케이터) 위 12px. 탭과 같은 `hide-on-keyboard` — 키보드가 뜨면 함께 숨는다.
 * - z: 콘텐츠 위 · 모달(10500)·하단 탭(9999) 아래.
 *
 * 🎬 2026-11-02 대표 *"홈 지도 버튼 모션 A, D, E 빼고 넣어주고"* → **B · C** 두 가지:
 *   B. 목록을 내리는 동안엔 "지도" 글자가 접혀 아이콘만 남고, 손을 멈추면(0.35초) 다시 펼쳐진다 — 카드를 덜 가린다.
 *   C. 누르면 알약 자리에서 지도 화면이 원으로 퍼진다(View Transitions). 지원 안 하는 브라우저·동작 줄이기·
 *      새 탭 열기(⌘/Ctrl/가운데 클릭)는 종전 링크 이동 그대로다. 이동 자체는 늘 일어난다.
 *
 * ⚠️ 하단 탭에 지도가 없으므로 이 알약이 **유일한 통로**다 — 지우지 말 것.
 */
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { quietVt } from '@/lib/vt-quiet'
import { Link, useNavigate } from 'react-router-dom'
import { MapFoldIcon } from '@/components/icons/urdeal-icons'
import { warmKakaoMapsAfterLoad, preconnectMapTiles } from './map-warmup'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-mappill', `.ur-mp-lbl { display: inline-block; overflow: hidden; white-space: nowrap; max-width: 3em; transition: max-width .3s cubic-bezier(.2,1,.3,1), opacity .2s; }.ur-mp.small { padding-left: 9px; padding-right: 9px; gap: 0; }.ur-mp.small .ur-mp-lbl { max-width: 0; opacity: 0; }.ur-mp { transition: padding .3s cubic-bezier(.2,1,.3,1), transform .15s; }@keyframes ur-map-reveal { from { clip-path: circle(0px at var(--ur-mp-x, 50%) var(--ur-mp-y, 90%)); } to { clip-path: circle(150vmax at var(--ur-mp-x, 50%) var(--ur-mp-y, 90%)); } }html.ur-vt-map::view-transition-old(root) { animation-duration: 0s; }html.ur-vt-map::view-transition-new(root) { animation: ur-map-reveal .5s cubic-bezier(.65,0,.35,1) both; }@media (prefers-reduced-motion: reduce){.ur-mp,.ur-mp-lbl{transition:none!important}html.ur-vt-map::view-transition-new(root){animation:none!important}}`)

const SETTLE_MS = 350
type VTDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } }

export default function MapPill() {
  // 🗺️ 2026-10-15 홈이 다 뜬 뒤 지도 SDK 를 미리 받아 둔다 — 누르면 SDK 왕복 셋을 기다리지 않는다(`map-warmup.ts`).
  useEffect(() => warmKakaoMapsAfterLoad(), [])
  const navigate = useNavigate()

  // B — 내리는 중엔 작게. 상태는 '작다/크다' 둘뿐이라 스크롤마다 다시 그리지 않는다.
  const [small, setSmall] = useState(false)
  const settle = useRef<number | undefined>(undefined)
  useEffect(() => {
    const onScroll = () => {
      setSmall(true)
      window.clearTimeout(settle.current)
      settle.current = window.setTimeout(() => setSmall(false), SETTLE_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(settle.current) }
  }, [])

  // C — 알약 자리에서 지도가 원으로 퍼진다.
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const doc = document as VTDoc
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (typeof doc.startViewTransition !== 'function') return
    try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { return }
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--ur-mp-x', `${Math.round(r.left + r.width / 2)}px`)
    root.style.setProperty('--ur-mp-y', `${Math.round(r.top + r.height / 2)}px`)
    root.classList.add('ur-vt-map')
    const done = () => { root.classList.remove('ur-vt-map') }
    try {
      quietVt(doc.startViewTransition(() => { flushSync(() => navigate('/map')) })).finished.catch(() => {}).finally(done)
    } catch {
      done()
      navigate('/map')
    }
  }

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none hide-on-keyboard"
      style={{ bottom: 'calc(56px + 12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <Link
        to="/map"
        aria-label="지도로 보기"
        onPointerDown={preconnectMapTiles}
        onClick={onClick}
        // 면 = `--ink`(라이트 #16181C · 다크 #F8F7FC) · 글자 = `--surface` — 토큰이 모드마다 뒤집혀 늘 바탕의 반대다.
        className={`ur-mp${small ? ' small' : ''} pointer-events-auto inline-flex h-8 items-center gap-1 rounded-full bg-ink px-4 text-[13px] font-medium text-surface shadow-[0_4px_12px_rgba(0,0,0,0.25)] active:scale-95`}
      >
        <MapFoldIcon size={15} />
        <span className="ur-mp-lbl">지도</span>
      </Link>
    </div>
  )
}
