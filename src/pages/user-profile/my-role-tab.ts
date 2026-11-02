/**
 * 🗂️ 마이 `나 | 에이전시` 탭의 값 — 2026-11-02 대표 확정 *"안 1로 하고 에이전시 화면을 기본으로 하자"*.
 * ⚠️ 탭 부품(`MyRoleTabs` — 공용 `SegmentedTabs` 를 쓴다)과 **따로 둔다**: 마이가 이 값만 가져오고 부품은
 *   lazy 로 받아야, 에이전시가 아닌 손님 첫 화면에 그 묶음이 안 실린다(`check-surface-budgets` dash:my 가
 *   +50KB 로 잡았다 — 허용 1.5).
 */
export type MyTab = 'agency' | 'me'

export const MY_TAB_DEFAULT: MyTab = 'agency'
