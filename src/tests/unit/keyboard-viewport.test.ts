import { describe, it, expect } from 'vitest'
import { isKeyboardOpen, KEYBOARD_MIN_DELTA_PX } from '@/lib/keyboard-viewport'

/**
 * 🛡️ 2026-06-22 사건 회귀 방지: 모바일 하단 네비(BottomNav) 가 `body.keyboard-open`+
 *   `.hide-on-keyboard{display:none}` 로 사라졌던 버그.
 *
 * 🔒 핵심 불변식: "편집요소 포커스가 없으면 keyboard-open 은 절대 true 가 아니다."
 *    이게 깨지면 = 입력 중이 아닌데 네비가 숨겨질 수 있음 = 사건 재발. CI 가 여기서 차단.
 */
describe('keyboard-viewport · isKeyboardOpen', () => {
  describe('🔒 불변식: 편집요소 미포커스 → 절대 열림 아님 (어떤 뷰포트 축소에도)', () => {
    it.each([
      [400, 800], // 50% 축소(키보드만큼 크게 줄어도)
      [600, 800], // 주소창/UI
      [799, 800], // 거의 동일
      [0, 800],   // 극단
      [800, 800], // 변화 없음
    ])('editableFocused=false, vv=%i, inner=%i → false', (vv, inner) => {
      expect(isKeyboardOpen(vv, inner, false)).toBe(false)
    })
  })

  describe('편집요소 포커스 O', () => {
    it('충분히(>=120px) 줄면 열림', () => {
      expect(isKeyboardOpen(800 - 121, 800, true)).toBe(true)
      expect(isKeyboardOpen(400, 800, true)).toBe(true)
    })
    it('미세 축소(주소창 토글 ~50px)는 열림 아님 — 오작동 방지', () => {
      expect(isKeyboardOpen(800 - 50, 800, true)).toBe(false)
      expect(isKeyboardOpen(800 - KEYBOARD_MIN_DELTA_PX, 800, true)).toBe(false) // 정확히 임계 = 미만 아님
    })
    it('변화 없음 → 열림 아님', () => {
      expect(isKeyboardOpen(800, 800, true)).toBe(false)
    })
  })

  it('임계 px 커스텀 적용', () => {
    expect(isKeyboardOpen(700, 800, true, 50)).toBe(true)   // 100px 축소, 임계 50
    expect(isKeyboardOpen(770, 800, true, 50)).toBe(false)  // 30px 축소, 임계 50
  })
})
