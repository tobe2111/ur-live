/**
 * 하단 탭 이력 규칙 (2026-11-03 대표 승인 — 결재 `docs/decisions/2026-11-03-back-navigation-locked-files.md` ③).
 *
 * 🩸 라이브 실측: 탭을 7번 누르면 폰 뒤로를 7번 눌러야 앱을 나갔다 — 탭마다 이력이 한 칸씩 쌓였다.
 * 쿠팡·당근 앱 방식으로 바꾼다: **어느 탭에서든 뒤로 한 번 → 홈, 한 번 더 → 앱 밖.**
 *
 *   홈 → 다른 탭           : push (그 아래에 홈이 남는다 · `fromHome` 표시)
 *   탭 → 다른 탭(홈 제외)   : replace (표시를 그대로 넘긴다)
 *   탭 → 홈                : 아래가 홈이면 뒤로(-1, 스크롤 복원까지) · 아니면 replace
 *   같은 탭 다시 누름       : replace (이력 안 쌓임)
 *   탭이 아닌 화면(상세 등) → 탭 : push (그 화면으로 돌아올 길을 남긴다)
 */
export type TabNavAction =
  | { kind: 'back' }
  | { kind: 'push' | 'replace'; fromHome: boolean }

export interface TabNavInput {
  target: string
  /** 지금 화면의 pathname */
  cur: string
  /** 지금 화면이 탭 화면인가(홈 · 탭 경로와 같음 · 탭으로 들어온 표시) */
  curIsTab: boolean
  /** 지금 칸 아래가 홈인가(우리가 남긴 표시) */
  curFromHome: boolean
  /** 앱 안에 돌아갈 칸이 있는가 */
  canBack: boolean
}

export function decideTabNav({ target, cur, curIsTab, curFromHome, canBack }: TabNavInput): TabNavAction {
  if (!curIsTab) return { kind: 'push', fromHome: false }
  if (cur === target) return { kind: 'replace', fromHome: curFromHome }
  if (cur === '/') return { kind: 'push', fromHome: true }
  if (target === '/') return curFromHome && canBack ? { kind: 'back' } : { kind: 'replace', fromHome: false }
  return { kind: 'replace', fromHome: curFromHome }
}

/** 탭 이동으로 생긴 칸에 남기는 표시(location.state). */
export interface TabNavState { urTab: true; tabFromHome: boolean }

export function readTabState(state: unknown): { urTab: boolean; fromHome: boolean } {
  const s = (state ?? {}) as Partial<TabNavState>
  return { urTab: s.urTab === true, fromHome: s.tabFromHome === true }
}
