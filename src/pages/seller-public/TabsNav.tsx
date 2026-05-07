/**
 * 🛡️ 2026-05-07: TD-018 분할 — sticky tab navigation.
 */
import type { Tab } from './types'
import type { ThemeTokens } from './theme'

interface Props {
  tabs: { key: Tab; label: string }[]
  current: Tab
  onChange: (t: Tab) => void
  isDark: boolean
  T: ThemeTokens
}

export default function TabsNav({ tabs, current, onChange, isDark, T }: Props) {
  return (
    <div
      className="sticky top-0 z-20"
      style={isDark
        ? { background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(84,84,88,0.34)' }
        : { background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}
    >
      <div className="flex">
        {tabs.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex-1 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
              current === item.key ? `border-pink-500 ${T.text}` : `border-transparent ${T.textMuted}`
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
