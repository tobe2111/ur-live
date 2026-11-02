/**
 * 🗂️ 마이의 `나 | 에이전시` 탭 — 2026-11-02 대표 확정 **안 1 + 에이전시 기본**
 *   (*"안 1로 하고 에이전시 화면을 기본으로 하자"* · 시안 `docs/design/my-agency-split-2026-11-02.md`).
 *
 * 에이전시 로그인이 있으면 마이가 손님 것(내 딜·마이 딜·설정)과 에이전시 것(맡은 매장·에이전시 할 일)을
 *   번갈아 세워 어지러웠다. 탭으로 갈라 **한 번에 한쪽만** 그린다. 열면 언제나 '에이전시' 탭이다.
 * ⚠️ 에이전시 로그인이 없으면 이 탭은 서지 않고 마이는 종전 그대로다(손님·일반 사장님 무변경).
 */
export type MyTab = 'agency' | 'me'

export const MY_TAB_DEFAULT: MyTab = 'agency'

const TABS: { key: MyTab; label: string }[] = [
  { key: 'me', label: '나' },
  { key: 'agency', label: '에이전시' },
]

export default function MyRoleTabs({ value, onChange }: { value: MyTab; onChange: (v: MyTab) => void }) {
  return (
    <div className="px-4 pb-2" data-testid="my-role-tabs">
      <div role="tablist" aria-label="마이 화면 고르기" className="flex p-1 rounded-xl bg-gray-200 dark:bg-[#1D1F29]">
        {TABS.map((tab) => {
          const on = tab.key === value
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(tab.key)}
              className={`flex-1 h-9 rounded-lg text-[15px] transition-colors ${on
                ? 'bg-white dark:bg-[#383D42] text-gray-900 dark:text-white font-bold'
                : 'text-gray-600 dark:text-gray-300 font-medium'}`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
