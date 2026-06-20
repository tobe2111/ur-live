/**
 * 🧹 2026-06-19 (대표 신고 — 마이 페이지 너무 번잡): 흩어진 설정 블록(알림/테마/언어/앱정보)을
 *   하나의 접이식 '설정' 그룹으로 합침. EarningsGroup 과 동일 패턴 — 자식 컴포넌트/데이터 로직 불변,
 *   표시 위계만 1탭 뒤로(기본 접힘). 설정은 자주 안 쓰므로 자산/이용내역이 먼저 보이도록.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Settings } from 'lucide-react'

const LS_KEY = 'ur_my_settings_open_v1'

export default function SettingsGroup({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
  })
  const toggle = () => {
    setOpen((v) => {
      try { localStorage.setItem(LS_KEY, v ? '0' : '1') } catch { /* quota */ }
      return !v
    })
  }
  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 bg-gray-100 dark:bg-white/[0.04] active:scale-[0.99] transition-transform"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Settings className="w-[18px] h-[18px] text-gray-500 dark:text-white/55" aria-hidden="true" />
          <span className="text-left">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white">
              {t('my.settingsGroupTitle', { defaultValue: '설정' })}
            </span>
            <span className="block text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
              {t('my.settingsGroupSub', { defaultValue: '알림 · 화면 테마 · 언어 · 앱 정보' })}
            </span>
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}
