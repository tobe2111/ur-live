import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

/**
 * 🗺️ 2026-07-25 (대표 "버벅거림/불완전한 스와이프" — 지도 전수조사 H1/H2/H4/M1/M2):
 *   동네딜 지도 바텀시트 드래그를 페이지 밖 훅으로 추출 + 근본 재설계.
 *
 *   [H1] 기존: 매 touchmove 마다 setState(dragDeltaY) → 988줄 페이지 전체가 60~120Hz 리렌더 →
 *        시트가 손가락을 늦게 따라오고 프레임 드랍. → 드래그 중엔 state 를 건드리지 않고
 *        ref + requestAnimationFrame 으로 시트 DOM 의 transform 만 직접 갱신, 릴리즈 때만 snap state 커밋.
 *   [H2] 기존: 드래그 추적이 ±200/400px 클램프(실거리 500px+)라 손가락은 가는데 시트가 멈춤 +
 *        스냅이 top(레이아웃 속성) 애니메이션이라 300ms 내내 layout+paint. → 시트 top 은 full 위치로
 *        '고정'하고 snap 위치/드래그를 전부 transform(translateY, 컴포지터 전용)으로만. 클램프는
 *        full~peek 실제 한계.
 *   [H4] 기존: 확장 제스처가 28px 핸들에서만 가능 — 리스트 위 스와이프론 시트가 안 움직임.
 *        → 리스트 영역 터치 위임(당근/야놀자식): 비-full 상태의 상향 제스처, scrollTop 0 에서의
 *        하향 제스처는 시트 드래그로 라우팅. (React 루트 touchmove 는 passive 라 preventDefault 불가 →
 *        네이티브 non-passive 리스너 직접 부착.)
 *   [M1] 핸들 드래그를 Pointer Events + setPointerCapture 로 — 커서가 핸들을 벗어나도 드래그 유지
 *        (기존 onMouseLeave 강제 종료/move 유실 제거).
 *   [M2] 릴리즈 판정에 지수평활 velocity(px/ms) + 관성 투영(~160ms) — 현재 위치에서 가장 가까운
 *        snap 선택 + 빠른 플릭은 최소 한 단계 보장. (기존 절대 px 임계 30/150 제거.)
 *
 *   ⚠️ 시각적 snap top 설계값은 기존 sheetTopByState 와 동일(peek: 100dvh-240px · mid: 40dvh ·
 *      full: safe-area+104px). useKakaoMap 의 centerOffsetForSheet 가 이 값을 미러 — 변경 시 함께 갱신.
 */

export type SheetSnap = 'peek' | 'mid' | 'full'

/** 시트 top 고정값 = full 위치. 이동은 전부 transform 으로(레이아웃 불변 → 컴포지터 애니메이션). */
export const SHEET_BASE_TOP = 'calc(env(safe-area-inset-top, 0px) + 104px)'
export const SHEET_SNAP_TRANSLATE: Record<SheetSnap, string> = {
  full: 'translateY(0px)',
  mid: 'translateY(calc(40dvh - env(safe-area-inset-top, 0px) - 104px))',
  peek: 'translateY(calc(100dvh - 240px - env(safe-area-inset-top, 0px) - 104px))',
}
export const SHEET_SNAP_TRANSITION = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'

interface DragSession {
  ty0: number            // 드래그 시작 시점의 translateY(px)
  startY: number
  lastY: number
  lastT: number
  vy: number             // 지수평활 속도(px/ms, +아래)
  midTy: number          // mid snap 의 translateY(px)
  peekTy: number         // peek snap 의 translateY(px) = 하한
  raf: number
  pendingTy: number | null
  startSnap: SheetSnap
}

export function useSheetDrag({
  sheetSnap,
  setSheetSnap,
  enabled,
  listRef,
}: {
  sheetSnap: SheetSnap
  setSheetSnap: (s: SheetSnap) => void
  /** 모바일(<lg)만 true — lg 좌측 고정 패널은 드래그 없음. */
  enabled: boolean
  /** 시트 안 스크롤 리스트(ScrollArea) — H4 콘텐츠 드래그 위임 대상. */
  listRef: React.RefObject<HTMLDivElement | null>
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const snapRef = useRef(sheetSnap); snapRef.current = sheetSnap
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  const session = useRef<DragSession | null>(null)

  const begin = useCallback((clientY: number) => {
    const el = sheetRef.current
    if (!el || !enabledRef.current || session.current) return
    let ty0 = 0
    try {
      const tr = getComputedStyle(el).transform
      if (tr && tr !== 'none') ty0 = new DOMMatrixReadOnly(tr).m42
    } catch { /* DOMMatrix 미지원 — 0 폴백(스냅 정지 상태 기준) */ }
    const baseTop = el.getBoundingClientRect().top - ty0 // = full top(px, safe-area 해석 완료)
    const H = window.innerHeight
    session.current = {
      ty0,
      startY: clientY, lastY: clientY, lastT: performance.now(), vy: 0,
      midTy: Math.max(0, H * 0.4 - baseTop),
      peekTy: Math.max(0, (H - 240) - baseTop),
      raf: 0, pendingTy: null, startSnap: snapRef.current,
    }
    setDragging(true)
  }, [])

  const move = useCallback((clientY: number) => {
    const s = session.current
    if (!s) return
    const now = performance.now()
    const dt = now - s.lastT
    if (dt > 0) s.vy = s.vy * 0.8 + ((clientY - s.lastY) / dt) * 0.2
    s.lastY = clientY; s.lastT = now
    s.pendingTy = Math.min(s.peekTy, Math.max(0, s.ty0 + (clientY - s.startY)))
    if (!s.raf) {
      s.raf = requestAnimationFrame(() => {
        const cur = session.current
        if (!cur) return
        cur.raf = 0
        const el = sheetRef.current
        if (el && cur.pendingTy != null) el.style.transform = `translateY(${cur.pendingTy}px)`
      })
    }
  }, [])

  const finish = useCallback(() => {
    const s = session.current
    if (!s) return
    session.current = null
    if (s.raf) cancelAnimationFrame(s.raf)
    const el = sheetRef.current
    const curTy = s.pendingTy ?? s.ty0
    // 관성 투영(~160ms 앞) 위치에서 가장 가까운 snap
    const projected = curTy + s.vy * 160
    const entries: Array<[SheetSnap, number]> = [['full', 0], ['mid', s.midTy], ['peek', s.peekTy]]
    let target: SheetSnap = s.startSnap
    let best = Infinity
    for (const [snap, ty] of entries) {
      const diff = Math.abs(ty - projected)
      if (diff < best) { best = diff; target = snap }
    }
    // 빠른 플릭은 시작 snap 에서 진행방향으로 최소 한 단계 보장(짧지만 빠른 제스처 무시 방지)
    if (Math.abs(s.vy) > 0.5 && Math.abs(curTy - s.ty0) > 8) {
      const order: SheetSnap[] = ['full', 'mid', 'peek'] // translateY 오름차순
      const si = order.indexOf(s.startSnap)
      const stepped = order[Math.min(order.length - 1, Math.max(0, si + (s.vy > 0 ? 1 : -1)))]
      const ti = order.indexOf(target), pi = order.indexOf(stepped)
      if (s.vy > 0 ? ti < pi : ti > pi) target = stepped
    }
    setDragging(false)
    if (target !== snapRef.current) {
      setSheetSnap(target) // 렌더가 transition+새 transform 을 써서 현재 위치에서 스냅으로 애니메이션
    } else if (el) {
      // snap 미변경 — React style 문자열이 그대로라 DOM 재적용이 없음 → 수동 복귀 애니메이션
      el.style.transition = SHEET_SNAP_TRANSITION
      el.style.transform = SHEET_SNAP_TRANSLATE[target]
    }
  }, [setSheetSnap])

  // [M1] 핸들: Pointer Events + 캡처 — 마우스가 핸들 밖으로 나가도 드래그 유지(터치는 캡처 암묵).
  const handleProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabledRef.current) return
      try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* 미지원 무해 */ }
      begin(e.clientY)
    },
    onPointerMove: (e: React.PointerEvent) => move(e.clientY),
    onPointerUp: () => finish(),
    onPointerCancel: () => finish(),
  }

  // [H4] 리스트 콘텐츠 드래그 위임 — 비-full 상향 / scrollTop 0 하향 제스처를 시트 드래그로 라우팅.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    let mode: 'idle' | 'sheet' | 'scroll' = 'idle'
    let startY = 0
    const onStart = (e: TouchEvent) => {
      mode = 'idle'
      startY = e.touches[0]?.clientY ?? 0
    }
    const onMove = (e: TouchEvent) => {
      if (!enabledRef.current) return
      const y = e.touches[0]?.clientY
      if (y == null) return
      if (mode === 'idle') {
        const dy = y - startY
        if (Math.abs(dy) < 6) return
        if ((dy < 0 && snapRef.current !== 'full') || (dy > 0 && list.scrollTop <= 0)) {
          mode = 'sheet'
          begin(y)
        } else {
          mode = 'scroll' // full 상태의 리스트 스크롤 — 네이티브에 위임
        }
      }
      if (mode === 'sheet') {
        if (e.cancelable) e.preventDefault()
        move(y)
      }
    }
    const onEnd = () => {
      if (mode === 'sheet') finish()
      mode = 'idle'
    }
    list.addEventListener('touchstart', onStart, { passive: true })
    list.addEventListener('touchmove', onMove, { passive: false })
    list.addEventListener('touchend', onEnd, { passive: true })
    list.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      list.removeEventListener('touchstart', onStart)
      list.removeEventListener('touchmove', onMove)
      list.removeEventListener('touchend', onEnd)
      list.removeEventListener('touchcancel', onEnd)
    }
  }, [listRef, begin, move, finish])

  return { sheetRef, dragging, handleProps }
}
