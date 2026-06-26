/**
 * 🏭 2026-06-10 (사용자 요청): 도매몰 찜리스트 — /wholesale/wishlist (유통회원 전용).
 *   카탈로그 카드 ♥ 토글 → 여기서 모아보고 상품으로 이동. 라이트 고정(WT).
 * 🎨 2026-06-16 (서브페이지 시안): 로고 브레드크럼 헤더 + 제목/필터 칩 + 권장가·공급가·장바구니 카드.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Heart, ShoppingCart, Lock } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { cfImage } from '@/utils/cf-image'
import { WT, won, marginRate } from './wholesale-theme'
import { WholesaleWordmark } from '@/pages/wholesale-catalog/WholesaleLogo'
import { useWholesaleCart } from './useWholesaleCart'

interface WishItem {
  product_id: number
  created_at: string
  name: string | null
  image_url: string | null
  category: string | null
  brand_name: string | null
  retail_price: number | null
  distributor_price: number | null
  is_active: number | null
  stock: number | null
}

type Filter = 'all' | 'available' | 'sold'

const sellerToken = () => (typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null)
const auth = () => { const t = sellerToken(); return { headers: t ? { Authorization: `Bearer ${t}` } : {} } }

export default function WholesaleWishlistPage() {
  const navigate = useNavigate()
  const cart = useWholesaleCart()
  const [items, setItems] = useState<WishItem[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const loggedIn = !!sellerToken()

  useEffect(() => {
    if (!loggedIn) return
    api.get('/api/wholesale/wishlist', auth())
      .then(r => setItems(r.data?.success ? r.data.items || [] : []))
      .catch(() => setItems([]))
  }, [loggedIn])

  async function remove(productId: number) {
    const snapshot = items // 🛡️ 2026-06-25: optimistic 실패 시 복원 — 옛 코드는 rollback 없어 잘못된 상태 고착.
    setItems(prev => (prev || []).filter(i => i.product_id !== productId))
    try { await api.post(`/api/wholesale/wishlist/${productId}/toggle`, {}, auth()) }
    catch { setItems(snapshot); toast.error('해제 실패 — 다시 시도해주세요') }
  }

  function isAvailable(it: WishItem) { return it.is_active !== 0 && (it.stock ?? 0) > 0 }

  function addToCart(it: WishItem) {
    if (it.distributor_price == null) { navigate(`/wholesale/product/${it.product_id}`); return }
    cart.add({ id: it.product_id, qty: 1, name: it.name || `상품 #${it.product_id}`, image_url: it.image_url, price: it.distributor_price })
    toast.success('장바구니에 담았어요')
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'available', label: '판매중' },
    { id: 'sold', label: '품절·중지' },
  ]

  const filtered = useMemo(() => {
    if (!items) return []
    if (filter === 'available') return items.filter(isAvailable)
    if (filter === 'sold') return items.filter(it => !isAvailable(it))
    return items
  }, [items, filter])

  return (
    <div className="min-h-[100dvh] pb-24" style={{ background: WT.fill }}>
      <SEO title="관심상품 - 유통스타트" description="찜한 도매 상품을 모아보고 재입고·가격변동을 확인하세요" url="/wholesale/wishlist" noindex />

      {/* 로고 브레드크럼 헤더 */}
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center gap-3 h-14">
          <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="shrink-0">
            <WholesaleWordmark height={26} />
          </button>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: WT.ink4 }} />
          <span className="text-[14px] font-bold" style={{ color: WT.ink }}>관심상품</span>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 pt-6">
        {/* 제목 + 필터 칩 */}
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-[22px] lg:text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: WT.ink }}>관심상품</h1>
            <p className="text-[13px] mt-1" style={{ color: WT.ink3 }}>재입고·가격변동을 확인하고 바로 사입하세요</p>
          </div>
          {!!items?.length && (
            <div className="flex gap-1.5">
              {FILTERS.map(f => {
                const on = filter === f.id
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    className="text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 transition-colors"
                    style={on ? { background: WT.ink, color: '#fff' } : { background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line2 }}>
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {!loggedIn ? (
          <div className="rounded-2xl py-16 text-center" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full mb-3" style={{ background: WT.brandSoft }}>
              <Lock className="w-5 h-5" style={{ color: WT.brand }} />
            </span>
            <p className="text-[14px] font-bold" style={{ color: WT.ink }}>관심상품은 판매사 전용이에요</p>
            <button onClick={() => navigate('/wholesale/login')}
              className="mt-4 px-6 h-11 rounded-xl text-[14px] font-bold text-white" style={{ background: WT.brand }}>
              로그인하기
            </button>
          </div>
        ) : items === null ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl animate-pulse" style={{ background: '#fff', border: '1px solid ' + WT.line }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
            <Heart className="w-7 h-7 mx-auto mb-3" style={{ color: WT.ink4 }} />
            <p className="text-[14px]" style={{ color: WT.ink3 }}>{filter === 'all' ? '아직 찜한 상품이 없어요' : '해당 상품이 없어요'}</p>
            {filter === 'all' && (
              <button onClick={() => navigate('/wholesale')}
                className="mt-4 px-6 h-11 rounded-xl text-[14px] font-bold text-white" style={{ background: WT.brand }}>
                상품 둘러보기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map(it => {
              const avail = isAvailable(it)
              const mr = it.retail_price && it.distributor_price != null ? marginRate(it.distributor_price, it.retail_price) : 0
              return (
                <div key={it.product_id} className="flex flex-col rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
                  <div className="relative aspect-square" style={{ background: WT.fill }}>
                    <button onClick={() => navigate(`/wholesale/product/${it.product_id}`)} className="block w-full h-full">
                      {it.image_url && <img src={cfImage(it.image_url, { width: 360, format: 'auto' }) || it.image_url} alt={it.name || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    </button>
                    {/* 찜 해제 — 우상단 채워진 하트 */}
                    <button onClick={() => remove(it.product_id)} aria-label="찜 해제"
                      className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                      style={{ background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.16)' }}>
                      <Heart className="w-4 h-4" style={{ color: WT.brand, fill: WT.brand }} />
                    </button>
                    {!avail && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-[3px] text-[11px] font-bold leading-none rounded-md text-white" style={{ background: 'rgba(21,23,28,0.82)' }}>
                        {it.is_active === 0 ? '판매중지' : '품절'}
                      </span>
                    )}
                  </div>
                  <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5 flex-1">
                    {it.brand_name && <p className="text-[11px] font-bold" style={{ color: WT.ink3 }}>{it.brand_name}</p>}
                    <button onClick={() => navigate(`/wholesale/product/${it.product_id}`)} className="text-left text-[13px] leading-[1.4] line-clamp-2 min-h-[37px]" style={{ color: WT.ink }}>
                      {it.name || `상품 #${it.product_id}`}
                    </button>
                    {it.retail_price ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11.5px] line-through tabular-nums" style={{ color: WT.ink4 }}>{won(it.retail_price)}</span>
                        <span className="text-[10px]" style={{ color: WT.ink4 }}>권장가</span>
                      </div>
                    ) : null}
                    {it.distributor_price != null ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10.5px]" style={{ color: WT.ink3 }}>공급가</span>
                        <span className="text-[18px] font-extrabold tabular-nums tracking-[-0.02em]" style={{ color: WT.ink }}>{won(it.distributor_price)}</span>
                      </div>
                    ) : null}
                    {mr > 0 && <span className="self-start text-[10.5px] font-bold rounded-[5px] px-1.5 py-0.5" style={{ background: WT.brandSoft, color: WT.brand }}>마진 +{mr}%</span>}
                    <button onClick={() => addToCart(it)} disabled={!avail}
                      className="mt-auto pt-1 flex items-center justify-center gap-1.5 h-9 rounded-[9px] text-[12.5px] font-bold transition-colors disabled:opacity-50"
                      style={{ border: '1px solid ' + WT.line2, color: WT.ink, background: '#fff' }}>
                      <ShoppingCart className="w-3.5 h-3.5" /> {it.distributor_price != null ? '장바구니 담기' : '상세 보기'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
