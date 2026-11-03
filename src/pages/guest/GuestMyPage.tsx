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
 *
 * 2026-11-03 대표 *"제안대로 다 해줘"*(시안 `docs/design/guest-tabs-v2-2026-11-03.md`): `-` 세 칸이 고장 난 화면처럼
 * 보여서 **줄 목록 "내 딜 · 내 이용권 · 찜한 가게 — 로그인 후 보여요"** 로 바꿨다(누르면 카카오 로그인).
 * 카카오 버튼은 아래 고정(`GuestDock`).
 */
import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import Udal from '@/components/mascot/Udal'
import { StoreIcon, InfoIcon, HomeIcon, SettingsIcon, ReceiptIcon, WalletIcon, CouponIcon, HeartIcon } from '@/components/icons/urdeal-icons'
import { SectionTitle, ListRow } from '@/pages/user-profile/list-grammar'
import { readRecentlyViewed } from '@/components/group-buy/RecentlyViewedStrip'
import { useTheme, type ThemeMode } from '@/shared/stores/useTheme'
import DealMiniCard from '@/components/deal/DealMiniCard'
import { GUEST_CLS, GUEST_COPY, GUEST_MY_MASCOT } from '@/shared/guest-page'
import GuestDock from './GuestDock'
import { startGuestKakaoLogin } from './guest-login'

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

  const lockedHint = t('guest.my.lockedHint', { defaultValue: GUEST_COPY.my.lockedHint })
  const locked = [
    { icon: <WalletIcon size={ROW_ICON} />, label: t('guest.my.statDeal', { defaultValue: GUEST_COPY.my.locked[0] }) },
    { icon: <CouponIcon size={ROW_ICON} />, label: t('guest.my.statPass', { defaultValue: GUEST_COPY.my.locked[1] }) },
    { icon: <HeartIcon size={ROW_ICON} />, label: t('guest.my.statWish', { defaultValue: GUEST_COPY.my.locked[2] }) },
  ]

  return (
    <div className={GUEST_CLS.root}>
      <SEO title={t('userProfile.docTitle')} description={t('userProfile.seoDesc')} url="/user/profile" noindex />
      <h1 className={GUEST_CLS.title}>
        {t('guest.my.title', { defaultValue: GUEST_COPY.my.title })}
      </h1>

      <section className={GUEST_CLS.hero} data-guest="my">
        <div className={GUEST_CLS.myHead}>
          <Udal mood="hello" size={GUEST_MY_MASCOT.width} />
          <div className={GUEST_CLS.myHeadText}>
            <p className={GUEST_CLS.myHello}>{t('guest.my.hello', { defaultValue: GUEST_COPY.my.hello })}</p>
            <p className={GUEST_CLS.myHelloSub}>{t('guest.my.helloSub', { defaultValue: GUEST_COPY.my.helloSub })}</p>
          </div>
        </div>
      </section>

      <div className="mt-4">
        {locked.map((r) => (
          <ListRow key={r.label} icon={r.icon} label={r.label} hint={lockedHint} onClick={() => startGuestKakaoLogin('/user/profile')} />
        ))}
      </div>

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

      <GuestDock returnPath="/user/profile" />
    </div>
  )
}
