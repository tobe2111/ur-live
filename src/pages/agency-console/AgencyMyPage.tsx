import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { PersonIcon, SettingsIcon } from '@/components/icons/urdeal-icons'
import { SectionTitle, ListRow } from '@/pages/user-profile/list-grammar'
import { useTheme, type ThemeMode } from '@/shared/stores/useTheme'
import { toast } from '@/hooks/useToast'
import AgencySection from './AgencySection'
import { readAgencyProfile } from './agency-api'
import { agencyStaffLoginLabel } from '@/shared/agency-kakao'

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }
const MODE_LABEL: Record<ThemeMode, string> = { system: '시스템', light: '라이트', dark: '다크' }

/**
 * 🏢 **이메일 전용 에이전시 계정의 마이** — 2026-10-26 대표 확정 안 A.
 *   대표: *"회사 이메일로 해도 마이 페이지 들어가면 되잖아"*.
 *
 * 손님(카카오) 로그인이 없고 에이전시 로그인만 있을 때 `/user/profile` 자리에 뜬다(`App.tsx` 의 guest 자리).
 * 손님 계정이 아니므로 '내가 산 것' 같은 손님 메뉴는 없고, 에이전시 구역과 설정만 있다.
 * 손님 메뉴가 없어 칸이 넓으니 PC 에서 두 칸(맡은 매장 목록 + 고른 매장의 판)으로 그린다.
 *
 * 같은 브라우저에서 카카오로도 로그인하면 손님 마이가 뜨고, 그 안에 같은 '에이전시' 구역이 선다.
 */
export default function AgencyMyPage() {
  const navigate = useNavigate()
  const profile = readAgencyProfile()
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)

  const onSessionEnd = useCallback((why: 'expired' | 'logout') => {
    if (why === 'expired') toast.error('에이전시 로그인이 끝났어요. 다시 로그인해 주세요.')
    navigate(why === 'expired' ? '/agency/login?returnUrl=%2Fagency' : '/agency/login', { replace: true })
  }, [navigate])

  const name = profile?.agency.name ?? '에이전시'
  const who = profile ? `${profile.staff.name || agencyStaffLoginLabel(profile.staff.email)} · ${profile.staff.role === 'admin' ? '관리자' : '직원'}` : ''

  return (
    <div className="bg-warm dark:bg-[#11141C] min-h-[100dvh] pb-10">
      <SEO title="마이 - 유어딜" description="유어딜 에이전시" url="/user/profile" noindex />
      <div className="mx-auto w-full max-w-[720px] lg:max-w-[1040px] lg:px-2">
        <header className="flex items-center gap-3 px-4 pt-5 pb-1">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[17px] font-bold text-brand-text" aria-hidden="true">
            {name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-bold tracking-[-0.01em] text-gray-900 dark:text-white">{name}</h1>
            {who && <p className="mt-1 truncate text-[13px] text-gray-500 dark:text-gray-400">{who}</p>}
          </div>
        </header>

        <div className="mt-6">
          <AgencySection headless onSessionEnd={onSessionEnd} />
        </div>

        <SectionTitle>설정</SectionTitle>
        <div>
          <ListRow icon={<PersonIcon size={18} />} label="손님으로도 쓰기" hint="카카오 로그인" to="/login?returnUrl=%2Fuser%2Fprofile" />
          <ListRow icon={<SettingsIcon size={18} />} label="화면 테마" hint={MODE_LABEL[mode]} onClick={() => setMode(NEXT_MODE[mode])} />
        </div>
      </div>
    </div>
  )
}
