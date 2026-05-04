/**
 * 🛡️ 2026-05-02: 화면 테마 선택 (시스템 / 라이트 / 다크) — 공용 섹션.
 *
 * 🛡️ 2026-05-04: 정책 변경 — 대시보드 (셀러/어드민/에이전시) 만 강제 라이트,
 *   나머지 모든 페이지 토글 영향 받음. 이 컴포넌트도 라이트/다크 양쪽 호환.
 *
 * 사용처:
 *   - /account/settings (계정 설정)
 *   - /user/profile (마이페이지) — 사용자가 자주 접근하는 곳
 */
import { Monitor, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme, type ThemeMode } from '@/shared/stores/useTheme'

export default function ThemeToggleSection() {
  const { t } = useTranslation()
  const mode = useTheme(s => s.mode)
  const applied = useTheme(s => s.applied)
  const setMode = useTheme(s => s.setMode)

  const options: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: 'system', label: t('theme.system', { defaultValue: '시스템' }), icon: <Monitor className="w-3.5 h-3.5" aria-hidden="true" /> },
    { key: 'light', label: t('theme.light', { defaultValue: '라이트' }), icon: <Sun className="w-3.5 h-3.5" aria-hidden="true" /> },
    { key: 'dark', label: t('theme.dark', { defaultValue: '다크' }), icon: <Moon className="w-3.5 h-3.5" aria-hidden="true" /> },
  ]

  return (
    <div className="px-4 pt-5">
      <p className="text-[12px] font-bold text-gray-900 dark:text-white mb-2">{t('theme.title', { defaultValue: '화면 테마' })}</p>
      <div className="rounded-2xl bg-gray-100 dark:bg-white/[0.04] p-3">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('theme.title', { defaultValue: '화면 테마 선택' })}>
          {options.map(o => {
            const active = mode === o.key
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(o.key)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-pink-500/15 dark:bg-pink-500/20 border border-pink-500/40 text-pink-600 dark:text-pink-300'
                    : 'bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-gray-700 dark:text-white/65 hover:bg-gray-50 dark:hover:bg-white/[0.08]'
                }`}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10.5px] text-gray-500 dark:text-white/45 mt-2.5 px-1 leading-relaxed">
          {t('theme.description', { defaultValue: '시스템 / 라이트 / 다크 중 선택. 시스템 모드는 OS 다크 설정을 따라갑니다.' })}
        </p>
        {mode === 'system' && (
          <p className="text-[10px] text-gray-400 dark:text-white/35 mt-1.5 px-1">
            {t('theme.currentlyFollowing', {
              theme: applied === 'dark' ? t('theme.dark', { defaultValue: '다크' }) : t('theme.light', { defaultValue: '라이트' }),
              defaultValue: applied === 'dark' ? '현재 OS: 다크' : '현재 OS: 라이트',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
