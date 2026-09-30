/**
 * 🧬 주입 — 지도 바텀시트 제스처 (2026-09-30)
 *   가드: src/tests/unit/map-sheet-gesture-2026-09-30.test.tsx
 *   셋 다 **에러를 안 내고 조용히 되돌아가는** 종류다 — 그래서 주입으로 고정한다.
 */
const HOOK = 'src/pages/restaurant-map/useSheetDrag.ts'
const T = 'src/tests/unit/map-sheet-gesture-2026-09-30.test.tsx'

export default [
  {
    name: '🗺️시트 비-full 에서 아래 제스처가 다시 얼어붙는다',
    file: HOOK,
    find: `        if (snapRef.current !== 'full' || (dy > 0 && list.scrollTop <= 0)) {`,
    replace: `        if ((dy < 0 && snapRef.current !== 'full') || (dy > 0 && list.scrollTop <= 0)) {`,
    test: T,
    why:
      '종전 조건이다. 나머지는 mode="scroll"(네이티브 위임)로 가는데 비-full 스냅은 호출부가 ' +
      '`touch-action:none` 을 걸어 **네이티브가 없다** → 손가락이 움직여도 아무것도 안 움직인다.',
  },
  {
    name: '🗺️시트 재마운트 후 위임이 죽는다(옛 노드에 리스너가 남는다)',
    file: HOOK,
    find: `  }, [listRef, begin, move, finish, sheetNode])`,
    replace: `  }, [listRef, begin, move, finish])`,
    test: T,
    why:
      '핀을 고르면 시트가 통째로 언마운트되고 닫으면 **새 노드**가 생긴다. deps 에 노드가 없으면 ' +
      'effect 가 다시 안 돌아 리스너가 떨어져 나간 옛 노드에 남는다 — "한 번 누르면 그 뒤로 안 움직임".',
  },
  {
    name: '🗺️시트 몸통 드래그가 사라진다(핸들 28px 로 되돌아감)',
    file: HOOK,
    find: `    sheet.addEventListener('touchmove', onMove, { passive: false })`,
    replace: `    sheet.addEventListener('touchmove', onMove, { passive: true })`,
    test: T,
    why:
      'passive 리스너는 preventDefault 를 못 한다 → 시트가 제스처를 못 가져가고 문서로 샌다. ' +
      '그 샘이 바로 당겨서-새로고침이었다.',
  },
  {
    name: '🗺️시트 몸통 드래그가 가로 스크롤을 가로챈다',
    file: HOOK,
    find: `        if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(t.clientX - startX)) return`,
    replace: `        if (Math.abs(dy) < 6) return`,
    test: T,
    why: '시트 헤더엔 가로 스크롤되는 카테고리 칩 줄이 있다. 축 판정이 없으면 옆으로 미는 동작이 시트를 끈다.',
  },
  {
    name: '🗺️당겨서-새로고침 잠금이 사라진다',
    file: HOOK,
    find: `    el.style.overscrollBehaviorY = 'none'`,
    replace: `    el.style.overscrollBehaviorY = ''`,
    test: T,
    why:
      '`overscroll-behavior` 는 **뷰포트를 스크롤하는 요소(html)** 에 걸어야 브라우저 pull-to-refresh 가 ' +
      '멈춘다. 리스트에만 `contain` 이 있으면 리스트 밖 제스처가 문서로 올라가 새로고침이 걸린다.',
  },
  {
    name: '🗺️당겨서-새로고침 잠금을 전역에 남긴다',
    file: HOOK,
    find: `    return () => { el.style.overscrollBehaviorY = prev }`,
    replace: `    return () => {}`,
    test: T,
    why: '지도를 떠난 뒤에도 남으면 다른 화면의 당겨서-새로고침까지 조용히 죽인다. 이 페이지가 떠 있는 동안만이다.',
  },
  {
    name: '🗺️리스트 안쪽 터치를 시트 몸통 위임이 또 잡는다',
    file: HOOK,
    find: `      mode = listRef.current?.contains(e.target as Node) ? 'no' : 'idle'`,
    replace: `      mode = 'idle'`,
    test: T,
    why:
      '터치는 버블링한다 — 리스트 위임과 시트 위임이 같은 제스처를 두 번 센다. 그러면 full 에서 ' +
      '네이티브 스크롤이어야 할 제스처까지 시트가 가로채 목록이 스크롤되지 않는다.',
  },
]
