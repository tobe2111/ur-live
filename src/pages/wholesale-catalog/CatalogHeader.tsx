import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, X, LogIn, LogOut, Factory, Heart, ShoppingCart, FileText } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { WT, won, GRADE_NAME } from '../wholesale/wholesale-theme'
import { WholesaleWordmark } from './WholesaleLogo'
import type { CatOpt } from './types'
import type { CatalogSort } from './catalog-controls'

// 🏭 2026-06-15 도매몰 리디자인 (Claude Design 핸드오프 — 유통스타트 도매몰.dc.html).
//   다크 유틸바(회원·예치금·충전) + 셰브론 로고 + 잉크보더 검색 + 견적함/관심상품/장바구니 + 카테고리 네비.
//   상태/핸들러는 부모 소유(props), 라우팅·검색 와이어링·megamenu·멀티몰 로직 보존.
export default function CatalogHeader({
  loggedIn, supplierToken, cartCount, mallName, mallLogo, depositBalance, grade,
  search, setSearch, setCommittedSearch, megaOpen, setMegaOpen,
  setPremiumView, setBrandView, setSelectedBrand,
  cat, setCat, cats, catCounts, goLogin, logout,
}: {
  loggedIn: boolean
  supplierToken: string | null
  token: string | null
  cartCount: number
  mallName: string
  mallLogo?: string | null
  depositBalance: number
  grade?: string
  search: string
  setSearch: (v: string) => void
  setCommittedSearch: (v: string) => void
  megaOpen: boolean
  setMegaOpen: React.Dispatch<React.SetStateAction<boolean>>
  brandView: boolean
  setBrandView: (v: boolean) => void
  premiumView: boolean
  setPremiumView: (v: boolean) => void
  setSelectedBrand: (v: string) => void
  sort: CatalogSort
  setSort: (v: CatalogSort) => void
  cat: string
  setCat: (v: string) => void
  cats: CatOpt[]
  catCounts: Record<string, number>
  setProposalOpen: (v: boolean) => void
  goLogin: () => void
  logout: () => void
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const companyName = (typeof window !== 'undefined' && localStorage.getItem('seller_name')) || '회원'
  const gradeLabel = GRADE_NAME[grade || 'C'] || grade || 'C'
  // 회원 전용 메뉴 — 비로그인은 로그인 유도.
  const memberOnlyGo = (to: string) => {
    if (!loggedIn) { toast.error(t('wholesale.memberOnly', { defaultValue: '회원 전용 메뉴예요 — 로그인 후 이용해주세요' })); goLogin(); return }
    navigate(to)
  }
  // 네비 활성 색 (현재 경로 기준)
  const navColor = (to: string) => (pathname === to ? WT.brand : WT.ink2)

  return (
    <header className="sticky top-0 z-30">
      {/* 1. 다크 유틸 바 (시안) — 제조사 입점/고객센터/공지 · 회원·예치금·충전 */}
      <div style={{ background: WT.ink, color: '#C2C6CC' }}>
        <div className="ur-content-wide px-5 lg:px-8 h-9 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
            {/* 🧹 2026-06-17 (시안): 제조사 입점 삭제 · 순서 공지사항/고객센터/제안·신고 */}
            <button onClick={() => navigate('/wholesale/board')} className="font-semibold text-white whitespace-nowrap">{t('wholesale.util.notice', { defaultValue: '공지사항' })}</button>
            <span className="opacity-30 hidden sm:inline">|</span>
            <button onClick={() => navigate('/wholesale/support')} className="hidden sm:inline whitespace-nowrap">{t('wholesale.util.cs', { defaultValue: '고객센터' })}</button>
            <button onClick={() => navigate('/wholesale/board?tab=report')} className="hidden sm:inline whitespace-nowrap">{t('wholesale.util.report', { defaultValue: '제안·신고' })}</button>
          </div>
          <div className="flex items-center gap-2.5 lg:gap-3.5 shrink-0">
            {loggedIn ? (
              <>
                <span className="hidden md:inline whitespace-nowrap"><b className="text-white">{companyName}</b> 님 · <span className="font-bold" style={{ color: WT.inkPink }}>{gradeLabel} 회원</span></span>
                <span className="opacity-30 hidden md:inline">|</span>
                <span className="whitespace-nowrap">{t('wholesale.icon.deposit', { defaultValue: '예치금' })} <b className="text-white tabular-nums">{won(depositBalance)}</b></span>
                <button onClick={() => navigate('/wholesale/deposits')} className="font-bold text-white rounded-md px-2.5 py-1 whitespace-nowrap" style={{ background: WT.brand }}>{t('wholesale.charge', { defaultValue: '충전' })}</button>
                <span className="opacity-30">|</span>
                {/* 🛡️ 2026-06-19 (대표 신고 — 대시보드 유입경로 없음): '마이'(판매사 대시보드) 모바일에서도 노출
                    (기존 hidden sm:inline → 모바일에서 진입 불가였음). 대시보드 라벨로 명확화. */}
                <button onClick={() => navigate('/wholesale/dashboard')} className="font-semibold whitespace-nowrap">{t('wholesale.util.my', { defaultValue: '대시보드' })}</button>
                <button onClick={logout} className="inline-flex items-center gap-1 whitespace-nowrap"><LogOut className="w-3 h-3" /> {t('wholesale.util.logout', { defaultValue: '로그아웃' })}</button>
              </>
            ) : supplierToken ? (
              <>
                <button onClick={() => navigate('/supplier')} className="font-bold text-white inline-flex items-center gap-1 whitespace-nowrap"><Factory className="w-3.5 h-3.5" /> {t('wholesale.util.supplierDash', { defaultValue: '제조사 대시보드' })}</button>
                <span className="opacity-30">|</span>
                <button onClick={logout} className="inline-flex items-center gap-1 whitespace-nowrap"><LogOut className="w-3 h-3" /> {t('wholesale.util.logout', { defaultValue: '로그아웃' })}</button>
              </>
            ) : (
              <>
                <button onClick={goLogin} className="inline-flex items-center gap-1 whitespace-nowrap"><LogIn className="w-3 h-3" /> {t('wholesale.util.login', { defaultValue: '로그인' })}</button>
                <span className="opacity-30">|</span>
                <button onClick={() => navigate('/wholesale/start')} className="font-bold text-white whitespace-nowrap">{t('wholesale.util.join', { defaultValue: '회원가입' })}</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. 메인 헤더 — 셰브론 로고 + 잉크보더 검색 + 견적함/관심상품/장바구니 */}
      <div className="bg-white" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 py-3 lg:py-3.5 flex items-center gap-3 lg:gap-6">
          <button onClick={() => navigate('/wholesale')} className="shrink-0" aria-label={t('common.home', { defaultValue: '홈' })}>
            {mallLogo ? (
              <div className="flex items-center gap-2.5">
                <img src={mallLogo} alt={mallName} className="h-8 w-8 rounded-lg object-cover" />
                <span className="text-[18px] font-extrabold whitespace-nowrap" style={{ letterSpacing: '-0.055em', color: WT.ink }}>{mallName}</span>
              </div>
            ) : (
              <WholesaleWordmark height={32} />
            )}
          </button>

          {/* 중앙 검색 — 흰 배경 + 2px 잉크 보더 + 다크 버튼 (시안) */}
          <form onSubmit={e => { e.preventDefault(); setCommittedSearch(search.trim()); setPremiumView(false) }}
            className="flex-1 max-w-2xl flex items-center overflow-hidden rounded-[11px] h-11 lg:h-[46px]" style={{ border: '2px solid ' + WT.ink }}>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('wholesale.searchPlaceholder', { defaultValue: '상품명·브랜드·카테고리로 검색' })}
              className="flex-1 min-w-0 px-3.5 lg:px-4 text-[14px] lg:text-[14.5px] outline-none bg-transparent" style={{ color: WT.ink }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCommittedSearch('') }} aria-label={t('common.clear', { defaultValue: '지우기' })} className="px-1" style={{ color: WT.ink4 }}>
                <X className="w-4 h-4" />
              </button>
            )}
            <button type="submit" aria-label={t('common.search', { defaultValue: '검색' })} className="w-[46px] lg:w-[52px] h-full flex items-center justify-center shrink-0" style={{ background: WT.ink }}>
              <Search className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
            </button>
          </form>

          {/* 우측 아이콘 (데스크톱) — 견적함 / 관심상품 / 장바구니 */}
          <div className="hidden md:flex items-center gap-5 shrink-0" style={{ color: WT.ink2 }}>
            <button onClick={() => navigate('/wholesale/quotes')} className="flex flex-col items-center gap-0.5" title={t('wholesale.icon.quotes', { defaultValue: '견적함' })}>
              <FileText className="w-[21px] h-[21px]" style={{ color: WT.ink }} strokeWidth={1.8} />
              <span className="text-[11px] whitespace-nowrap">{t('wholesale.icon.quotes', { defaultValue: '견적함' })}</span>
            </button>
            <button onClick={() => navigate('/wholesale/wishlist')} className="flex flex-col items-center gap-0.5" title={t('wholesale.icon.wish', { defaultValue: '관심상품' })}>
              <Heart className="w-[21px] h-[21px]" style={{ color: WT.ink }} strokeWidth={1.8} />
              <span className="text-[11px] whitespace-nowrap">{t('wholesale.icon.wish', { defaultValue: '관심상품' })}</span>
            </button>
            <button onClick={() => navigate('/wholesale/cart')} className="relative flex flex-col items-center gap-0.5" title={t('wholesale.util.cart', { defaultValue: '장바구니' })}>
              <ShoppingCart className="w-[21px] h-[21px]" style={{ color: WT.ink }} strokeWidth={1.8} />
              {cartCount > 0 && <span className="absolute -top-1.5 right-1 flex h-[17px] min-w-[17px] px-1 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: WT.brand }}>{cartCount}</span>}
              <span className="text-[11px] whitespace-nowrap">{t('wholesale.util.cart', { defaultValue: '장바구니' })}</span>
            </button>
          </div>
          {/* 우측 아이콘 (모바일) */}
          <div className="flex md:hidden items-center gap-2.5 shrink-0" style={{ color: WT.ink }}>
            <button onClick={() => navigate('/wholesale/wishlist')} aria-label={t('wholesale.icon.wish', { defaultValue: '관심상품' })} className="p-1"><Heart className="w-5 h-5" strokeWidth={1.8} /></button>
            <button onClick={() => navigate('/wholesale/cart')} aria-label={t('wholesale.util.cart', { defaultValue: '장바구니' })} className="relative p-1">
              <ShoppingCart className="w-5 h-5" strokeWidth={1.8} />
              {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: WT.brand }}>{cartCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 3. 카테고리 네비 (시안) — ≡ 전체 카테고리 + 브랜드관/월간베스트/신상품/고마진특가/프리미엄 */}
      <div className="bg-white" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center h-[46px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setMegaOpen(v => !v)} aria-expanded={megaOpen}
            className="shrink-0 inline-flex items-center gap-2 font-extrabold text-[13.5px] pr-5 h-full self-center" style={{ color: WT.ink, borderRight: '1px solid ' + WT.line }}>
            <span className="flex flex-col gap-[3px]">
              <span className="w-[15px] h-[2px]" style={{ background: WT.ink }} />
              <span className="w-[15px] h-[2px]" style={{ background: WT.ink }} />
              <span className="w-[15px] h-[2px]" style={{ background: WT.ink }} />
            </span>
            {t('wholesale.nav.allCategories', { defaultValue: '전체 카테고리' })}
          </button>
          <div className="flex items-center gap-5 lg:gap-6 pl-5 text-[13.5px] font-semibold shrink-0">
            {/* 🧹 2026-06-17 (시안): 전체상품 — 카테고리 네비 맨 앞 */}
            <button onClick={() => navigate('/wholesale')} className="whitespace-nowrap font-bold" style={{ color: navColor('/wholesale') }}>{t('wholesale.nav.all', { defaultValue: '전체상품' })}</button>
            <button onClick={() => navigate('/wholesale/brands')} className="whitespace-nowrap font-bold" style={{ color: navColor('/wholesale/brands') }}>{t('wholesale.nav.brands', { defaultValue: '브랜드관' })}</button>
            <button onClick={() => navigate('/wholesale/best')} className="whitespace-nowrap" style={{ color: navColor('/wholesale/best') }}>{t('wholesale.nav.best', { defaultValue: '월간 베스트' })}</button>
            <button onClick={() => navigate('/wholesale/new')} className="whitespace-nowrap" style={{ color: navColor('/wholesale/new') }}>{t('wholesale.nav.new', { defaultValue: '신상품' })}</button>
            <button onClick={() => memberOnlyGo('/wholesale/margin')} className="whitespace-nowrap font-bold" style={{ color: WT.brand }}>{t('wholesale.nav.highMargin', { defaultValue: '고마진 특가' })}</button>
            <button onClick={() => memberOnlyGo('/wholesale/premium')} className="whitespace-nowrap" style={{ color: navColor('/wholesale/premium') }}>{t('wholesale.nav.premium', { defaultValue: '프리미엄 전용관' })}</button>
          </div>
        </div>
        {/* 전체카테고리 메가 드롭다운 — 기존 cats 재활용 */}
        {megaOpen && (
          <div className="ur-content-wide px-5 lg:px-8 pb-4">
            <div className="rounded-2xl p-4" style={{ border: '1px solid ' + WT.line, background: '#fff', boxShadow: WT.shCard }}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {cats.map((c) => (
                  <button key={c.id} onClick={() => { setCat(c.id); setPremiumView(false); setBrandView(false); setSelectedBrand(''); setMegaOpen(false) }}
                    className="flex items-center justify-between rounded-xl px-3.5 h-10 text-[14px] transition-colors"
                    style={cat === c.id ? { background: WT.brandSoft, color: WT.brand, fontWeight: 700 } : { background: WT.fill, color: WT.ink2 }}>
                    <span className="truncate">{c.label}</span>
                    <span className="text-[12px] tabular-nums shrink-0 ml-1" style={{ color: WT.ink4 }}>{catCounts[c.id] ?? ''}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
