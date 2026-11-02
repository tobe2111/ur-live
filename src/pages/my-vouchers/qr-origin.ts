/**
 * 🎬 내 이용권 줄 → QR 화면: 누른 줄이 그대로 커져 QR 창이 된다 (2026-11-02 시안 3차, 대표 *"모두 좋다 그렇게 해줘"*).
 *
 * 줄(WalletRow)은 누를 때 자기 위치를 **여기에 적어 두고**, QR 창(QRModal)은 처음 그릴 때 그것을 **한 번 꺼내**
 * 그 자리에서부터 커진다. 부모(MyVouchersPage — 로딩 잠금 파일)는 건드리지 않는다.
 *   - 0.8초 안에 꺼내지 않으면 버린다(다른 경로로 연 QR 창이 엉뚱한 자리에서 커지지 않게).
 *   - 동작 줄이기면 아무것도 안 한다(종전 올라오는 창 그대로).
 *   - transform · opacity 만 움직인다.
 */
let origin: { rect: DOMRect; at: number } | null = null
const ORIGIN_TTL_MS = 800

function reducedMotion(): boolean {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function noteQrOrigin(el: Element | null): void {
  if (!el || reducedMotion()) { origin = null; return }
  origin = { rect: el.getBoundingClientRect(), at: performance.now() }
}

export function takeQrOrigin(): DOMRect | null {
  const o = origin
  origin = null
  if (!o || performance.now() - o.at > ORIGIN_TTL_MS) return null
  return o.rect
}

/** 창(panel)을 줄의 자리(from)에서 제자리로 키운다. */
export function growFrom(panel: HTMLElement | null, from: DOMRect | null): void {
  if (!panel || !from || typeof panel.animate !== 'function') return
  const to = panel.getBoundingClientRect()
  if (!to.width || !to.height) return
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const sx = Math.max(0.2, from.width / to.width)
  const sy = Math.max(0.1, from.height / to.height)
  panel.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.5 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 340, easing: 'cubic-bezier(.2,1,.3,1)' },
  )
}
