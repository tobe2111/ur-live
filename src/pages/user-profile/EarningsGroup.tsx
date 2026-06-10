/**
 * 🧭 2026-06-10 (UI 100점 패스 — 마이 최하점 원인): 수익·추천 카드 3연속 도배 → 접이식 그룹.
 *
 * 마이 첫 화면은 자산(딜 잔액·이용 내역) 중심이어야 하는데 프로모션성 카드가 점유하던 것을
 * 1탭 뒤로. 카드 컴포넌트/데이터 로직은 자식 그대로 — 표시 위계만 변경. 펼침 상태는 기억.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

const LS_KEY = 'ur_my_earnings_open_v1'

export default function EarningsGroup({ children }: { children: ReactNode }) {
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
          <span className="text-lg" aria-hidden="true">💰</span>
          <span className="text-left">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white">
              {t('my.earningsGroupTitle', { defaultValue: '내 수익·추천' })}
            </span>
            <span className="block text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
              {t('my.earningsGroupSub', { defaultValue: '추천 적립 · 링크샵 수익 · 친구 초대' })}
            </span>
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}
