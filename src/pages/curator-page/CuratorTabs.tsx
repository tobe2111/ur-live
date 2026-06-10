/**
 * 🛡️ 2026-05-25 (C 옵션): 큐레이터 페이지 탭 nav.
 * 🛡️ 2026-05-27 (사용자 결정): 셀러 페이지 탭과 통일 — 홈/상품/식사권/정보.
 *   라이브/영상은 제외 (큐레이터는 본인 콘텐츠 X, 핀만).
 */

import { useTranslation } from 'react-i18next'

export type CuratorTab = 'home' | 'shop' | 'vouchers' | 'info'

interface Props {
  tab: CuratorTab
  onChange: (tab: CuratorTab) => void
  pinCount: number
  shopCount?: number
  voucherCount?: number
}

export default function CuratorTabs({ tab, onChange, pinCount, shopCount = 0, voucherCount = 0 }: Props) {
  const { t } = useTranslation()
  // 🧭 2026-06-10 (동네딜 집중 재정향): 식사권(교환권) 탭을 상품 앞으로 — 링크샵 = 동네딜/교환권 유통 채널.
  const tabs: Array<{ key: CuratorTab; label: string; badge?: string }> = [
    { key: 'home', label: t('curator.tabs.home', { defaultValue: '홈' }), badge: pinCount > 0 ? String(pinCount) : undefined },
    { key: 'vouchers', label: t('curator.tabs.vouchers', { defaultValue: '식사권' }), badge: voucherCount > 0 ? String(voucherCount) : undefined },
    { key: 'shop', label: t('curator.tabs.shop', { defaultValue: '상품' }), badge: shopCount > 0 ? String(shopCount) : undefined },
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
