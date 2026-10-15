/**
 * 👆 앱이 붙기 전에 누른 것을 기억했다가 붙은 뒤 실행한다 (2026-10-15 상세 서버 렌더 3단계).
 *
 * 서버가 상세를 다 그려 보내면 버튼이 **앱이 붙기 전에** 화면에 있다(느린 폰에서 1~2초). 그동안 누르면
 * 아무 일도 안 일어나는 게 서버 렌더의 대가다. 워커가 첫 화면 바로 뒤에 붙이는 작은 스크립트
 * (`worker/utils/pass-ssr.ts` 의 `earlyTapScript`)가 `data-early-tap="이름"` 버튼의 누름을 `window.__urEarlyTap` 에
 * 적어 두고, 그 버튼의 컴포넌트가 마운트하면서 `consumeEarlyTap(이름)` 으로 한 번 꺼내 실행한다.
 *
 * 꺼내면 지운다 — 두 번 실행되지 않는다. 다른 이름이면 건드리지 않는다.
 */
export const EARLY_TAP_ATTR = 'data-early-tap'

type W = { __urEarlyTap?: string | null }

export function consumeEarlyTap(name: string): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as W
  if (w.__urEarlyTap !== name) return false
  w.__urEarlyTap = null
  return true
}
