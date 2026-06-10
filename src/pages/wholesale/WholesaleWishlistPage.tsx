/**
 * 🏭 2026-06-10 (사용자 요청): 도매몰 찜리스트 — /wholesale/wishlist (유통회원 전용).
 *   카탈로그 카드 ♥ 토글 → 여기서 모아보고 상품으로 이동. 라이트 고정(WT).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Heart, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { cfImage } from '@/utils/cf-image'
import { WT } from './wholesale-theme'

interface WishItem {
  product_id: number
  created_at: string
  name: string | null
  image_url: string | null
  category: string | null
  brand_name: string | null
  is_active: number | null
}

const sellerToken = () => (typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null)
const auth = () => { const t = sellerToken(); return { headers: t ? { Authorization: `Bearer ${t}` } : {} } }

export default function WholesaleWishlistPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WishItem[] | null>(null)
  const loggedIn = !!sellerToken()

  useEffect(() => {
    if (!loggedIn) return
    api.get('/api/wholesale/wishlist', auth())
      .then(r => setItems(r.data?.success ? r.data.items || [] : []))
      .catch(() => setItems([]))
  }, [loggedIn])

  async function remove(productId: number) {
    setItems(prev => (prev || []).filter(i => i.product_id !== productId))
    try { await api.post(`/api/wholesale/wishlist/${productId}/toggle`, {}, auth()) }
    catch { toast.error('해제 실패 — 새로고침 후 다시 시도해주세요') }
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: WT.fill }}>
      <SEO title="찜리스트 - 유통스타트" description="찜한 도매 상품" url="/wholesale/wishlist" noindex />
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center h-14">
          <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="p-1.5 -ml-1.5">
            <ChevronLeft className="w-5 h-5" style={{ color: WT.ink }} />
          </button>
          <h1 className="ml-1 text-[16px] font-extrabold inline-flex items-center gap-1.5" style={{ color: WT.ink }}>
            <Heart className="w-4 h-4" style={{ color: WT.brand }} /> 찜리스트
          </h1>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 pt-5">
        {!loggedIn ? (
          <div className="rounded-2xl py-16 text-center" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
            <p className="text-[14px] font-bold" style={{ color: WT.ink }}>찜리스트는 유통회원 전용이에요</p>
            <button onClick={() => navigate('/wholesale/login')}
              className="mt-4 px-6 h-11 rounded-xl text-[14px] font-bold text-white" style={{ background: WT.brand }}>
              로그인하기
            </button>
          </div>
        ) : items === null ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl animate-pulse" style={{ background: '#fff' }} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
            <p className="text-[14px]" style={{ color: WT.ink4 }}>아직 찜한 상품이 없어요</p>
            <button onClick={() => navigate('/wholesale')}
              className="mt-4 px-6 h-11 rounded-xl text-[14px] font-bold" style={{ background: WT.fill, color: WT.ink }}>
              상품 둘러보기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map(it => (
              <div key={it.product_id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
                <button onClick={() => navigate(`/wholesale/product/${it.product_id}`)} className="block w-full text-left">
                  <div className="aspect-square" style={{ background: WT.fill }}>
                    {it.image_url && <img src={cfImage(it.image_url, { width: 300, format: 'auto' }) || it.image_url} alt={it.name || ''} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                  </div>
                  <div className="px-3 pt-2 pb-1">
                    {it.brand_name && <p className="text-[11px] font-bold" style={{ color: WT.ink3 }}>{it.brand_name}</p>}
                    <p className="text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: WT.ink }}>{it.name || `상품 #${it.product_id}`}</p>
                    {it.is_active === 0 && <p className="text-[11px] font-bold mt-0.5" style={{ color: WT.brand }}>판매 중지</p>}
                  </div>
                </button>
                <button onClick={() => remove(it.product_id)}
                  className="w-full h-9 flex items-center justify-center gap-1 text-[12px] font-bold" style={{ color: WT.ink3, background: WT.fill2 }}>
                  <Trash2 className="w-3.5 h-3.5" /> 찜 해제
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
