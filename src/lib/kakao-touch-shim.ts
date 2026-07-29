/**
 * 🗺️ 2026-07-27 (대표 신고 "PC F12 모바일 에뮬레이션에서 지도 스와이프가 아예 안 됨" — 전수조사):
 *   Kakao Maps 터치→마우스 어댑터(shim).
 *
 * 원인 (SDK 소스 실측 — core 4.5.13):
 *   카카오맵 코어가 입력 모드를 로드 시점에 단 한 번 판정한다:
 *     H = "ontouchstart" in document.documentElement && (UA에 "Chrome" 없음 || UA에 "Android" 있음)
 *   H=true 면 터치 핸들러만, H=false 면 마우스 핸들러만 바인딩(둘 다 아님).
 *   → "데스크톱 Chrome UA + 터치 입력" 조합에선 카카오가 마우스만 듣는데 브라우저는 터치 이벤트를
 *     보냄 → 지도 팬/드래그 완전 불능. 해당 환경:
 *     ① Chrome DevTools 모바일 에뮬레이션의 기본 "Responsive" 모드(UA 스푸핑 없음 — 대표 재현 조건.
 *        Pixel/iPhone 프리셋은 UA 스푸핑으로 H=true 라 정상)
 *     ② Windows 터치 노트북/서피스 등 터치스크린 데스크톱 Chrome/Edge — 실사용자도 터치로 지도 조작 불가
 *
 * 수리: 위 환경에서만 지도 컨테이너의 터치 제스처를 마우스 이벤트로 변환해 카카오의 마우스 핸들러에
 *   전달. 8px 이동 임계 전(=탭)엔 아무것도 합성하지 않고 브라우저 호환 마우스 이벤트(click 포함)에
 *   위임 → 핀/오버레이 클릭 정상. 드래그로 판정되면 mousedown(실터치 지점의 요소로 dispatch — 카카오
 *   내부 노드 리스너 도달) + mousemove/mouseup(document) 합성 + preventDefault 로 네이티브 스크롤/호환
 *   이벤트 억제. 핀치(2지) 진입 시 드래그 종료(데스크톱 카카오는 핀치 줌 미지원 — 휠/더블클릭 줌 사용).
 *
 * 검증 (2026-07-27, CDP 3시나리오 — 실제 카카오 SDK):
 *   A) Responsive 에뮬 + shim 없음 → 팬 FAIL(재현) · B) + shim → 팬 OK · C) Android UA → 원래 OK(무접촉)
 */

/** 카카오맵이 마우스 모드(H=false)로 바인딩되는데 터치 입력이 존재하는 환경인지 — core 판정식의 부정 미러. */
export function needsKakaoTouchShim(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    'ontouchstart' in document.documentElement &&
    ua.indexOf('Chrome') >= 0 &&
    ua.indexOf('Android') < 0
  )
}

interface SynthPoint { clientX: number; clientY: number; screenX: number; screenY: number }

/**
 * 지도 컨테이너에 터치→마우스 어댑터 부착. 필요 없는 환경(실폰/프리셋 에뮬 등)이면 no-op.
 * @returns 해제 함수
 */
export function attachKakaoTouchShim(el: HTMLElement): () => void {
  if (!needsKakaoTouchShim()) return () => {}

  let active = false
  let started = false
  let sx = 0
  let sy = 0

  const fire = (type: string, p: SynthPoint, buttons: number, target?: EventTarget) => {
    const ev = new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: p.clientX, clientY: p.clientY, screenX: p.screenX, screenY: p.screenY,
      button: 0, buttons,
    })
    ;(target || document).dispatchEvent(ev)
  }
  const endDrag = (p: SynthPoint) => {
    started = false
    fire('mouseup', p, 0)
  }

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      // 두 번째 손가락(핀치) — 진행 중이던 합성 드래그 종료
      if (started && e.touches.length > 0) endDrag(e.touches[0])
      active = false
      return
    }
    active = true
    started = false
    sx = e.touches[0].clientX
    sy = e.touches[0].clientY
  }
  const onMove = (e: TouchEvent) => {
    if (!active) return
    if (e.touches.length !== 1) { if (started) endDrag(e.touches[0]); active = false; return }
    const t = e.touches[0]
    if (!started) {
      // 8px 임계 전 = 탭 후보 — 합성 0(브라우저 호환 click 위임으로 핀 클릭 보존)
      if (Math.abs(t.clientX - sx) < 8 && Math.abs(t.clientY - sy) < 8) return
      started = true
      const downAt: SynthPoint = { clientX: sx, clientY: sy, screenX: sx, screenY: sy }
      fire('mousedown', downAt, 1, document.elementFromPoint(sx, sy) || el)
    }
    if (e.cancelable) e.preventDefault()
    fire('mousemove', t, 1)
  }
  const onEnd = (e: TouchEvent) => {
    if (!active) return
    active = false
    if (started) {
      const t = e.changedTouches[0]
      if (t) endDrag(t)
      // 드래그였음 — 브라우저 호환 마우스 이벤트(중복 click 등) 억제
      if (e.cancelable) e.preventDefault()
    }
    // 탭이면 합성 0 → 호환 click 이 핀/오버레이 클릭을 처리
  }

  el.addEventListener('touchstart', onStart, { capture: true, passive: true })
  el.addEventListener('touchmove', onMove, { capture: true, passive: false })
  el.addEventListener('touchend', onEnd, { capture: true, passive: false })
  el.addEventListener('touchcancel', onEnd, { capture: true, passive: false })
  return () => {
    el.removeEventListener('touchstart', onStart, { capture: true } as EventListenerOptions)
    el.removeEventListener('touchmove', onMove, { capture: true } as EventListenerOptions)
    el.removeEventListener('touchend', onEnd, { capture: true } as EventListenerOptions)
    el.removeEventListener('touchcancel', onEnd, { capture: true } as EventListenerOptions)
  }
}
