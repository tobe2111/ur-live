/**
 * 🛡️ 2026-05-02: 화면 테마 선택 (시스템 / 라이트 / 다크) — 공용 섹션.
 *
 * 적용 범위: 화이트 테마 페이지 (쇼핑 / 결제 / 상세 / 주문내역 / 위시리스트 등).
 * 다크 테마 (홈 / 라이브 / 마이페이지) 와 셀러·어드민 라이트 테마는 페이지 단에서
 * 명시 색상이 강제되어 토글 영향 없음 — 의도된 동작.
 *
 * 사용처:
 *   - /account/settings (계정 설정)
 *   - /user/profile (마이페이지) — 사용자가 자주 접근하는 곳에 노출
 *
 * 🛡️ 2026-05-03: applied 테마 표시 추가 — 토글이 실제 작동하는지 사용자가 확인할 수 있게.
 * 시스템 모드 일 때 OS 가 어느 테마를 따르고 있는지 명시.
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
              defaultValue: applied === 'dark' ? '현재 OS: 다크' : '현재 OS: 라이트',
              theme: applied === 'dark' ? t('theme.dark', { defaultValue: '다크' }) : t('theme.light', { defaultValue: '라이트' }),
            })}
          </p>
        )}
      </div>
    </div>
  )
}
