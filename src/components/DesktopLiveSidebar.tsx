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
import { Home, Radio, Compass, MapPin, Utensils, Sparkles, Bed, Tag, Package, User, PackageSearch, Heart, BookOpen } from 'lucide-react'
import { LIVE_COMMERCE_SUSPENDED, SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'
import UrDealLogo from '@/components/brand/UrDealLogo'

interface NavItem {
  labelKey: string
  labelDefault: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  active?: (pathname: string, search: string) => boolean
}

// 🧭 2026-06-17 (사용자 요청): '공구'·'식사권'(둘 다 /group-buy 계열) → 단일 '오프라인 공동구매'(동네딜) 로 통합.
//   /live·/browse 는 플래그로 숨김 상태이나 가역 위해 항목 보존(아래 filter).
const MENU_ITEMS: NavItem[] = [
  { labelKey: 'nav.home',            labelDefault: '홈',             icon: Home,    path: '/',          active: (p) => p === '/' },
  { labelKey: 'nav.live',            labelDefault: '라이브',         icon: Radio,   path: '/live',      active: (p) => p.startsWith('/live') },
  { labelKey: 'nav.browse',          labelDefault: '둘러보기',       icon: Compass, path: '/browse',    active: (p, s) => p === '/browse' && !s.includes('category=') },
  { labelKey: 'nav.offlineGroupBuy', labelDefault: '오프라인 공동구매', icon: MapPin, path: '/group-buy',
    // 동네딜 허브(전체) — 특정 카테고리 필터일 땐 아래 CATEGORY 항목이 활성, 여기선 비활성(이중 강조 방지).
    active: (p, s) => p.startsWith('/group-buy') && !/category=(meal_voucher|beauty_voucher|stay_voucher|etc_voucher|general)/.test(s) },
]

// 🧭 2026-06-17 (사용자 요청): 오프라인 공동구매(동네딜) 카테고리 — GroupBuyListPage 탭과 1:1.
//   맛집 식사권 / 미용 / 숙소 / 기타 / 일반 상품. 모두 /group-buy?category= 로 동일 그리드 안에서 필터(일관성).
//   숙소는 그리드에 인라인 노출하되 카드 클릭만 /stays/:id(객실·날짜 예약)로 — GroupBuyListPage 참조.
const CATEGORY_ITEMS: NavItem[] = [
  { labelKey: 'category.mealVoucher', labelDefault: '맛집 식사권', icon: Utensils, path: '/group-buy?category=meal_voucher',
    active: (p, s) => (p.startsWith('/group-buy') && s.includes('category=meal_voucher')) || p.startsWith('/meal-vouchers') },
  { labelKey: 'category.beauty',      labelDefault: '미용',        icon: Sparkles, path: '/group-buy?category=beauty_voucher',
    active: (p, s) => p.startsWith('/group-buy') && s.includes('category=beauty_voucher') },
  { labelKey: 'category.stay',        labelDefault: '숙소',        icon: Bed,      path: '/group-buy?category=stay_voucher',
    active: (p, s) => p.startsWith('/stays') || (p.startsWith('/group-buy') && s.includes('category=stay_voucher')) },
  { labelKey: 'category.etc',         labelDefault: '기타',        icon: Tag,      path: '/group-buy?category=etc_voucher',
    active: (p, s) => p.startsWith('/group-buy') && s.includes('category=etc_voucher') },
  { labelKey: 'category.general',     labelDefault: '일반 상품',   icon: Package,  path: '/group-buy?category=general',
    active: (p, s) => p.startsWith('/group-buy') && s.includes('category=general') },
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
          {/* 🛡️ 2026-06-10 [UNLOCK_LOADING]: 쇼핑(/browse) 잠정 숨김 — SHOPPING_TAB_HIDDEN 플래그 가역 */}
          {MENU_ITEMS.filter(item =>
            !(LIVE_COMMERCE_SUSPENDED && item.path === '/live') &&
            !(SHOPPING_TAB_HIDDEN && item.path === '/browse')
          ).map(item => (
            <NavBtn
              key={item.path}
              item={item}
              isActive={item.active?.(pathname, search) ?? false}
              onClick={() => navigate(item.path)}
            />
          ))}
        </section>

        {/* CATEGORY — 오프라인 공동구매(동네딜) 카테고리: 맛집 식사권 / 미용 / 숙소 / 기타 */}
        <section>
          <p className="hidden xl:block text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest px-3 mb-1">
            {t('nav.sectionCategory', { defaultValue: 'Category' })}
          </p>
          {CATEGORY_ITEMS.map(item => (
            <NavBtn
              key={item.path}
              item={item}
              isActive={item.active?.(pathname, search) ?? false}
              onClick={() => navigate(item.path)}
            />
          ))}
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

      {/* 🗑️ 2026-06-17 (사용자 요청): 앱 다운로드 CTA 제거 */}
    </aside>
  )
}
