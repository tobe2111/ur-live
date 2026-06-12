/**
 * 🏁 2026-06-12 (감사 🟢 — "언어 설정 기능은 있는데 마이 미노출"): 마이 페이지 언어 선택.
 * SellerLayout 의 changeLanguage 패턴(:209)과 동일 — i18n + html lang + i18nextLng 동기.
 * /user/profile 은 화이트/다크 토글 페이지 — dark: variant 필수.
 */
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

const LANGS: Array<{ code: string; label: string }> = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

export default function LanguageSection({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const current = (i18n.language || 'ko').slice(0, 2)

  function change(code: string) {
    i18n.changeLanguage(code)
    if (typeof document !== 'undefined') document.documentElement.lang = code
    try { localStorage.setItem('i18nextLng', code) } catch { /* */ }
  }

  return (
    <div className={className}>
      <div className="bg-white dark:bg-[#121212] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-3">
          <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          {t('accountSettings.language', { defaultValue: '언어' })}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => change(l.code)}
              className={`py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                current === l.code
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-[#1A1A1A] dark:text-gray-300 dark:border-[#2A2A2A]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
