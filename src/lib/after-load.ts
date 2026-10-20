/**
 * ⏳ 페이지가 다 뜬 뒤(window `load`) + 한가할 때 한 번 실행한다. 취소 함수를 돌려준다.
 *
 * 2026-10-13 (대표 승인 — 홈 카드 미리받기를 첫 화면 뒤로):
 *   `requestIdleCallback` 만으로는 부족하다 — 부팅 중에도 네트워크 대기로 한가한 구간이 계속 생겨서,
 *   "첫 화면 뒤" 를 의도한 일이 **첫 화면 사진·스크립트와 같은 회선을** 나눠 쓰게 된다
 *   (2026-10-12 센트리가 정확히 그랬다 — main.tsx 의 같은 처방).
 *   ⇒ `load` 를 먼저 기다리고, 그 다음 한가할 때. 이미 `load` 가 지났으면 바로 한가할 때로.
 */
export function runAfterLoad(fn: () => void, idleTimeout = 2500): () => void {
  if (typeof window === 'undefined') return () => {}
  let cancelled = false
  let idleHandle: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const schedule = () => {
    if (cancelled) return
    if (ric) idleHandle = ric(() => { if (!cancelled) fn() }, { timeout: idleTimeout })
    else timer = setTimeout(() => { if (!cancelled) fn() }, 300)
  }
  const onLoad = () => schedule()
  if (document.readyState === 'complete') schedule()
  else window.addEventListener('load', onLoad, { once: true })
  return () => {
    cancelled = true
    window.removeEventListener('load', onLoad)
    if (idleHandle !== undefined) (window as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(idleHandle)
    if (timer !== undefined) clearTimeout(timer)
  }
}
