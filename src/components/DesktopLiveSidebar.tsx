/**
 * PC 좌측 고정 사이드바 — xl(1280px)+ 에서만 노출.
 * 3섹션: MENU / CATEGORY / MY + 앱 다운로드 CTA
 * MobileAppLayout 에서 HIDE_SIDEBAR_PREFIXES 제외 전 페이지에 삽입.
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Radio, Compass, ShoppingBag, Ticket, Utensils, UtensilsCrossed, Coffee, Fish, Globe, Sparkles, Sofa, User, PackageSearch, Heart, BookOpen } from 'lucide-react'
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
  { labelKey: 'category.chickenPizza',  labelDefault: '치킨·피자',     icon: Utensils,        slug: 'food' },
  { labelKey: 'category.koreanFood',    labelDefault: '한식·분식',     icon: UtensilsCrossed, slug: 'food' },
  { labelKey: 'category.cafe',          labelDefault: '카페·디저트',   icon: Coffee,          slug: 'food' },
  { labelKey: 'category.japanese',      labelDefault: '일식·돈까스',   icon: Fish,            slug: 'food' },
  { labelKey: 'category.asian',         labelDefault: '아시안·양식',   icon: Globe,           slug: 'food' },
  { labelKey: 'category.beauty',        labelDefault: '뷰티·헬스',     icon: Sparkles,        slug: 'beauty' },
  { labelKey: 'category.living',        labelDefault: '리빙·인테리어', icon: Sofa,            slug: 'living' },
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
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-colors text-[13px] font-medium ${
        isActive
          ? 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400'
          : 'text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {t(item.labelKey, { defaultValue: item.labelDefault })}
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
      className="hidden xl:flex fixed left-0 top-0 bottom-0 w-56 z-40 flex-col bg-white dark:bg-[#0A0A0A] border-r border-gray-100 dark:border-white/[0.06] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      aria-label={t('nav.mainMenu', { defaultValue: '메인 메뉴' })}
    >
      {/* 로고 */}
      <Link to="/" className="flex items-center px-4 h-14 shrink-0">
        <UrDealLogo size={20} />
      </Link>

      <div className="flex-1 px-2 pb-4 flex flex-col gap-5">
        {/* MENU */}
        <section>
          <p className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
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
          <p className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
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
                onClick={() => navigate(catPath)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-colors text-[13px] font-medium ${
                  isActive
                    ? 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400'
                    : 'text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {t(cat.labelKey, { defaultValue: cat.labelDefault })}
              </button>
            )
          })}
        </section>

        {/* MY */}
        <section>
          <p className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
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

      {/* 앱 다운로드 CTA */}
      <div className="mx-3 mb-4 rounded-xl bg-pink-500 p-3 shrink-0">
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
