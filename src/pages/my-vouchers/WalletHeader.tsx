// 🎨 2026-07-20 (대표 "내 지갑 타이틀 + 이용권/교환권 탭 나뉜 게 투박해 — 더 이상적으로"):
//   기존 [32px 큰 타이틀 + 회색 트랙 세그먼트(이모지+회색 카운트칩)] → 모던 지갑 헤더.
//   - 타이틀 26px + 총 보유 장수 칩(우측) — 지갑=자산 느낌, 여백 절제.
//   - 탭: 회색 세그먼트 → **언더라인 탭**(토스/모던 뱅킹). 활성=잉크 볼드 + 브랜드 로즈 밑줄,
//     카운트는 로즈 텍스트. 이모지 제거(성인 톤). 교환권 보유 시에만 탭 노출(단일이면 타이틀만).
export interface WalletTab { key: 'gb' | 'gift'; label: string; count: number }

export default function WalletHeader({ title, totalLabel, tabs, activeTab, onTab }: {
  title: string
  /** 우측 총 보유 칩 문구(예 "총 3장"). 없으면 미표시. */
  totalLabel?: string | null
  /** 2개 이상일 때만 탭 렌더(교환권 보유 시). */
  tabs?: WalletTab[]
  activeTab: 'gb' | 'gift'
  onTab: (k: 'gb' | 'gift') => void
}) {
  const showTabs = !!tabs && tabs.length > 1
  return (
    <div className="ur-content-narrow px-4 lg:px-8 pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white leading-none">{title}</h1>
        {totalLabel && (
          <span className="shrink-0 rounded-full bg-brand-tint text-brand-text text-[12px] font-bold px-3 py-1">{totalLabel}</span>
        )}
      </div>

      {showTabs ? (
        <div className="mt-4 flex gap-6 border-b border-gray-200 dark:border-[#2A3446]">
          {tabs!.map((tab) => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTab(tab.key)}
                aria-current={active ? 'true' : undefined}
                className="relative flex items-center gap-1.5 pb-2.5 -mb-px focus:outline-none"
              >
                <span className={`text-[15px] transition-colors ${active ? 'font-extrabold text-gray-900 dark:text-white' : 'font-semibold text-gray-400 dark:text-gray-500'}`}>{tab.label}</span>
                <span className={`text-[13px] font-bold tabular-nums transition-colors ${active ? 'text-brand-text' : 'text-gray-300 dark:text-gray-600'}`}>{tab.count}</span>
                {active && <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-brand" />}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-3" />
      )}
    </div>
  )
}
