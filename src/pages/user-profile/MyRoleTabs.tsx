import SegmentedTabs from '@/components/ui/segmented-tabs'

/**
 * 🗂️ 마이의 `나 | 에이전시` 탭 — 2026-11-02 대표 확정 **안 1 + 에이전시 기본**
 *   (*"안 1로 하고 에이전시 화면을 기본으로 하자"* · 시안 `docs/design/my-agency-split-2026-11-02.md`).
 *
 * 에이전시 로그인이 있으면 마이가 손님 것(내 딜·마이 딜·설정)과 에이전시 것(맡은 매장·에이전시 할 일)을
 *   번갈아 세워 어지러웠다. 탭으로 갈라 **한 번에 한쪽만** 그린다. 열면 언제나 '에이전시' 탭이다.
 * ⚠️ 에이전시 로그인이 없으면 이 탭은 서지 않고 마이는 종전 그대로다(손님·일반 사장님 무변경).
 * 🧭 모양은 공용 `SegmentedTabs`(선택 = 브랜드 블루 하나 · 줄바꿈 금지) — 손으로 그리지 않는다.
 */
export type MyTab = 'agency' | 'me'

export const MY_TAB_DEFAULT: MyTab = 'agency'

const ITEMS: { id: MyTab; label: string }[] = [
  { id: 'me', label: '나' },
  { id: 'agency', label: '에이전시' },
]

export default function MyRoleTabs({ value, onChange }: { value: MyTab; onChange: (v: MyTab) => void }) {
  return (
    <div className="px-4 pb-2" data-testid="my-role-tabs">
      <SegmentedTabs items={ITEMS} value={value} onChange={onChange} ariaLabel="마이 화면 고르기" className="dark:bg-surface dark:border-rule" />
    </div>
  )
}
