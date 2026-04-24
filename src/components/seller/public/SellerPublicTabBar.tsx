import { Tab, ThemeClasses } from '@/components/seller/public/seller-public-types'

interface TabItem {
  key: Tab
  label: string
}

interface SellerPublicTabBarProps {
  tabs: TabItem[]
  tab: Tab
  setTab: (t: Tab) => void
  T: ThemeClasses
}

export default function SellerPublicTabBar({ tabs, tab, setTab, T }: SellerPublicTabBarProps) {
  return (
    <div className={`sticky top-0 z-20 ${T.bg} border-b ${T.border}`}>
      <div className="flex">
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === item.key ? `border-current ${T.text}` : `border-transparent ${T.textMuted}`
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
