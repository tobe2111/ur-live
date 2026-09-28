/**
 * 🔙 **시트 하나당 히스토리 칸 하나가 아니라, 열려 있는 동안 칸 하나** (2026-09-28)
 *
 * ## 무엇이 깨졌나 — 도구를 고르면 **전체 도구로 튕겨 돌아왔다**
 * `Sheet` 는 열릴 때 `pushState` 로 한 칸 쌓고(안드로이드 뒤로가기 = 닫기), X·배경·Escape 로
 * 닫힐 때 그 칸을 `history.back()` 으로 도로 뺀다. 한 시트만 보면 완벽한 규약이다.
 *
 * 그런데 마이는 시트를 **갈아 끼운다**: 전체 도구(A)에서 도구를 고르면 같은 렌더에서
 * A 가 내려가고 도구 시트(B)가 올라온다. React 는 **정리 → 설치** 순서로 돈다 ⇒
 *
 * ```
 * A 정리: history.back()  (브라우저가 비동기로 처리)
 * B 설치: pushState
 * …잠시 뒤 popstate 도착 → B 가 "뒤로가기다" 로 읽고 스스로 닫는다 → 전체 도구로 복귀
 * ```
 *
 * 즉 **A 가 빼려던 칸을 B 가 뒤집어썼다.** 사람 눈에는 "눌렀는데 아무 일도 안 일어난다" 로 보이고
 * (도구가 한 프레임 떴다 사라진다) 에러는 한 줄도 안 난다.
 * 2026-09-28 실측: `전체 도구 → 셀러 등급` 이 정확히 그랬다. `history.back()` 을 임시로 빼자
 * 같은 빌드에서 셀러 등급 화면이 시트 안에 그대로 떴다 — 그게 이 모듈의 증거다.
 *
 * ## 규약 — 칸은 **시트가 아니라 "시트가 열려 있음" 에 붙는다**
 * · 아무것도 없다가 처음 열릴 때만 한 칸 쌓는다(0 → 1)
 * · 갈아 끼우기(1 → 0 → 1)에서는 **아무것도 안 한다** — 쌓지도, 빼지도 않는다
 * · 마지막 하나가 닫힐 때만 칸을 뺀다(1 → 0)
 * · 뒤로가기로 닫힌 경우엔 칸이 이미 소비됐으므로 빼지 않는다
 *
 * 🔑 **정리 시점엔 "닫기" 인지 "갈아 끼우기" 인지 알 수 없다** — 새 시트의 설치가 아직 안 돌았다.
 *   그래서 판정을 **한 틱 미룬다**(`queueMicrotask`). 그 틱이 올 때쯤 B 의 설치가 끝나 있고,
 *   그때도 열린 시트가 0 이면 그제서야 진짜 닫힘이다.
 *
 * ⚠️ 이 모듈은 **상태만** 다룬다 — `pushState`/`back()` 은 호출부(`Sheet.tsx`)가 한다.
 *   그래야 jsdom 의 불안정한 히스토리 구현에 기대지 않고 규약 자체를 시험할 수 있다.
 */

export type SheetHistoryState = {
  /** 지금 열려 있는 시트 수 */
  open: number
  /** 우리가 쌓아 둔 칸이 아직 히스토리에 있는가 */
  pushed: boolean
}

export const initialSheetHistory = (): SheetHistoryState => ({ open: 0, pushed: false })

/** 시트가 열렸다. `push` 가 true 면 호출부가 `pushState` 한다. */
export function openSheet(s: SheetHistoryState): { next: SheetHistoryState; push: boolean } {
  const push = !s.pushed
  return { next: { open: s.open + 1, pushed: true }, push }
}

/**
 * 시트가 닫혔다(언마운트). `schedule` 이 true 면 호출부가 **한 틱 뒤** `settleClose` 를 부른다.
 * @param poppedByUser 뒤로가기로 닫힌 경우 — 칸은 이미 소비됐다
 */
export function closeSheet(s: SheetHistoryState, poppedByUser: boolean): { next: SheetHistoryState; schedule: boolean } {
  const open = Math.max(0, s.open - 1)
  if (poppedByUser) return { next: { open, pushed: false }, schedule: false }
  return { next: { open, pushed: s.pushed }, schedule: open === 0 && s.pushed }
}

/** 한 틱 뒤 판정. `back` 이 true 면 호출부가 `history.back()` 한다. */
export function settleClose(s: SheetHistoryState): { next: SheetHistoryState; back: boolean } {
  // 그 사이 새 시트가 올라왔다 = 갈아 끼우기였다. 칸은 그대로 둔다.
  if (s.open > 0 || !s.pushed) return { next: s, back: false }
  return { next: { open: 0, pushed: false }, back: true }
}

/** 브라우저 뒤로가기가 왔다 — 우리 칸이 소비됐다. */
export function browserPopped(s: SheetHistoryState): SheetHistoryState {
  return { ...s, pushed: false }
}
