/**
 * 🛡️ 2026-06-22 (대표 신고 — 모바일 하단 네비 사라짐, 영구 방어):
 *   모바일 키보드 열림 판정 *순수함수* + 불변식. main.tsx 의 visualViewport 핸들러가 이걸 사용.
 *
 * 사건 배경: 기존엔 `vv.height < innerHeight - 100` (뷰포트 100px 축소)만으로 body.keyboard-open
 *   을 켰음 → 주소창 토글/줌/데스크톱 창 변화에도 오작동 + 키보드 닫힘 이벤트 누락 시 stuck.
 *   index.css `body.keyboard-open .hide-on-keyboard { display:none }` 가 BottomNav 를 숨겨
 *   "하단 네비 영구 실종". 페이지 레이아웃이 아니라 전역 키보드 감지 버그라 페이지마다 고쳐도 안 잡힘.
 *
 * 🔒 불변식 (keyboard-viewport.test.ts 가 CI 에서 강제):
 *   "실제 편집요소(input/textarea/contenteditable)가 포커스되지 않았으면 keyboard-open 은 절대 true 가 아니다."
 *   → 입력 중이 아닐 땐 BottomNav 가 절대 숨겨지지 않음. 이 한 줄이 사건의 재발을 구조적으로 막는다.
 */

/** 키보드가 가리는 최소 높이(px). 주소창 토글(≈50-100px)·미세 줌과 구분. */
export const KEYBOARD_MIN_DELTA_PX = 120

/**
 * 모바일 소프트키보드가 열렸는지 판정.
 * @param vvHeight        visualViewport.height (키보드가 차지하면 줄어듦)
 * @param innerHeight     window.innerHeight (레이아웃 뷰포트 — 키보드 영향 없음)
 * @param editableFocused 실제 편집요소가 포커스됐는지 (진짜 신호)
 * @param minDelta        키보드로 간주할 최소 축소 px
 */
export function isKeyboardOpen(
  vvHeight: number,
  innerHeight: number,
  editableFocused: boolean,
  minDelta: number = KEYBOARD_MIN_DELTA_PX,
): boolean {
  // 🔒 편집요소 포커스가 없으면 무조건 false — 어떤 뷰포트 축소에도 네비를 숨기지 않는다.
  if (!editableFocused) return false
  return vvHeight < innerHeight - minDelta
}

/** activeElement 가 텍스트 입력 가능한 요소인지. */
export function isEditableElementFocused(doc: Document = document): boolean {
  const el = doc.activeElement as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}
