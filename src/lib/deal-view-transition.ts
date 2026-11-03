/**
 * 🎬 목록 카드 → 상세: 누른 사진이 그대로 커져 상세 맨 위 사진이 된다 (2026-11-02 [UNLOCK_LOADING] 시안 D3,
 *    대표 승인 "셋 다 넣기").
 *
 * 브라우저의 View Transitions API 를 쓴다(라우터가 BrowserRouter 라 `<Link viewTransition>` 은 못 쓴다).
 *   1) 카드 사진에 이름(`ur-deal-hero`)을 붙인다 — 브라우저가 지금 화면을 찍는다.
 *   2) 그 안에서 이동하고, 상세의 첫 사진(같은 이름)이 생길 때까지 **최대 300ms** 만 기다린다.
 *   3) 브라우저가 두 사진 사이를 이어 그린다.
 *
 * 🔒 지키는 것(로딩 잠금):
 *   - 미리 받기·캐시·청크 준비는 손대지 않는다. 이동 자체는 늘 일어난다 — 기다림이 끝나지 않아도
 *     300ms 뒤엔 화면을 넘긴다(상세가 아직 안 그려졌으면 그냥 바뀐 화면으로 넘어간다).
 *   - 지원 안 하는 브라우저 · '동작 줄이기' · 새 탭 열기(⌘/Ctrl/가운데 클릭)는 **종전 그대로** 이동한다.
 */
import { flushSync } from 'react-dom'
import { DEAL_HERO_VT } from './deal-vt-name'

const HERO_WAIT_MS = 300

/**
 * ⚖️ 전환용 CSS 는 여기서 한 번만 꽂는다 — index.css 에 두면 카드가 없는 화면까지 받는다(2026-11-02 화면별 무게 예산 실측).
 *   (이 파일을 동적 import 로 미뤄도 묶음기가 공용 청크에 그대로 둬서 이득이 없었다 — 측정 후 되돌렸다.)
 */
let styled = false
function ensureStyle(): void {
  if (styled || typeof document === 'undefined') return
  styled = true
  const s = document.createElement('style')
  s.textContent = `::view-transition-old(root),::view-transition-new(root){animation-duration:.2s}`
    + `::view-transition-group(${DEAL_HERO_VT}){animation-duration:.34s;animation-timing-function:cubic-bezier(.65,0,.35,1)}`
    + `::view-transition-old(${DEAL_HERO_VT}),::view-transition-new(${DEAL_HERO_VT}){height:100%;object-fit:cover}`
    + `@media (prefers-reduced-motion: reduce){::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}}`
  document.head.appendChild(s)
}
ensureStyle()

type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } }

function reducedMotion(): boolean {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** 이 클릭을 우리가 맡아도 되는가 — 아니면 링크 기본 동작에 맡긴다. */
export function canRunDealTransition(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }): boolean {
  if (typeof document === 'undefined') return false
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  if (typeof (document as VTDoc).startViewTransition !== 'function') return false
  return !reducedMotion()
}

/**
 * 🩸 2026-11-03 (대표 *"숙소 이용권만 클릭하면 로딩이 상대적으로 길어"*): 여기는 `requestAnimationFrame` 으로 돌았다.
 *   그런데 전환 도중(브라우저가 화면을 얼려 둔 동안)에는 **그리기가 멈춰 rAF 가 안 돈다** → 상세 사진이 아직 없으면
 *   이 약속이 끝나지 않고, 브라우저가 약 4초 뒤 `TimeoutError: Transition was aborted … DOM update timed out` 으로
 *   끊었다. 그 4초 동안 화면은 **이전 화면에 멈춰** 있었다. 이용권 상세는 청크를 미리 받아 첫 확인에서 사진이 이미 있어서
 *   안 드러났고, 숙소는 청크를 누른 뒤에 받아 매번 걸렸다(실측: 숙소만 오류 보고가 나갔다).
 *   ⇒ 타이머로 센다. 타이머는 전환 중에도 돈다. 그리고 300ms 상한은 따로 걸어 **무슨 일이 있어도** 끝난다.
 */
function waitForHero(): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector('[data-vt-hero]')) { resolve(); return }
    const cap = setTimeout(done, HERO_WAIT_MS)
    const poll = setInterval(() => { if (document.querySelector('[data-vt-hero]')) done() }, 16)
    function done() { clearTimeout(cap); clearInterval(poll); resolve() }
  })
}

/** 카드 사진(img)을 상세 첫 사진으로 이어 그리며 이동한다. */
export function runDealTransition(cardImage: HTMLElement | null, go: () => void): void {
  const doc = document as VTDoc
  if (cardImage) cardImage.style.viewTransitionName = DEAL_HERO_VT
  try {
    const vt = doc.startViewTransition!(async () => {
      if (cardImage) cardImage.style.viewTransitionName = ''
      flushSync(go)
      await waitForHero()
    })
    vt.finished.catch(() => {}).finally(() => { if (cardImage) cardImage.style.viewTransitionName = '' })
  } catch {
    if (cardImage) cardImage.style.viewTransitionName = ''
    go()
  }
}
