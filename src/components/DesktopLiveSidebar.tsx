/**
 * PC 좌측 고정 사이드바 — 반응형 (md+ 노출)
 *  - md(768) ~ xl(1280) 미만: 60px collapsed (아이콘만, 라벨/섹션헤더 숨김)
 *  - xl(1280)+: 224px (w-56) 풀 (라벨 + 섹션헤더 + 앱 CTA)
 *  - md 미만: 숨김 (BottomNav 사용)
 * 시안: docs/design/responsive-tablet-mobile.md (2026-05-06)
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
  { labelKey: 'category.chickenPizza',  labelDefault: '치킨·피자',     icon: Utensils,        path: '/browse?category=food&sub=chicken' },
  { labelKey: 'category.koreanFood',    labelDefault: '한식·분식',     icon: UtensilsCrossed, path: '/browse?category=food&sub=korean' },
  { labelKey: 'category.cafe',          labelDefault: '카페·디저트',   icon: Coffee,          path: '/browse?category=food&sub=cafe' },
  { labelKey: 'category.japanese',      labelDefault: '일식·돈까스',   icon: Fish,            path: '/browse?category=food&sub=japanese' },
  { labelKey: 'category.asian',         labelDefault: '아시안·양식',   icon: Globe,           path: '/browse?category=food&sub=asian' },
  { labelKey: 'category.beauty',        labelDefault: '뷰티·헬스',     icon: Sparkles,        path: '/browse?category=beauty' },
  { labelKey: 'category.living',        labelDefault: '리빙·인테리어', icon: Sofa,            path: '/browse?category=living' },
]

const MY_ITEMS: NavItem[] = [
  { labelKey: 'my.profile',  labelDefault: '마이페이지', icon: User,        path: '/user/profile', active: (p) => p.startsWith('/user/profile') || p === '/mypage' },
  { labelKey: 'my.orders',   labelDefault: '주문내역',   icon: PackageSearch, path: '/my-orders',  active: (p) => p.startsWith('/my-orders') },
  { labelKey: 'my.wishlist', labelDefault: '찜',         icon: Heart,       path: '/wishlist',     active: (p) => p.startsWith('/wishlist') },
  { labelKey: 'my.vouchers', labelDefault: '내 식사권',  icon: BookOpen,    path: '/my-vouchers',  active: (p) => p.startsWith('/my-vouchers') },
]

/**
 * NavBtn — 반응형:
 *  - xl 미만 (태블릿): 가운데 정렬 아이콘만, 좌측 보더로 active 표시
 *  - xl+: 라벨 노출, 배경 강조로 active 표시
 */
function NavBtn({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  const Icon = item.icon
  const label = t(item.labelKey, { defaultValue: item.labelDefault })
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center justify-center xl:justify-start xl:gap-2.5 w-full h-12 xl:h-auto xl:px-3 xl:py-2 xl:rounded-lg text-left transition-colors text-[13px] font-medium relative ${
        isActive
          ? 'xl:bg-pink-50 xl:dark:bg-pink-500/10 text-pink-600 dark:text-pink-400'
          : 'text-gray-600 dark:text-white/60 xl:hover:bg-gray-100 xl:dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      {/* 태블릿 active 좌측 보더 (xl 미만에서만) */}
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-pink-500 rounded-r xl:hidden" aria-hidden="true" />
      )}
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="hidden xl:inline-block">{label}</span>
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
      {/* 로고 — 태블릿 collapsed 에서는 작은 U 아이콘 */}
      <Link to="/" className="flex items-center justify-center xl:justify-start xl:px-4 h-14 shrink-0">
        <span className="block xl:hidden w-7 h-7 rounded-md bg-gradient-to-br from-[#EF4444] to-[#EC4899] text-white font-black text-[12px] flex items-center justify-center" aria-hidden="true">U</span>
        <span className="hidden xl:block">
          <UrDealLogo size={20} />
        </span>
      </Link>

      <div className="flex-1 px-1 xl:px-2 pb-4 flex flex-col xl:gap-5 gap-1">
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

        {/* divider for tablet (xl 미만), section header for xl */}
        <div className="xl:hidden mx-2 my-1 h-px bg-gray-100 dark:bg-white/[0.06]" aria-hidden="true" />

        {/* CATEGORY */}
        <section>
          <p className="hidden xl:block text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
            {t('nav.sectionCategory', { defaultValue: 'Category' })}
          </p>
          {CATEGORY_ITEMS.map(cat => {
            const Icon = cat.icon
            const catPathWithQuery = cat.path
            const isActive = (pathname + search) === catPathWithQuery
            const label = t(cat.labelKey, { defaultValue: cat.labelDefault })
            return (
              <button
                key={cat.labelDefault}
                type="button"
                onClick={() => navigate(cat.path)}
                title={label}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-center xl:justify-start xl:gap-2.5 w-full h-12 xl:h-auto xl:px-3 xl:py-2 xl:rounded-lg text-left transition-colors text-[13px] font-medium relative ${
                  isActive
                    ? 'xl:bg-pink-50 xl:dark:bg-pink-500/10 text-pink-600 dark:text-pink-400'
                    : 'text-gray-600 dark:text-white/60 xl:hover:bg-gray-100 xl:dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-pink-500 rounded-r xl:hidden" aria-hidden="true" />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="hidden xl:inline-block">{label}</span>
              </button>
            )
          })}
        </section>

        <div className="xl:hidden mx-2 my-1 h-px bg-gray-100 dark:bg-white/[0.06]" aria-hidden="true" />

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

      {/* 앱 다운로드 CTA — xl+ 에서만 (태블릿에서는 공간 부족) */}
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
