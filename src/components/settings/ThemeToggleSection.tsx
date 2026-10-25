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
import { useTranslation } from '@/lib/i18n-lite'
import { useTheme, type ThemeMode } from '@/shared/stores/useTheme'
import { ROW_GEOM_CLS, ROW_LABEL_CLS } from '@/pages/user-profile/list-grammar'
import { SettingsIcon } from '@/components/icons/urdeal-icons'

/**
 * 🌗 2026-10-19 — 세 선택지 표시(화면 · 해 · 달)는 이 파일 안에서 그린다(24 그리드 · 획 1.6 · 둥근 끝).
 *   lucide `Monitor`·`Sun`·`Moon` 이 마이·로그아웃 마이 첫 화면에 아이콘 묶음(br 10KB)을 끌고 왔다.
 */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
      {children}
    </svg>
  )
}
const MonitorGlyph = () => <Glyph><rect x="3.4" y="4.4" width="17.2" height="11.6" rx="2" /><path d="M8.6 20h6.8M12 16v4" /></Glyph>
const SunGlyph = () => <Glyph><circle cx="12" cy="12" r="3.8" /><path d="M12 3.2v1.8M12 19v1.8M3.2 12H5M19 12h1.8M5.8 5.8l1.3 1.3M16.9 16.9l1.3 1.3M5.8 18.2l1.3-1.3M16.9 7.1l1.3-1.3" /></Glyph>
const MoonGlyph = () => <Glyph><path d="M19.6 14.4A8 8 0 0 1 9.6 4.4a8 8 0 1 0 10 10z" /></Glyph>

interface Props {
  /** 'dark' — 강제 다크 스타일 (UserProfilePage 등 항상 어두운 배경에서 사용) */
  variant?: 'dark'
  className?: string
}

export default function ThemeToggleSection({ variant, className }: Props) {
  const { t } = useTranslation()
  const mode = useTheme(s => s.mode)
  const setMode = useTheme(s => s.setMode)
  const isDark = variant === 'dark'

  const options: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: 'system', label: t('theme.system', { defaultValue: '시스템' }), icon: <MonitorGlyph /> },
    { key: 'light', label: t('theme.light', { defaultValue: '라이트' }), icon: <SunGlyph /> },
    { key: 'dark', label: t('theme.dark', { defaultValue: '다크' }), icon: <MoonGlyph /> },
  ]

  return (
    /**
     * 🔵 2026-09-30 — **회색 상자와 12px 라벨을 걷었다**(안 C 목록 문법).
     *   설정 구역이 펼쳐지면서(대표 *"왜 굳이 열고 닫게 해두는거지"*) 이 블록이 바로 위
     *   `내가 산 것` 목록과 다른 문법으로 그려지는 게 드러났다 — 흰/회색 판 + 12px 라벨 + 13px 행.
     *   라벨은 다른 줄과 **같은 치수·같은 글자**로(`list-grammar`), 컨트롤은 그 아래 제자리에.
     * 🗑️ 설명 문장(*"시스템 / 라이트 / 다크 중 선택 …"*)도 뺐다 — 버튼 셋이 이미 그 말을 한다.
     * 🗑️ 2026-10-18 — `현재 OS: 라이트` 줄도 뺐다(대표 *"나머지 다 가장 이상적으로"* — 개발자용 표시).
     *   그 값은 **지금 보고 있는 화면 자체**가 말한다(시스템을 고른 사람은 화면 색으로 이미 안다).
     *   'OS' 라는 낱말은 이 서비스의 어느 화면에도 없는 개발자 말이었다.
     */
    /* ➖ 2026-10-19 — 위·아래 hairline. 바로 위 알림 줄은 자기 묶음의 마지막이라(`last:border-b-0`)
       선을 지워서, 이메일 알림과 화면 테마 사이에만 구분선이 없었다. */
    <div className={`${className ?? 'ur-content-medium lg:px-4'} border-y border-rule`}>
      <div className={ROW_GEOM_CLS}>
        <span className={`shrink-0 ${isDark ? 'text-white/55' : 'text-gray-500 dark:text-gray-400'}`}>
          {/* 🎨 뜻 아이콘은 유어딜 세트에서 온다(CLAUDE.md 아이콘 규칙). 아래 세 알약의 화면·해·달은
              선택지를 구별하는 조작 표시라 이 파일이 그린다(2026-10-19 — lucide 묶음 제거). */}
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
            /* 🔵 2026-10-19 (대표 *"다 이상적으로 진행해줘 모두"*): 고른 것 = 브랜드 블루 **면**.
               종전 옅은 블루 테두리는 이 화면에만 있던 선택 모양이었다 — 다른 선택 칩은 전부 면이다
               (UI① 2026-09-29 "선택 칩 6가지 → 브랜드 면 하나"). 고르지 않은 것은 테두리 없는 옅은 면. */
            const baseInactive = isDark
              ? 'bg-white/[0.06] text-white/65 hover:bg-white/[0.10]'
              : 'bg-wash text-gray-700 dark:text-gray-300'
            const activeClass = 'bg-brand text-white'
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(o.key)}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium transition-colors ${active ? activeClass : baseInactive}`}
              >
                {o.icon}
                <span>{o.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
