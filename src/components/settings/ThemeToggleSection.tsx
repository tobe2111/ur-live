/**
 * 🛡️ 2026-05-02: 화면 테마 선택 (시스템 / 라이트 / 다크) — 공용 섹션.
 *
 * 🛡️ 2026-05-03 (re-enable): 사용자 신고 "테마 변경하는게 없어" 후 토글 UI 복원.
 *   useTheme.applyToDocument 도 함께 복원되어 <html> 에 .dark class 정상 추가/제거.
 *
 * 적용 범위:
 *   - 화이트 테마 페이지 (쇼핑/결제/상세) → 토글 변경 시 dark: variants 활성/비활성
 *   - 다크 테마 페이지 (홈/마이/라이브) → 토글 무영향 (bg-[#020202] 강제)
 *   - 셀러/어드민/에이전시 → 토글 무영향 (#F4F5F7 강제 + dark: 금지 hook)
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
      <p className="text-[12px] font-bold text-white mb-2">{t('theme.title', { defaultValue: '화면 테마' })}</p>
      <div className="rounded-2xl bg-white/[0.04] p-3">
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
                    ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300'
                    : 'bg-white/[0.04] border border-white/[0.06] text-white/65 hover:bg-white/[0.08]'
                }`}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10.5px] text-white/45 mt-2.5 px-1 leading-relaxed">
          {t('theme.description', { defaultValue: '쇼핑·결제·주문 등 화이트 테마 페이지에 적용됩니다. 마이페이지/홈/라이브는 항상 다크 테마.' })}
        </p>
        {mode === 'system' && (
          <p className="text-[10px] text-white/35 mt-1.5 px-1">
            {t('theme.currentlyFollowing', {
              theme: applied === 'dark' ? t('theme.dark', { defaultValue: '다크' }) : t('theme.light', { defaultValue: '라이트' }),
              defaultValue: applied === 'dark' ? '현재 OS: 다크' : '현재 OS: 라이트',
            })}
          </p>
        )}
        {/* 🛡️ 2026-05-04: 마이페이지 강제 다크라 토글 효과 안 보여 사용자 신고. 미리보기 카드로 즉각 시각 피드백. */}
        <div
          className={`mt-3 rounded-xl p-3 border transition-colors ${
            applied === 'dark'
              ? 'bg-[#0A0A0A] border-[#2A2A2A]'
              : 'bg-white border-gray-200'
          }`}
          aria-live="polite"
        >
          <p className={`text-[11px] font-bold mb-0.5 ${applied === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t('theme.previewTitle', { defaultValue: '미리보기' })}
          </p>
          <p className={`text-[10px] ${applied === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {applied === 'dark'
              ? t('theme.previewDark', { defaultValue: '다크 모드 — 쇼핑/결제 페이지가 어두운 테마로 표시됩니다.' })
              : t('theme.previewLight', { defaultValue: '라이트 모드 — 쇼핑/결제 페이지가 밝은 테마로 표시됩니다.' })}
          </p>
        </div>
      </div>
    </div>
  )
}
