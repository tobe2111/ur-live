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
import { ROW_GEOM_CLS, ROW_LABEL_CLS } from '@/pages/user-profile/list-grammar'
import { SettingsIcon } from '@/components/icons/urdeal-icons'

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
    /**
     * 🔵 2026-09-30 — **회색 상자와 12px 라벨을 걷었다**(안 C 목록 문법).
     *   설정 구역이 펼쳐지면서(대표 *"왜 굳이 열고 닫게 해두는거지"*) 이 블록이 바로 위
     *   `내가 산 것` 목록과 다른 문법으로 그려지는 게 드러났다 — 흰/회색 판 + 12px 라벨 + 13px 행.
     *   라벨은 다른 줄과 **같은 치수·같은 글자**로(`list-grammar`), 컨트롤은 그 아래 제자리에.
     * 🗑️ 설명 문장(*"시스템 / 라이트 / 다크 중 선택 …"*)도 뺐다 — 버튼 셋이 이미 그 말을 한다.
     *   `현재 OS: …` 는 남긴다(시스템 모드에서만 알 수 있는 값이라 버튼이 대신 말해 주지 못한다).
     */
    <div className={className ?? 'ur-content-medium lg:px-4'}>
      <div className={ROW_GEOM_CLS}>
        <span className={`shrink-0 ${isDark ? 'text-white/55' : 'text-gray-500 dark:text-gray-400'}`}>
          {/* 🎨 뜻 아이콘은 유어딜 세트에서 온다(CLAUDE.md 아이콘 규칙). lucide `Monitor` 는
              아래 '시스템' 알약 **안**에서만 쓴다 — 그건 세 선택지를 구별하는 조작 표시다. */}
          <SettingsIcon className="w-[18px] h-[18px]" aria-hidden="true" />
        </span>
        <span className={isDark ? `${ROW_LABEL_CLS} !text-white` : ROW_LABEL_CLS}>
          {t('theme.title', { defaultValue: '화면 테마' })}
        </span>
      </div>
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('theme.title', { defaultValue: '화면 테마 선택' })}>
          {options.map(o => {
            const active = mode === o.key
            const baseInactive = isDark
              ? 'bg-white/[0.06] border border-white/[0.08] text-white/65 hover:bg-white/[0.10]'
              : 'bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-gray-700 dark:text-white/65 hover:bg-gray-50 dark:hover:bg-white/[0.08]'
            const activeClass = isDark
              ? 'bg-brand/20 border border-brand/40 text-brand-text'
              : 'bg-brand/15 border border-brand/40 text-brand-text'
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(o.key)}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold transition-colors ${active ? activeClass : baseInactive}`}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            )
          })}
        </div>
        {mode === 'system' && (
          <p className={`text-[12px] mt-2 ${isDark ? 'text-white/30' : 'text-gray-400 dark:text-white/35'}`}>
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
