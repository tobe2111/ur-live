/**
 * 👤 로그인 전 **마이 탭**(`/user/profile`) — 2026-10-12 대표 확정 시안(최종안 ③).
 *
 * 로그인하면 **무엇이 모이는지**를 먼저 보여 준다(보유 딜 · 내 이용권 · 찜한 가게 — 값은 `-`).
 * 0 이라고 적지 않는다: 모르는 것과 0 은 다르다(2026-09-16 잔액 카드 규칙).
 * 로그인 없이도 되는 것(최근 본 이용권 · 도움말 · 화면 테마)은 그대로 쓸 수 있다.
 *
 * 목록은 마이와 **같은 부품**(`list-grammar` — 안 C)으로 그린다. 로그인 전후로 같은 화면이 다른
 * 문법으로 보이면 두 화면이 된다.
 * 대표 확정: 사장님 줄 오른쪽 "팔린 만큼만 수수료" 문구는 빼기로 했다(2026-10-12).
 */
import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import Udal from '@/components/mascot/Udal'
import { StoreIcon, InfoIcon, HomeIcon, SettingsIcon, ReceiptIcon } from '@/components/icons/urdeal-icons'
import { SectionTitle, ListRow } from '@/pages/user-profile/list-grammar'
import { readRecentlyViewed } from '@/components/group-buy/RecentlyViewedStrip'
import { useTheme, type ThemeMode } from '@/shared/stores/useTheme'
import DealMiniCard from '@/components/deal/DealMiniCard'
import GuestKakaoButton from './GuestKakaoButton'

const ROW_ICON = 18
const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

export default function GuestMyPage() {
  const { t } = useTranslation()
  const recent = useMemo(() => readRecentlyViewed().slice(0, 6), [])
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)
  const modeLabel = {
    system: t('guest.my.themeSystem', { defaultValue: '시스템' }),
    light: t('guest.my.themeLight', { defaultValue: '라이트' }),
    dark: t('guest.my.themeDark', { defaultValue: '다크' }),
  }[mode]

  const stats = [
    t('guest.my.statDeal', { defaultValue: '보유 딜' }),
    t('guest.my.statPass', { defaultValue: '내 이용권' }),
    t('guest.my.statWish', { defaultValue: '찜한 가게' }),
  ]

  return (
    <div className="min-h-[100dvh] bg-warm pb-8">
      <SEO title={t('userProfile.docTitle')} description={t('userProfile.seoDesc')} url="/user/profile" noindex />
      <h1 className="px-4 pt-4 pb-2 text-[17px] font-bold tracking-tight text-gray-900 dark:text-white">
        {t('guest.my.title', { defaultValue: '마이' })}
      </h1>

      <section className="mx-4 mt-2 rounded-2xl bg-surface shadow-lift p-5" data-guest="my">
        <div className="flex items-center gap-4">
          <Udal mood="hello" size={56} />
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-gray-900 dark:text-white">{t('guest.my.hello', { defaultValue: '반가워요!' })}</p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('guest.my.helloSub', { defaultValue: '산 이용권·딜·찜한 가게를 한곳에서' })}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 border-t border-rule pt-4 text-center">
          {stats.map((label) => (
            <div key={label}>
              <p className="text-[17px] font-bold text-gray-400 dark:text-gray-500" aria-hidden="true">-</p>
              <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <GuestKakaoButton returnPath="/user/profile" />
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <SectionTitle>{t('guest.my.recent', { defaultValue: '최근 본 이용권' })}</SectionTitle>
          <div className="mt-2 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {recent.map((it) => (
              <DealMiniCard
                key={it.id}
                to={`/pass/${it.id}`}
                imageUrl={it.image_url}
                title={it.name}
                price={Number(it.price) > 0 ? Number(it.price) : null}
                className="shrink-0 w-28"
                imgWidth={240}
              />
            ))}
          </div>
        </section>
      )}

      <SectionTitle>{t('guest.owner.title', { defaultValue: '사장님이세요?' })}</SectionTitle>
      <div>
        <ListRow icon={<StoreIcon size={ROW_ICON} />} label={t('guest.my.sell', { defaultValue: '내 가게 이용권 팔기' })} to="/partners" />
      </div>

      <SectionTitle>{t('guest.my.help', { defaultValue: '도움말' })}</SectionTitle>
      <div>
        <ListRow icon={<InfoIcon size={ROW_ICON} />} label={t('guest.my.faq', { defaultValue: '자주 묻는 질문' })} to="/faq" />
        <ListRow icon={<HomeIcon size={ROW_ICON} />} label={t('guest.my.about', { defaultValue: '유어딜 소개' })} to="/about" />
        <ListRow
          icon={<SettingsIcon size={ROW_ICON} />}
          label={t('guest.my.theme', { defaultValue: '화면 테마' })}
          hint={modeLabel}
          onClick={() => setMode(NEXT_MODE[mode])}
        />
        <ListRow icon={<ReceiptIcon size={ROW_ICON} />} label={t('guest.my.terms', { defaultValue: '약관·정책' })} to="/terms" />
      </div>
    </div>
  )
}
