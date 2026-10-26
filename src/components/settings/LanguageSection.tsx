/**
 * 🏁 2026-06-12 (감사 🟢 — "언어 설정 기능은 있는데 마이 미노출"): 마이 페이지 언어 선택.
 * SellerLayout 의 changeLanguage 패턴(:209)과 동일 — i18n + html lang + i18nextLng 동기.
 * /user/profile 은 화이트/다크 토글 페이지 — dark: variant 필수.
 */
import { useTranslation } from '@/lib/i18n-lite'

/**
 * 🌐 2026-10-19 — 지구본은 이 파일 안에서 그린다(24 그리드 · 획 1.6). lucide `Globe` 하나가
 *   마이·로그아웃 마이 첫 화면에 아이콘 묶음(br 10KB)을 끌고 왔다(같은 청크의 테마 선택과 함께).
 */
function GlobeGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" /><path d="M3.6 12h16.8M12 3.6c2.3 2.4 3.4 5.2 3.4 8.4s-1.1 6-3.4 8.4c-2.3-2.4-3.4-5.2-3.4-8.4S9.7 6 12 3.6z" />
    </svg>
  )
}

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
      <div className="bg-surface rounded-2xl border border-gray-100 dark:border-[#2C2F35] p-4">
        <p className="text-[13px] font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <GlobeGlyph className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          {t('accountSettings.language', { defaultValue: '언어' })}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => change(l.code)}
              className={`py-2 rounded-xl text-[12px] font-medium border transition-colors ${
                current === l.code
                  ? 'bg-brand text-white border-brand dark:border-white'
                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-[#1D1F29] dark:text-gray-300 dark:border-[#2C2F35]'
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
