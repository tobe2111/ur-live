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
import { useMemo, useRef } from 'react'
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

const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다
/**
 * 🎬 2026-11-03 로그아웃 마이(대표 *"로그아웃 시 나타나는 유어샵, 마이페이지에서도 모션그래픽 넣어줘 중요해"*).
 *   위쪽 카드(인사·숫자 셋·카카오 버튼)는 **서버 첫 화면이 이미 그린 것**이라 움직이지 않는다(깜빡임).
 *   ① 최근 본 이용권 — 카드가 오른쪽에서 차례로 들어온다
 *   ② 아래 목록(사장님·도움말) — 구역마다 아래에서 차례로 떠오른다
 *   ③ 화면 테마 줄 — 누른 자리에서 새 색이 원으로 퍼진다(설정 화면과 같은 처방)
 */
injectMotionCss('ur-m-guestmy', `@keyframes ur-gm-card { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: none; } }@keyframes ur-gm-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }.ur-gm-recent > * { animation: ur-gm-card .5s cubic-bezier(.2,1,.3,1) .12s backwards; }.ur-gm-recent > :nth-child(2) { animation-delay: .19s; }.ur-gm-recent > :nth-child(3) { animation-delay: .26s; }.ur-gm-recent > :nth-child(n+4) { animation-delay: .33s; }.ur-gm-rest > * { animation: ur-gm-up .45s cubic-bezier(.2,1,.3,1) .18s backwards; }.ur-gm-rest > :nth-child(2) { animation-delay: .24s; }.ur-gm-rest > :nth-child(3) { animation-delay: .3s; }.ur-gm-rest > :nth-child(n+4) { animation-delay: .36s; }@media (prefers-reduced-motion: reduce){.ur-gm-recent > *,.ur-gm-rest > *{animation:none!important}}`)

const ROW_ICON = 18
const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }

export default function GuestMyPage() {
  const { t } = useTranslation()
  const recent = useMemo(() => readRecentlyViewed().slice(0, 6), [])
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)
  const lastTap = useRef({ clientX: 0, clientY: 0 }) // 🎬 ③ 원이 퍼질 자리 — 줄 부품이 클릭 위치를 안 넘겨서 여기서 잡는다
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

      <div className="mt-5">
        {locked.map((r) => (
          <ListRow key={r.label} icon={r.icon} label={r.label} hint={lockedHint} onClick={() => startGuestKakaoLogin('/user/profile')} />
        ))}
      </div>

      {recent.length > 0 && (
        <section>
          <SectionTitle>{t('guest.my.recent', { defaultValue: '최근 본 이용권' })}</SectionTitle>
          <div className="ur-gm-recent mt-2 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
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

      <div className="ur-gm-rest" onPointerDownCapture={(e) => { lastTap.current = { clientX: e.clientX, clientY: e.clientY } }}>
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
          onClick={() => {
            // 설정 묶음은 첫 화면에 안 싣는다 — 누를 때 받고, 못 받으면 그냥 바꾼다
            const next = NEXT_MODE[mode]
            import('@/components/settings/ThemeToggleSection').then((m) => m.revealTheme(lastTap.current, () => setMode(next))).catch(() => setMode(next))
          }}
        />
        <ListRow icon={<ReceiptIcon size={ROW_ICON} />} label={t('guest.my.terms', { defaultValue: '약관·정책' })} to="/terms" />
      </div>
      </div>

      <GuestDock returnPath="/user/profile" />
    </div>
  )
}
