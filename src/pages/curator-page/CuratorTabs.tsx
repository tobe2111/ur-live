/**
 * 🛡️ 2026-05-25 (C 옵션): 큐레이터 페이지 탭 nav — 핀 / 정보 / (확장 가능)
 */

import { useTranslation } from 'react-i18next'

export type CuratorTab = 'pins' | 'info'

interface Props {
  tab: CuratorTab
  onChange: (tab: CuratorTab) => void
  pinCount: number
}

export default function CuratorTabs({ tab, onChange, pinCount }: Props) {
  const { t } = useTranslation()
  const tabs: Array<{ key: CuratorTab; label: string; badge?: string }> = [
    { key: 'pins', label: t('curator.tabs.pins', { defaultValue: '핀' }), badge: String(pinCount) },
    { key: 'info', label: t('curator.tabs.info', { defaultValue: '정보' }) },
  ]

  return (
    <nav className="sticky top-0 z-20 bg-white/95 dark:bg-[#020202]/95 backdrop-blur border-b border-gray-200 dark:border-[#1A1A1A]">
      <div className="max-w-3xl mx-auto flex">
        {tabs.map((tInfo) => {
          const active = tab === tInfo.key
          return (
            <button
              key={tInfo.key}
              onClick={() => onChange(tInfo.key)}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
                active ? 'text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tInfo.label}
              {tInfo.badge && <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({tInfo.badge})</span>}
              {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-pink-500" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
