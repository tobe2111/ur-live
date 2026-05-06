/**
 * PC 좌측 고정 사이드바
 * - xl(1280px)+: 224px 풀 사이드바 (라벨 표시)
 * - md(768px)~xl: 60px collapsed (아이콘만, 라벨 숨김)
 * - <md: hidden (BottomNav 사용)
 *
 * MobileAppLayout 에서 HIDE_SIDEBAR_PREFIXES 제외 전 페이지에 삽입.
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Radio, Compass, ShoppingBag, Ticket, Utensils, Globe, Sparkles, Sofa, User, PackageSearch, Heart, BookOpen } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'

interface NavItem {
  labelKey: string
  labelDefault: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  active?: (pathname: string, search: string) => boolean
}

const MENU_ITEMS: NavItem[] = [
  { labelKey: 'nav.home',      labelDefault: '홈',       icon: Home,        path: '/',             active: (p) => p === '/' },
  { labelKey: 'nav.live',      labelDefault: '라이브',   icon: Radio,       path: '/live',         active: (p) => p.startsWith('/live') },
  { labelKey: 'nav.browse',    labelDefault: '둘러보기', icon: Compass,     path: '/browse',       active: (p, s) => p === '/browse' && !s.includes('category=') },
  { labelKey: 'nav.groupBuy',  labelDefault: '공동구매', icon: ShoppingBag, path: '/group-buy',    active: (p) => p.startsWith('/group-buy') },
  { labelKey: 'nav.voucher',   labelDefault: '식사권',   icon: Ticket,      path: '/browse?category=meal_voucher', active: (p, s) => p === '/browse' && s.includes('category=meal_voucher') },
]

const CATEGORY_ITEMS = [
  { labelKey: 'category.food',     labelDefault: '음식·식사권',   icon: Utensils,        slug: 'food' },
  { labelKey: 'category.voucher',  labelDefault: '식사권',        icon: Ticket,          slug: 'meal_voucher' },
  { labelKey: 'category.beauty',   labelDefault: '뷰티·헬스',     icon: Sparkles,        slug: 'beauty' },
  { labelKey: 'category.living',   labelDefault: '리빙·인테리어', icon: Sofa,            slug: 'living' },
  { labelKey: 'category.fashion',  labelDefault: '패션',          icon: ShoppingBag,     slug: 'fashion' },
  { labelKey: 'category.digital',  labelDefault: '디지털',        icon: Globe,           slug: 'digital' },
]

const MY_ITEMS: NavItem[] = [
  { labelKey: 'my.profile',  labelDefault: '마이페이지', icon: User,        path: '/user/profile', active: (p) => p.startsWith('/user/profile') || p === '/mypage' },
  { labelKey: 'my.orders',   labelDefault: '주문내역',   icon: PackageSearch, path: '/my-orders',  active: (p) => p.startsWith('/my-orders') },
  { labelKey: 'my.wishlist', labelDefault: '찜',         icon: Heart,       path: '/wishlist',     active: (p) => p.startsWith('/wishlist') },
  { labelKey: 'my.vouchers', labelDefault: '내 식사권',  icon: BookOpen,    path: '/my-vouchers',  active: (p) => p.startsWith('/my-vouchers') },
]

function NavBtn({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      title={t(item.labelKey, { defaultValue: item.labelDefault })}
      className={`flex items-center xl:gap-2.5 w-full xl:px-3 py-2 xl:rounded-lg text-left transition-colors text-[13px] font-medium
        md:justify-center md:h-12 md:rounded-none md:border-l-2 xl:justify-start xl:h-auto xl:border-l-0 xl:rounded-lg
        ${isActive
          ? 'md:border-l-red-500 md:bg-red-500/[0.08] xl:border-l-transparent xl:bg-pink-50 xl:dark:bg-pink-500/10 text-pink-600 dark:text-pink-400'
          : 'border-l-transparent text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
        }`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="hidden xl:inline">{t(item.labelKey, { defaultValue: item.labelDefault })}</span>
    </button>
  )
}

export default function DesktopLiveSidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname
  const search = location.search

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 bottom-0 w-[60px] xl:w-56 z-40 flex-col bg-white dark:bg-[#0A0A0A] border-r border-gray-100 dark:border-white/[0.06] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      aria-label={t('nav.mainMenu', { defaultValue: '메인 메뉴' })}
    >
      {/* 로고 — xl: 풀 로고, md~xl: 'U' 아이콘. sticky 로 사이드바 스크롤 시 항상 표시 */}
      <Link to="/" className="sticky top-0 z-10 bg-white dark:bg-[#0A0A0A] flex items-center justify-center xl:justify-start xl:px-4 h-14 shrink-0">
        <span className="xl:hidden text-[18px] font-black text-red-500 select-none">U</span>
        <span className="hidden xl:block"><UrDealLogo size={20} /></span>
      </Link>

      <div className="flex-1 xl:px-2 pb-4 flex flex-col xl:gap-5">
        {/* MENU */}
        <section>
          <p className="hidden xl:block text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
            {t('nav.sectionMenu', { defaultValue: 'Menu' })}
          </p>
          {MENU_ITEMS.map(item => (
            <NavBtn
              key={item.path}
              item={item}
              isActive={item.active?.(pathname, search) ?? false}
              onClick={() => navigate(item.path)}
            />
          ))}
        </section>

        {/* CATEGORY */}
        <section>
          <p className="hidden xl:block text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
            {t('nav.sectionCategory', { defaultValue: 'Category' })}
          </p>
          {CATEGORY_ITEMS.map(cat => {
            const Icon = cat.icon
            const catPath = `/browse?category=${cat.slug}`
            const isActive = pathname === '/browse' && search.includes(`category=${cat.slug}`)
            return (
              <button
                key={cat.labelDefault}
                type="button"
                title={t(cat.labelKey, { defaultValue: cat.labelDefault })}
                onClick={() => navigate(catPath)}
                className={`flex items-center xl:gap-2.5 w-full xl:px-3 py-2 text-left transition-colors text-[13px] font-medium
                  md:justify-center md:h-12 md:rounded-none md:border-l-2 xl:justify-start xl:h-auto xl:border-l-0 xl:rounded-lg
                  ${isActive
                    ? 'md:border-l-red-500 md:bg-red-500/[0.08] xl:border-l-transparent xl:bg-pink-50 xl:dark:bg-pink-500/10 text-pink-600 dark:text-pink-400'
                    : 'border-l-transparent text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="hidden xl:inline">{t(cat.labelKey, { defaultValue: cat.labelDefault })}</span>
              </button>
            )
          })}
        </section>

        {/* MY */}
        <section>
          <p className="hidden xl:block text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
            {t('nav.sectionMy', { defaultValue: 'My' })}
          </p>
          {MY_ITEMS.map(item => (
            <NavBtn
              key={item.path}
              item={item}
              isActive={item.active?.(pathname, search) ?? false}
              onClick={() => navigate(item.path)}
            />
          ))}
        </section>
      </div>

      {/* 앱 다운로드 CTA — xl 에서만 */}
      <div className="hidden xl:block mx-3 mb-4 rounded-xl bg-pink-500 p-3 shrink-0">
        <p className="text-white text-[13px] font-bold leading-tight">유어딜 앱으로</p>
        <p className="text-white/80 text-[11px] mt-1 leading-snug">라이브 알림 + 추천 / 앱 전용 혜택</p>
        <button
          type="button"
          onClick={() => navigate('/introduce')}
          className="mt-2.5 w-full bg-black text-white text-[12px] font-bold py-1.5 rounded-lg"
        >
          {t('nav.appDownload', { defaultValue: '앱 다운로드' })}
        </button>
      </div>
    </aside>
  )
}
