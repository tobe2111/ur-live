import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  X, ChevronRight, Heart, Ticket, Package, Settings, Coins,
  Bell, HelpCircle, Store, LogOut, Smartphone, LogIn, UserPlus,
} from 'lucide-react'
import { getUserNameSync, getUserEmail } from '@/utils/auth'
import { sellerEntryPath } from '@/utils/seller-entry'

/**
 * 👤 계정 드롭다운 패널 (2026-08-19 — 대표가 공유한 그루폰 계정 패널 시안).
 *
 * 그루폰 구조를 그대로 따른다: `Hi, 이름!` + 닫기 → 계정 행(이름·이메일) → 메뉴 리스트
 * (우측에 값/카운트) → 앱 블록 → 판매하세요 / 로그아웃.
 *
 * 🚫 **여기서 데이터를 새로 부르지 않는다.** 카운트는 헤더가 이미 갖고 있는 값(`useWishlist`/
 *    `useUnreadCount`)을 prop 으로 받는다 — 패널을 열 때마다 네트워크가 튀면 안 된다.
 *
 * 🔗 목적지는 전부 실재하는 라우트다(App.tsx 확인). 없는 기능(그루폰 Bucks·기프트카드 등)은
 *    흉내내지 않고 뺀다 — 눌렀는데 아무 데도 안 가는 항목이 제일 나쁘다.
 */

type Row = { icon: typeof Heart; label: string; path: string; badge?: string }

export default function AccountMenu({
  loggedIn,
  unreadCount,
  wishCount,
  onClose,
  onOpenApp,
}: {
  loggedIn: boolean
  unreadCount: number
  wishCount: number
  onClose: () => void
  onOpenApp: () => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const name = getUserNameSync() || ''
  const email = getUserEmail() || ''

  const go = (path: string) => { onClose(); navigate(path) }

  const rows: Row[] = loggedIn
    ? [
        { icon: Heart,      label: t('nav.myWishlist', { defaultValue: '찜한 이용권' }), path: '/wishlist', badge: wishCount > 0 ? String(wishCount) : undefined },
        { icon: Ticket,     label: t('nav.myVouchers', { defaultValue: '내 이용권' }), path: '/my-vouchers' },
        { icon: Package,    label: t('nav.myOrders', { defaultValue: '주문 내역' }), path: '/my-orders' },
        { icon: Coins,      label: t('nav.myDeal', { defaultValue: '딜 내역' }), path: '/my-deal-history' },
        { icon: Bell,       label: t('nav.notifications', { defaultValue: '알림' }), path: '/notifications', badge: unreadCount > 0 ? String(unreadCount) : undefined },
        { icon: Settings,   label: t('nav.settings', { defaultValue: '설정' }), path: '/account/settings' },
        { icon: HelpCircle, label: t('nav.support', { defaultValue: '고객센터' }), path: '/faq' },
      ]
    : [
        { icon: LogIn,      label: t('auth.login', { defaultValue: '로그인' }), path: '/login' },
        { icon: UserPlus,   label: t('auth.signup', { defaultValue: '회원가입' }), path: '/register' },
        { icon: HelpCircle, label: t('nav.support', { defaultValue: '고객센터' }), path: '/faq' },
      ]

  async function signOut() {
    onClose()
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* 네트워크 실패해도 아래 로컬 정리는 반드시 한다 */ }
    try {
      const { clearAuthData } = await import('@/utils/auth')
      clearAuthData('user')
    } catch { /* noop */ }
    window.location.href = '/'
  }

  return (
    <div
      role="menu"
      aria-label={t('nav.my', { defaultValue: '마이' })}
      className="absolute right-0 top-[calc(100%+10px)] w-[300px] max-h-[min(78vh,680px)] overflow-y-auto rounded-2xl bg-white dark:bg-[#141C27] border border-gray-100 dark:border-[#2C2F35] shadow-[0_16px_40px_-14px_rgba(10,20,40,.45)] z-50"
    >
      {/* 인사 + 닫기 */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
        <p className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white">
          {loggedIn && name
            ? t('nav.greeting', { defaultValue: '안녕하세요, {{name}}님!', name })
            : t('nav.greetingGuest', { defaultValue: '유어딜에 오신 걸 환영해요' })}
        </p>
        <button
          onClick={onClose}
          aria-label={t('common.close', { defaultValue: '닫기' })}
          className="shrink-0 w-7 h-7 -mt-0.5 rounded-full border border-gray-200 dark:border-[#2C2F35] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.05]"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>

      {/* 계정 행 — 누르면 내 계정으로 */}
      {loggedIn && (
        <button
          role="menuitem"
          onClick={() => go('/user/profile')}
          className="w-full flex items-center gap-3 px-5 py-3 mt-1 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors text-left"
        >
          <span className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-white/[0.10] flex items-center justify-center text-[15px] font-black text-gray-500 dark:text-gray-300">
            {(name || '유').slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-gray-900 dark:text-white truncate">{name || t('nav.my', { defaultValue: '마이' })}</span>
            {email && <span className="block text-[12px] text-gray-400 dark:text-gray-500 truncate">{email}</span>}
          </span>
          <ChevronRight className="shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600" strokeWidth={2} />
        </button>
      )}

      <div className="mx-5 h-px bg-gray-100 dark:bg-[#2C2F35]" />

      {/* 메뉴 */}
      <div className="py-1.5">
        {rows.map(({ icon: Icon, label, path, badge }) => (
          <button
            key={path}
            role="menuitem"
            onClick={() => go(path)}
            className="w-full flex items-center gap-3 px-5 py-2.5 text-[13.5px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            <Icon className="shrink-0 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" strokeWidth={1.9} />
            <span className="flex-1 text-left">{label}</span>
            {badge && <span className="shrink-0 text-[12px] font-bold text-brand">{badge}</span>}
          </button>
        ))}
      </div>

      {/* 앱 — 그루폰의 QR 블록 자리. 우리는 기존 앱 모달(QR)을 그대로 연다. */}
      <div className="mx-5 h-px bg-gray-100 dark:bg-[#2C2F35]" />
      <button
        role="menuitem"
        onClick={onOpenApp}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
      >
        <Smartphone className="shrink-0 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" strokeWidth={1.9} />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold text-gray-900 dark:text-white">
            {t('nav.getApp', { defaultValue: '앱으로 보기' })}
          </span>
          <span className="block text-[11.5px] text-gray-400 dark:text-gray-500">
            {t('nav.getAppHint', { defaultValue: 'QR 찍고 폰에서 이어서' })}
          </span>
        </span>
      </button>

      <div className="mx-5 h-px bg-gray-100 dark:bg-[#2C2F35]" />
      <button
        role="menuitem"
        onClick={() => go(sellerEntryPath())}
        className="w-full flex items-center gap-3 px-5 py-2.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
      >
        <Store className="shrink-0 w-[17px] h-[17px]" strokeWidth={1.9} />
        {t('nav.sellOnUrdeal', { defaultValue: '유어딜에서 판매하세요' })}
      </button>
      {loggedIn && (
        <button
          role="menuitem"
          onClick={() => void signOut()}
          className="w-full flex items-center gap-3 px-5 py-2.5 mb-1.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
        >
          <LogOut className="shrink-0 w-[17px] h-[17px]" strokeWidth={1.9} />
          {t('auth.logout', { defaultValue: '로그아웃' })}
        </button>
      )}
    </div>
  )
}
