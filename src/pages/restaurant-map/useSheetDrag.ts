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
  const sheetEl = useRef<HTMLDivElement | null>(null)
  /**
   * 🐛 2026-09-30 — **위임이 조용히 죽던 자리**(대표 *"스크롤 올리고 내리는게 편하지 않아"*의 큰 몫).
   *
   *   시트는 모바일에서 핀을 고르면 통째로 언마운트된다(`{(!selected || isLgViewport) && …}`).
   *   닫으면 React 가 **새 DOM 노드**를 만든다. 그런데 아래 두 위임 effect 의 deps 는 전부
   *   불변(ref 객체·useCallback)이라 **다시 돌지 않았다** → 리스너가 떨어져 나간 옛 노드에 남고,
   *   비-full 스냅은 `touch-action:none` 이라 네이티브도 없어서 **리스트가 통째로 얼었다.**
   *   즉 "핀 한 번 눌렀다 닫으면 그 뒤로 시트가 안 움직인다" — 새로고침해야 돌아온다.
   *
   *   ⇒ 노드를 **state 로** 들고(콜백 ref) 두 effect 가 그 노드에 의존하게 한다. 노드가 바뀌면
   *     자동으로 다시 붙는다. 호출부는 `ref={sheetRef}` 그대로다(함수 ref 도 React 가 받는다).
   */
  const [sheetNode, setSheetNode] = useState<HTMLDivElement | null>(null)
  const sheetRef = useCallback((el: HTMLDivElement | null) => {
    sheetEl.current = el
    setSheetNode(el)
  }, [])
  const [dragging, setDragging] = useState(false)
  const snapRef = useRef(sheetSnap); snapRef.current = sheetSnap
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  const session = useRef<DragSession | null>(null)

  const begin = useCallback((clientY: number) => {
    const el = sheetEl.current
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
        const el = sheetEl.current
        if (el && cur.pendingTy != null) el.style.transform = `translateY(${cur.pendingTy}px)`
      })
    }
  }, [])

  const finish = useCallback(() => {
    const s = session.current
    if (!s) return
    session.current = null
    if (s.raf) cancelAnimationFrame(s.raf)
    const el = sheetEl.current
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
    if (!sheetNode || !list) return
    let mode: 'idle' | 'sheet' | 'scroll' = 'idle'
    let startY = 0
    let startX = 0
    const onStart = (e: TouchEvent) => {
      mode = 'idle'
      startY = e.touches[0]?.clientY ?? 0
      startX = e.touches[0]?.clientX ?? 0
    }
    const onMove = (e: TouchEvent) => {
      if (!enabledRef.current) return
      const t = e.touches[0]
      if (!t) return
      const y = t.clientY
      if (mode === 'idle') {
        const dy = y - startY
        const dx = t.clientX - startX
        // 가로가 더 큰 제스처는 우리 것이 아니다(가로 스크롤 줄을 가로채지 않는다).
        if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(dx)) return
        /**
         * 🐛 2026-09-30 (대표 *"스크롤 올리고 내리는게 편하지 않아"*) — **얼어붙던 제스처**를 없앴다.
         *   종전 조건은 `(위로 && 비-full) || (아래로 && scrollTop<=0)` 이고, 나머지는 `mode='scroll'`
         *   = "네이티브에 위임" 이었다. 그런데 비-full 에서는 호출부가 `touch-action:none` 을 걸어
         *   **네이티브가 아예 없다.** 그래서 [full 에서 조금 스크롤 → mid 로 접음 → 아래로 스와이프]
         *   하면 `scrollTop>0` 이라 'scroll' 로 가고, 그 네이티브가 꺼져 있어 **아무것도 안 움직였다.**
         *   ⇒ 비-full 에서는 **방향과 무관하게 시트**가 받는다(당근/네이버지도와 같다). full 에서만
         *     네이티브 스크롤이고, 맨 위에서 아래로 당길 때만 시트가 접힌다.
         */
        if (snapRef.current !== 'full' || (dy > 0 && list.scrollTop <= 0)) {
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
  }, [listRef, begin, move, finish, sheetNode])

  /**
   * 🔽 **당겨서-새로고침 차단** (2026-09-30 대표 *"새로고침으로 적용되거나"*).
   *
   *   `overscroll-behavior` 는 **뷰포트를 스크롤하는 요소**(html)에 걸어야 브라우저의
   *   pull-to-refresh 가 멈춘다. 종전엔 리스트(`ScrollArea`)에만 `contain` 이 있어서,
   *   리스트 **밖**(시트 헤더·필터 바·핸들 여백·지도 가장자리)에서 아래로 당기면 제스처가
   *   문서까지 올라가 **새로고침**이 걸렸다. 지도는 자체 데이터 갱신을 가지고 있어
   *   페이지 새로고침은 얻을 게 없고 지금까지 본 결과·위치를 통째로 버린다.
   *
   *   ⚠️ 이 페이지가 떠 있는 동안만이다 — 언마운트하면 원래 값으로 되돌린다(전역 변경 아님).
   *   (`html.native-app` 은 이미 `overscroll-behavior: none` 이라 웹에서만 실질 변화다.)
   */
  useEffect(() => {
    if (!enabled) return
    const el = document.documentElement
    const prev = el.style.overscrollBehaviorY
    el.style.overscrollBehaviorY = 'none'
    return () => { el.style.overscrollBehaviorY = prev }
  }, [enabled])

  /**
   * 🖐️ **시트 몸통 어디를 잡아도 끌린다** (2026-09-30 대표 *"스크롤 올리고 내리는게 편하지 않아"*).
   *
   *   종전에 시트를 움직일 수 있는 자리는 **28px 짜리 핸들 하나**뿐이었다. 바로 아래
   *   "N곳 · 거리순" 바를 잡고 끌면 아무 일도 안 났고(그 제스처는 문서로 새어 새로고침이 됐다),
   *   사람은 그 얇은 막대를 정확히 집어야 했다. ⇒ 리스트 **밖**의 시트 영역 전체를 손잡이로 쓴다.
   *
   *   🔒 버튼을 죽이지 않는다: `touchmove` 기준이라 **탭은 6px 를 못 넘어** 그대로 눌린다.
   *      드래그로 판정된 뒤에만 `preventDefault()` 가 나가고, 그때는 클릭도 같이 취소되는 게 맞다.
   *   🔒 가로 스크롤(카테고리 칩 줄)을 가로채지 않는다: `|dy| > |dx|` 일 때만 받는다.
   */
  useEffect(() => {
    const sheet = sheetNode
    if (!sheet) return
    let mode: 'idle' | 'sheet' | 'no' = 'idle'
    let startY = 0
    let startX = 0
    const onStart = (e: TouchEvent) => {
      // 리스트 안쪽은 위 위임이 주인이다 — 여기서 또 잡으면 두 번 센다.
      mode = listRef.current?.contains(e.target as Node) ? 'no' : 'idle'
      startY = e.touches[0]?.clientY ?? 0
      startX = e.touches[0]?.clientX ?? 0
    }
    const onMove = (e: TouchEvent) => {
      if (mode === 'no' || !enabledRef.current) return
      const t = e.touches[0]
      if (!t) return
      if (mode === 'idle') {
        const dy = t.clientY - startY
        if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(t.clientX - startX)) return
        mode = 'sheet'
        begin(t.clientY)
      }
      if (e.cancelable) e.preventDefault()
      move(t.clientY)
    }
    const onEnd = () => {
      if (mode === 'sheet') finish()
      mode = 'idle'
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd, { passive: true })
    sheet.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [listRef, begin, move, finish, enabled, sheetNode])

  return { sheetRef, dragging, handleProps }
}
