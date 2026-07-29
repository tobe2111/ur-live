import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, X, Heart, ShoppingCart } from 'lucide-react'
import { WT } from './wholesale-theme'
import { WholesaleWordmark } from '../wholesale-catalog/WholesaleLogo'
import { useWholesaleCart } from './useWholesaleCart'
import { useWholesaleMall } from '@/hooks/queries/useWholesale'

// 🏭 2026-06-29 (대표 — "도매몰에서 이게 각 페이지마다는 있어야 하지 않을까?"): 도매몰 공통 쇼핑 헤더.
//   로고 + 검색(어디서든 /wholesale?search= 로 이동) + 견적함/관심상품/장바구니. 카탈로그 외 모든
//   도매 app 페이지(WholesaleLayout)에서 상시 노출 → 검색/쇼핑 내비 일관(쇼핑몰 표준).
//   카탈로그 계열(/wholesale·best·new·margin·premium·brands)은 자체 <CatalogHeader/> 에 동일 바 +
//   카테고리 네비가 이미 있어 이 컴포넌트를 쓰지 않는다(이중 헤더 없음). 검색은 현재 페이지에서
//   필터하지 않고 카탈로그로 이동시키므로 비-카탈로그 페이지 어디서나 동작한다.
export default function WholesaleShopBar() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const cart = useWholesaleCart()
  const { displayName: mallName, brandColor: mallBrand, logoUrl: mallLogo } = useWholesaleMall()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/wholesale?search=${encodeURIComponent(q)}` : '/wholesale')
  }

  return (
    <div className="bg-white" style={{ borderBottom: '1px solid ' + WT.line, ['--ud-brand' as string]: mallBrand }}>
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

        {/* 중앙 검색 — 흰 배경 + 2px 잉크 보더 + 다크 버튼 (CatalogHeader 와 동일 시안). 제출 시 카탈로그로 이동. */}
        <form onSubmit={submit} className="flex-1 max-w-2xl flex items-center overflow-hidden rounded-[11px] h-11 lg:h-[46px]" style={{ border: '2px solid ' + WT.ink }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('wholesale.searchPlaceholder', { defaultValue: '상품명·브랜드·카테고리로 검색' })}
            className="flex-1 min-w-0 px-3.5 lg:px-4 text-[14px] lg:text-[14.5px] outline-none bg-transparent" style={{ color: WT.ink }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label={t('common.clear', { defaultValue: '지우기' })} className="px-1" style={{ color: WT.ink4 }}>
              <X className="w-4 h-4" />
            </button>
          )}
          <button type="submit" aria-label={t('common.search', { defaultValue: '검색' })} className="w-[46px] lg:w-[52px] h-full flex items-center justify-center shrink-0" style={{ background: WT.ink }}>
            <Search className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
          </button>
        </form>

        {/* 우측 아이콘 (데스크톱) — 관심상품 / 장바구니 (견적함 제거 — 대표 요청 2026-06-29) */}
        <div className="hidden md:flex items-center gap-5 shrink-0" style={{ color: WT.ink2 }}>
          <button onClick={() => navigate('/wholesale/wishlist')} className="flex flex-col items-center gap-0.5" title={t('wholesale.icon.wish', { defaultValue: '관심상품' })}>
            <Heart className="w-[21px] h-[21px]" style={{ color: WT.ink }} strokeWidth={1.8} />
            <span className="text-[11px] whitespace-nowrap">{t('wholesale.icon.wish', { defaultValue: '관심상품' })}</span>
          </button>
          <button onClick={() => navigate('/wholesale/cart')} className="relative flex flex-col items-center gap-0.5" title={t('wholesale.util.cart', { defaultValue: '장바구니' })}>
            <ShoppingCart className="w-[21px] h-[21px]" style={{ color: WT.ink }} strokeWidth={1.8} />
            {cart.count > 0 && <span className="absolute -top-1.5 right-1 flex h-[17px] min-w-[17px] px-1 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: WT.brand }}>{cart.count}</span>}
            <span className="text-[11px] whitespace-nowrap">{t('wholesale.util.cart', { defaultValue: '장바구니' })}</span>
          </button>
        </div>
        {/* 우측 아이콘 (모바일) */}
        <div className="flex md:hidden items-center gap-2.5 shrink-0" style={{ color: WT.ink }}>
          <button onClick={() => navigate('/wholesale/wishlist')} aria-label={t('wholesale.icon.wish', { defaultValue: '관심상품' })} className="p-1"><Heart className="w-5 h-5" strokeWidth={1.8} /></button>
          <button onClick={() => navigate('/wholesale/cart')} aria-label={t('wholesale.util.cart', { defaultValue: '장바구니' })} className="relative p-1">
            <ShoppingCart className="w-5 h-5" strokeWidth={1.8} />
            {cart.count > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: WT.brand }}>{cart.count}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
