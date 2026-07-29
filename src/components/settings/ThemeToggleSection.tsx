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

interface Props {
  /** 'dark' — 강제 다크 스타일 (UserProfilePage 등 항상 어두운 배경에서 사용) */
  variant?: 'dark'
  className?: string
}

export default function ThemeToggleSection({ variant, className }: Props) {
  const { t } = useTranslation()
  const mode = useTheme(s => s.mode)
  const applied = useTheme(s => s.applied)
  const setMode = useTheme(s => s.setMode)
  const isDark = variant === 'dark'

  const options: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: 'system', label: t('theme.system', { defaultValue: '시스템' }), icon: <Monitor className="w-3.5 h-3.5" aria-hidden="true" /> },
    { key: 'light', label: t('theme.light', { defaultValue: '라이트' }), icon: <Sun className="w-3.5 h-3.5" aria-hidden="true" /> },
    { key: 'dark', label: t('theme.dark', { defaultValue: '다크' }), icon: <Moon className="w-3.5 h-3.5" aria-hidden="true" /> },
  ]

  return (
    <div className={className ?? 'px-4 pt-5'}>
      <p className={`text-[12px] font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
        {t('theme.title', { defaultValue: '화면 테마' })}
      </p>
      <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.06]' : 'bg-gray-100 dark:bg-white/[0.04]'}`}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('theme.title', { defaultValue: '화면 테마 선택' })}>
          {options.map(o => {
            const active = mode === o.key
            const baseActive = 'bg-pink-500/20 border border-pink-500/40 text-pink-400'
            const baseInactive = isDark
              ? 'bg-white/[0.06] border border-white/[0.08] text-white/65 hover:bg-white/[0.10]'
              : 'bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-gray-700 dark:text-white/65 hover:bg-gray-50 dark:hover:bg-white/[0.08]'
            const activeClass = isDark ? baseActive : `bg-pink-500/15 dark:bg-pink-500/20 border border-pink-500/40 text-pink-600 dark:text-pink-300`
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(o.key)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-colors ${active ? activeClass : baseInactive}`}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            )
          })}
        </div>
        <p className={`text-[10.5px] mt-2.5 px-1 leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-500 dark:text-white/45'}`}>
          {t('theme.description', { defaultValue: '시스템 / 라이트 / 다크 중 선택. 시스템 모드는 OS 다크 설정을 따라갑니다.' })}
        </p>
        {mode === 'system' && (
          <p className={`text-[10px] mt-1.5 px-1 ${isDark ? 'text-white/30' : 'text-gray-400 dark:text-white/35'}`}>
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
