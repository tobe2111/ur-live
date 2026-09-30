/**
 * 🗺️ **지도 바텀시트 제스처** 〔2026-09-30〕
 *
 * 대표: *"지도 페이지에서 스크롤 올리고 내리는게 편하지 않아. 새로고침으로 적용되거나.."*
 *
 * ## 무엇이었나 — 셋이 겹쳐 있었다. 셋 다 에러를 안 낸다.
 *  ① **위임이 조용히 죽었다.** 모바일에서 핀을 고르면 시트가 통째로 언마운트되고, 닫으면 React 가
 *     **새 노드**를 만든다. 그런데 터치 위임 effect 의 deps 가 전부 불변이라 다시 돌지 않아,
 *     리스너가 떨어져 나간 옛 노드에 남았다. 비-full 스냅은 `touch-action:none` 이라 네이티브도
 *     없어서 **리스트가 통째로 얼었다** — 새로고침해야 돌아온다.
 *  ② **얼어붙는 제스처가 하나 더.** 종전 분기는 `(위로 && 비-full) || (아래로 && scrollTop<=0)`
 *     만 시트로 보내고 나머지는 "네이티브에 위임" 이었는데, 비-full 엔 그 네이티브가 꺼져 있다.
 *  ③ **당겨서-새로고침.** `overscroll-behavior` 가 리스트에만 있어, 리스트 **밖**(필터 바·핸들
 *     여백)에서 아래로 당기면 문서까지 올라가 브라우저가 새로고침했다.
 *
 * ## 이 시험이 **못** 보는 것
 * jsdom 엔 레이아웃도 실제 스크롤도 없다. 그래서 "시트가 몇 px 움직였나" 는 못 잰다 —
 * **누가 그 제스처를 받았는가**(preventDefault 여부)로 판정한다. 실제 감촉은 기기에서 봐야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRef } from 'react'
import { render, act } from '@testing-library/react'
import { useSheetDrag, type SheetSnap } from '@/pages/restaurant-map/useSheetDrag'

/**
 * 🩸 **모듈 스코프에 둔 이유**(이 시험을 처음 쓸 때 실제로 밟았다): 여기를 인라인 화살표
 *   `setSheetSnap={() => {}}` 로 쓰면 **매 렌더 새 함수**라 `finish` 의 identity 가 바뀌고,
 *   그 때문에 위임 effect 가 매 렌더 다시 붙어 **재마운트 결함이 저절로 가려졌다**
 *   (주입 러너가 "이 가드는 아무것도 안 지킨다" 로 잡아 줬다). 실제 페이지는 `useState` 세터라
 *   **안정적**이다 — 픽스처도 그래야 같은 것을 잰다.
 */
const STABLE_SET_SNAP = () => {}

function Harness({ snap, showSheet = true, enabled = true }: { snap: SheetSnap; showSheet?: boolean; enabled?: boolean }) {
  const listRef = useRef<HTMLDivElement>(null)
  const { sheetRef } = useSheetDrag({ sheetSnap: snap, setSheetSnap: STABLE_SET_SNAP, enabled, listRef })
  if (!showSheet) return null
  return (
    <div ref={sheetRef} data-testid="sheet">
      <div data-testid="bar">358곳 · 거리순</div>
      <div ref={listRef} data-testid="list">목록</div>
    </div>
  )
}

/** 터치 한 번. jsdom 에 TouchEvent 가 없어 Event 에 touches 를 얹는다. */
function touch(el: Element, type: string, x: number, y: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] })
  act(() => { el.dispatchEvent(ev) })
  return ev
}

/** 끌어 보고 **시트가 받았는지**(=기본동작을 막았는지) 돌려준다. */
function drag(el: Element, from: [number, number], to: [number, number]) {
  touch(el, 'touchstart', ...from)
  const moved = touch(el, 'touchmove', ...to)
  touch(el, 'touchend', ...to)
  return moved.defaultPrevented
}

beforeEach(() => { document.documentElement.style.overscrollBehaviorY = '' })

describe('① 비-full 스냅에서는 어느 방향이든 시트가 받는다 (얼지 않는다)', () => {
  for (const snap of ['peek', 'mid'] as const) {
    it(`🔴 ${snap}: 위로 끌면 시트가 받는다`, () => {
      const { getByTestId } = render(<Harness snap={snap} />)
      expect(drag(getByTestId('list'), [100, 300], [100, 240])).toBe(true)
    })

    it(`🔴 ${snap}: **목록을 이미 스크롤해 둔 상태**에서 아래로 끌어도 시트가 받는다`, () => {
      // 종전엔 여기서 mode='scroll' 로 빠지고, 그 네이티브가 touch-action:none 으로 꺼져 있어
      // 손가락이 움직여도 화면이 한 픽셀도 안 움직였다 — 대표가 말한 "편하지 않아"의 정체.
      const { getByTestId } = render(<Harness snap={snap} />)
      const list = getByTestId('list')
      list.scrollTop = 300
      expect(drag(list, [100, 300], [100, 360])).toBe(true)
    })
  }

  it('full 에서 목록을 스크롤 중이면 시트가 가로채지 않는다 (네이티브 스크롤이 살아 있어야 한다)', () => {
    const { getByTestId } = render(<Harness snap="full" />)
    const list = getByTestId('list')
    list.scrollTop = 300
    expect(drag(list, [100, 300], [100, 360])).toBe(false)
  })

  it('full + 맨 위에서 아래로 당기면 시트가 접힌다', () => {
    const { getByTestId } = render(<Harness snap="full" />)
    const list = getByTestId('list')
    list.scrollTop = 0
    expect(drag(list, [100, 300], [100, 360])).toBe(true)
  })
})

describe('② 시트 몸통 어디를 잡아도 끌린다 — 28px 핸들만이 아니다', () => {
  it('🔴 "N곳 · 거리순" 바를 끌면 시트가 움직인다', () => {
    const { getByTestId } = render(<Harness snap="mid" />)
    expect(drag(getByTestId('bar'), [100, 300], [100, 380])).toBe(true)
  })

  it('🔴 가로 제스처는 가로채지 않는다 (카테고리 칩 줄이 가로 스크롤이다)', () => {
    // ⚠️ dy 는 **6px 문턱을 넘겨야** 한다 — 안 넘기면 축 판정에 닿지도 않고 통과해 버린다
    //    (처음 이 시험을 dy=4 로 썼다가 주입 러너에게 "헛돈다" 고 잡혔다).
    const { getByTestId } = render(<Harness snap="mid" />)
    expect(drag(getByTestId('bar'), [100, 300], [200, 310])).toBe(false)
  })

  it('🔴 탭은 드래그가 아니다 — 버튼이 계속 눌려야 한다', () => {
    const { getByTestId } = render(<Harness snap="mid" />)
    expect(drag(getByTestId('bar'), [100, 300], [101, 302])).toBe(false)
  })
})

describe('③ 시트가 다시 마운트돼도 위임이 살아 있다 (핀 눌렀다 닫은 뒤)', () => {
  it('🔴 언마운트 → 재마운트 후에도 제스처가 먹는다', () => {
    const { getByTestId, rerender } = render(<Harness snap="mid" />)
    expect(drag(getByTestId('list'), [100, 300], [100, 240])).toBe(true)

    rerender(<Harness snap="mid" showSheet={false} />)   // 핀 선택 — 시트 언마운트
    rerender(<Harness snap="mid" showSheet />)           // 닫음 — React 가 **새 노드**를 만든다

    // 종전에는 리스너가 옛 노드에 남아 여기서 false 였다(= 시트가 얼어붙었다).
    expect(drag(getByTestId('list'), [100, 300], [100, 240])).toBe(true)
    expect(drag(getByTestId('bar'), [100, 300], [100, 380])).toBe(true)
  })
})

describe('④ 당겨서-새로고침을 막는다 (페이지가 떠 있는 동안만)', () => {
  it('🔴 마운트되면 문서에 overscroll 잠금이 걸린다', () => {
    render(<Harness snap="mid" />)
    expect(document.documentElement.style.overscrollBehaviorY).toBe('none')
  })

  it('🔴 언마운트하면 되돌린다 — 전역으로 남기지 않는다', () => {
    const { unmount } = render(<Harness snap="mid" />)
    unmount()
    expect(document.documentElement.style.overscrollBehaviorY).toBe('')
  })

  it('PC(좌측 고정 패널)에서는 걸지 않는다 — 거기엔 시트가 없다', () => {
    render(<Harness snap="full" enabled={false} />)
    expect(document.documentElement.style.overscrollBehaviorY).toBe('')
  })
})

describe('⑤ 배선 — 페이지가 이 훅을 실제로 쓴다', () => {
  it('🔴 시트 노드와 목록이 훅에 연결돼 있다', async () => {
    const src = (await import('node:fs')).readFileSync('src/pages/RestaurantMapPage.tsx', 'utf8')
    expect(src).toContain('listRef: listScrollRef')
    expect(src).toContain('ref={sheetRef}')
    expect(src).toContain('ref={listScrollRef}')
  })
})

// 시트 드래그는 rAF 로 DOM 을 직접 만진다 — 테스트가 끝나기 전에 비워 준다.
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
