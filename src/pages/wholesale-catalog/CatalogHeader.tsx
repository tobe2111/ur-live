import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Factory, X, LogIn, LogOut, Menu, HelpCircle, MessageSquareWarning, Wallet, Crown, Heart, ShoppingCart, Megaphone } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { WT, won } from '../wholesale/wholesale-theme'
import type { CatOpt } from './types'
import type { CatalogSort } from './catalog-controls'

// 🧹 2026-06-15 (사용자 요청 — 홈 정리): 유틸 링크(마이/장바구니/제조사/로그인/로그아웃) 추출.
//   데스크톱은 별도 유틸바 줄을 없애고 카테고리 네비 우측 빈 공간으로(3단→2단), 모바일은 기존 유틸바 유지.
//   양쪽에서 같은 컴포넌트를 렌더 — 코드 중복 없이 위치만 분기(lg:hidden ↔ hidden lg:flex).
function UtilLinks({ loggedIn, supplierToken, cartCount, goLogin, logout }: {
  loggedIn: boolean
  supplierToken: string | null
  cartCount: number
  goLogin: () => void
  logout: () => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const Dot = () => <span style={{ color: WT.line }}>·</span>
  if (loggedIn) {
    return (
      <>
        <button onClick={() => navigate('/wholesale/dashboard')} className="inline-flex items-center gap-1 font-medium" style={{ color: WT.ink2 }}>{t('wholesale.util.my', { defaultValue: '마이' })}</button>
        <Dot />
        <button onClick={() => navigate('/wholesale/cart')} className="inline-flex items-center gap-1 font-medium" style={{ color: WT.ink2 }}>
          {t('wholesale.util.cart', { defaultValue: '장바구니' })}{cartCount > 0 ? ` (${cartCount})` : ''}
        </button>
        {supplierToken && (
          <>
            <Dot />
            <button onClick={() => navigate('/supplier')} className="hidden sm:inline-flex items-center gap-1 font-medium" style={{ color: WT.ink2 }} title="제조사 대시보드로 이동"><Factory className="w-3.5 h-3.5" /> 제조사</button>
          </>
        )}
        <Dot />
        <button onClick={logout} className="inline-flex items-center gap-1 font-medium" style={{ color: WT.ink3 }}><LogOut className="w-3.5 h-3.5" /> {t('wholesale.util.logout', { defaultValue: '로그아웃' })}</button>
      </>
    )
  }
  if (supplierToken) {
    return (
      <>
        <button onClick={() => navigate('/supplier')} className="inline-flex items-center gap-1 font-bold" style={{ color: WT.ink }} title="제조사 대시보드로 이동"><Factory className="w-3.5 h-3.5" /> 제조사 대시보드</button>
        <Dot />
        <button onClick={logout} className="inline-flex items-center gap-1 font-medium" style={{ color: WT.ink3 }}><LogOut className="w-3.5 h-3.5" /> {t('wholesale.util.logout', { defaultValue: '로그아웃' })}</button>
      </>
    )
  }
  return (
    <>
      <button onClick={() => navigate('/supplier/login')} className="hidden sm:inline-flex items-center gap-1 font-medium" style={{ color: WT.ink2 }} title="제조(브랜드)회원(공급사) 로그인"><Factory className="w-3.5 h-3.5" /> 제조회원</button>
      <span className="hidden sm:inline" style={{ color: WT.line }}>·</span>
      <button onClick={goLogin} className="inline-flex items-center gap-1 font-medium" style={{ color: WT.ink2 }}><LogIn className="w-3.5 h-3.5" /> {t('wholesale.util.login', { defaultValue: '로그인' })}</button>
      <Dot />
      {/* 🚪 2026-06-12 (사용자 결정): 가입은 역할 선택 관문(/wholesale/start) 경유 — 제조사의 유통 폼 오진입 차단. */}
      <button onClick={() => navigate('/wholesale/start')} className="inline-flex items-center font-bold" style={{ color: WT.brand }}>{t('wholesale.util.join', { defaultValue: '회원가입' })}</button>
      <Dot />
      <button onClick={() => navigate('/wholesale/cart')} className="inline-flex items-center gap-1 font-medium" style={{ color: WT.ink2 }}>
        {t('wholesale.util.cart', { defaultValue: '장바구니' })}{cartCount > 0 ? ` (${cartCount})` : ''}
      </button>
    </>
  )
}

// 🏭 Wave 2 헤더 — Sellpie형: 유틸바 + (로고·중앙검색·3아이콘) + 카테고리 네비.
//   WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0) — 상태/핸들러는 부모 소유, props 로 전달.
export default function CatalogHeader({
  loggedIn, supplierToken, token, cartCount, mallName, mallLogo, depositBalance,
  search, setSearch, setCommittedSearch, megaOpen, setMegaOpen,
  brandView, setBrandView, premiumView, setPremiumView, setSelectedBrand,
  sort, setSort, cat, setCat, cats, catCounts, setProposalOpen, goLogin, logout,
}: {
  loggedIn: boolean
  supplierToken: string | null
  token: string | null
  cartCount: number
  mallName: string
  mallLogo?: string | null
  depositBalance: number
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
  // 🏬 2026-06-14: 컬렉션 네비 = 전용 페이지 라우트. 활성 강조는 현재 경로로.
  const memberOnlyGo = (to: string) => {
    if (!token) { toast.error(t('wholesale.memberOnly', { defaultValue: '회원 전용 메뉴예요 — 로그인 후 이용해주세요' })); goLogin(); return }
    navigate(to)
  }
  return (
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        {/* 1. 유틸 바 (모바일 전용 — 데스크톱은 카테고리 네비 우측으로 이동해 3단→2단 슬림화) */}
        <div className="lg:hidden" style={{ borderBottom: '1px solid ' + WT.line }}>
          <div className="ur-content-wide px-5 lg:px-8 h-8 flex items-center justify-end gap-3 text-[12px]" style={{ color: WT.ink3 }}>
            <UtilLinks loggedIn={loggedIn} supplierToken={supplierToken} cartCount={cartCount} goLogin={goLogin} logout={logout} />
          </div>
        </div>

        {/* 2. 메인 헤더 — 로고 + 중앙 큰 검색 + 우측 3아이콘 */}
        <div className="ur-content-wide px-5 lg:px-8 py-3 flex items-center gap-3 lg:gap-6">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2 shrink-0">
            {/* 🏬 로고 있으면 로고, 없으면 브랜드 색 박스 + 몰 이름 첫 글자(기본 몰 → '유') */}
            {mallLogo ? (
              <img src={mallLogo} alt={mallName} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-extrabold text-[14px]" style={{ background: 'var(--ud-brand, #FF0033)' }}>{(mallName || '유통스타트').slice(0, 1)}</span>
            )}
            <div className="leading-tight text-left">
              <div className="text-[16px] font-extrabold" style={{ color: WT.ink }}>{mallName}</div>
              <div className="text-[10px] -mt-0.5" style={{ color: WT.ink4 }}>도매몰</div>
            </div>
          </button>

          {/* 중앙 큰 검색바 (기존 검색 와이어링) */}
          <form onSubmit={e => { e.preventDefault(); setCommittedSearch(search.trim()); setPremiumView(false) }} className="flex-1 max-w-2xl relative">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('wholesale.searchPlaceholder', { defaultValue: '상품명·브랜드로 검색' })}
              className="w-full pl-4 pr-24 h-11 lg:h-12 rounded-full text-[14px] outline-none"
              style={{ background: WT.fill, color: WT.ink, border: '1.5px solid var(--ud-brand, #FF0033)' }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCommittedSearch('') }} aria-label={t('common.clear', { defaultValue: '지우기' })}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-0.5 rounded-full" style={{ color: WT.ink4 }}>
                <X className="w-4 h-4" />
              </button>
            )}
            <button type="submit" aria-label={t('common.search', { defaultValue: '검색' })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 lg:h-9 px-4 rounded-full inline-flex items-center justify-center text-white" style={{ background: 'var(--ud-brand, #FF0033)' }}>
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* 우측 3 아이콘 — 처음이세요? / 제안·신고 / 예치금신청 */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            <button onClick={() => navigate('/wholesale/intro')} className="flex flex-col items-center gap-0.5 px-2.5 py-1" style={{ color: WT.ink2 }} title="처음이세요?">
              <HelpCircle className="w-5 h-5" />
              <span className="text-[11px] font-medium whitespace-nowrap">{t('wholesale.icon.firstTime', { defaultValue: '처음이세요?' })}</span>
            </button>
            <button onClick={() => navigate('/wholesale/board?tab=report')} className="flex flex-col items-center gap-0.5 px-2.5 py-1" style={{ color: WT.ink2 }} title="제안/신고">
              <MessageSquareWarning className="w-5 h-5" />
              <span className="text-[11px] font-medium whitespace-nowrap">{t('wholesale.icon.proposal', { defaultValue: '제안/신고' })}</span>
            </button>
            <button onClick={() => navigate('/wholesale/deposits')} className="flex flex-col items-center gap-0.5 px-2.5 py-1 relative" style={{ color: WT.ink2 }} title="예치금신청">
              <Wallet className="w-5 h-5" />
              <span className="text-[11px] font-medium whitespace-nowrap">
                {loggedIn ? won(depositBalance) : t('wholesale.icon.deposit', { defaultValue: '예치금' })}
              </span>
            </button>
          </div>
          {/* 모바일 우측 아이콘 (라벨 생략) */}
          <div className="flex md:hidden items-center gap-2 shrink-0" style={{ color: WT.ink2 }}>
            <button onClick={() => navigate('/wholesale/board?tab=report')} aria-label="제안/신고" className="p-1.5"><MessageSquareWarning className="w-5 h-5" /></button>
            <button onClick={() => navigate('/wholesale/deposits')} aria-label="예치금신청" className="p-1.5"><Wallet className="w-5 h-5" /></button>
            <button onClick={() => navigate('/wholesale/wishlist')} aria-label="찜리스트" className="p-1.5"><Heart className="w-5 h-5" /></button>
            <button onClick={() => navigate('/wholesale/cart')} aria-label="장바구니" className="relative p-1.5">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && <span className="absolute top-0 right-0 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: WT.brand }}>{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* 3. 카테고리 네비 바 (가로 풀바) — 기존 cat/sort 필터 재활용 (재스킨) */}
        <div style={{ borderTop: '1px solid ' + WT.line }}>
          <div className="ur-content-wide px-5 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* ≡ 전체카테고리 (레드 박스 → 메가메뉴) */}
            <button onClick={() => setMegaOpen(v => !v)} aria-expanded={megaOpen}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 h-11 text-[14px] font-bold text-white"
              style={{ background: 'var(--ud-brand, #FF0033)' }}>
              <Menu className="w-4 h-4" /> {t('wholesale.nav.allCategories', { defaultValue: '전체카테고리' })}
            </button>
            {/* 🏬 2026-06-14 (사용자 요청): 컬렉션 전용 페이지로 분리 — 각자 라우트로 이동. */}
            <button onClick={() => navigate('/wholesale/brands')}
              className="shrink-0 px-4 h-11 text-[14px] font-semibold whitespace-nowrap" style={{ color: pathname === '/wholesale/brands' ? WT.brand : WT.ink2 }}>
              {t('wholesale.nav.brands', { defaultValue: '브랜드 전시관' })}
            </button>
            <button onClick={() => navigate('/wholesale/best')}
              className="shrink-0 px-4 h-11 text-[14px] font-semibold whitespace-nowrap" style={{ color: pathname === '/wholesale/best' ? WT.brand : WT.ink2 }}>
              {t('wholesale.nav.best', { defaultValue: '월간 베스트' })}
            </button>
            <button onClick={() => navigate('/wholesale/new')}
              className="shrink-0 px-4 h-11 text-[14px] font-semibold whitespace-nowrap" style={{ color: pathname === '/wholesale/new' ? WT.brand : WT.ink2 }}>
              {t('wholesale.nav.new', { defaultValue: '신상품' })}
            </button>
            {/* 판매마진 → 회원 전용(비로그인 로그인 유도). */}
            <button onClick={() => memberOnlyGo('/wholesale/margin')}
              className="shrink-0 px-4 h-11 text-[14px] font-semibold whitespace-nowrap" style={{ color: pathname === '/wholesale/margin' ? WT.brand : WT.ink2 }}>
              {t('wholesale.nav.highMargin', { defaultValue: '판매마진 40%' })}
            </button>
            {/* 프리미엄 전용관 → 회원 전용. 서버 guest 차단(이중 게이트) 유지. */}
            <button onClick={() => memberOnlyGo('/wholesale/premium')}
              className="shrink-0 inline-flex items-center gap-1 px-4 h-11 text-[14px] font-bold whitespace-nowrap"
              style={{ color: pathname === '/wholesale/premium' ? WT.brand : WT.ink }}>
              <Crown className="w-4 h-4" /> {t('wholesale.nav.premium', { defaultValue: '프리미엄 전용관' })}
            </button>
            {/* 🏭 2026-06-10: 통합 게시판 (공지/자료실/배송안내/신고·제안) */}
            <button onClick={() => navigate('/wholesale/board')}
              className="shrink-0 inline-flex items-center gap-1 px-4 h-11 text-[14px] font-semibold whitespace-nowrap"
              style={{ color: WT.ink2 }}>
              <Megaphone className="w-4 h-4" /> {t('wholesale.nav.board', { defaultValue: '공지·자료실' })}
            </button>
            </div>
            {/* 데스크톱 유틸 링크 — 별도 유틸바 줄을 없애고 네비 우측 빈 공간으로(3단→2단 슬림화). */}
            <div className="hidden lg:flex items-center gap-3 shrink-0 text-[12px]" style={{ color: WT.ink3 }}>
              <UtilLinks loggedIn={loggedIn} supplierToken={supplierToken} cartCount={cartCount} goLogin={goLogin} logout={logout} />
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
                      style={cat === c.id && !premiumView ? { background: WT.brandSoft, color: WT.brand, fontWeight: 700 } : { background: WT.fill, color: WT.ink2 }}>
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
