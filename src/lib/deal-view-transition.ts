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

export const DEAL_HERO_VT = 'ur-deal-hero'
const HERO_WAIT_MS = 300

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

function waitForHero(): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const tick = () => {
      if (document.querySelector('[data-vt-hero]') || performance.now() - t0 > HERO_WAIT_MS) resolve()
      else requestAnimationFrame(tick)
    }
    tick()
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
