import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { Package, Search, Loader2, Tag, ShoppingCart, Receipt, ClipboardList, Sparkles } from 'lucide-react'
import { formatWon } from '@/utils/format'
import { useWholesaleCatalog, useWholesaleMe, useWholesaleProposals } from '@/hooks/queries/useWholesale'

// 🏭 2026-06-01 유통스타트 도매몰 — 유통사 카탈로그 (Phase 2). 등급가만 노출, 제조사 신원 비노출.

interface CatalogItem {
  id: number
  name: string
  description: string | null
  image_url: string | null
  category: string | null
  stock: number
  distributor_price: number
}
interface MeInfo {
  grade: string
  assigned_grade: string | null
  margin_pct: number
  special_active: boolean
  special_discount_until: string | null
}

const GRADE_LABEL: Record<string, string> = {
  A: 'A등급', B: 'B등급', C: 'C등급', D: 'D등급', OEM: 'OEM', SPECIAL: '특별할인',
}

export default function WholesaleCatalogPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')

  // 🛡️ 2026-06-01 Tier2: 수동 3-fetch → React Query 훅 3종. 검색은 form submit 시 commit.
  const catalogQ = useWholesaleCatalog(committedSearch)
  const meQ = useWholesaleMe()
  const proposalsQ = useWholesaleProposals()
  const items = (catalogQ.data ?? []) as unknown as CatalogItem[]
  const me = (meQ.data ?? null) as MeInfo | null
  const proposals = (proposalsQ.data ?? []) as unknown as CatalogItem[]
  const loading = catalogQ.isLoading
  const authErr = !token || catalogQ.isError || meQ.isError
  const loadCatalog = (q: string) => setCommittedSearch(q)

  if (authErr) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
        <SEO title="유통스타트 도매몰" description="유통사 전용 도매 카탈로그" url="/wholesale" />
        <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">유통스타트 도매몰</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">유통사 로그인 후 도매 카탈로그를 이용할 수 있습니다.</p>
        <button onClick={() => navigate('/seller/login')} className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold">
          유통사 로그인
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      <SEO title="유통스타트 도매몰" description="유통사 전용 도매 카탈로그 — 등급별 공급가" url="/wholesale" />
      {/* 헤더 */}
      <header className="bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-[#2A2A2A]">
        <div className="ur-content-wide px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-gray-900 dark:text-white" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">유통스타트</span>
            <span className="text-sm text-gray-400 dark:text-gray-500">도매몰</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => navigate('/wholesale/orders')} className="hidden sm:inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              <ClipboardList className="w-4 h-4" /> 주문내역
            </button>
            <button onClick={() => navigate('/wholesale/statement')} className="hidden sm:inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              <Receipt className="w-4 h-4" /> 거래내역서
            </button>
            {me && (
              <>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${me.special_active ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-gray-100 text-gray-700 dark:bg-[#1A1A1A] dark:text-gray-200'}`}>
                  <Tag className="w-3.5 h-3.5" /> {GRADE_LABEL[me.grade] || me.grade}
                </span>
                <span className="text-gray-400 dark:text-gray-500">마진 {me.margin_pct}%</span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="ur-content-wide px-4 lg:px-8 py-6">
        {proposals.length > 0 && (
          <section className="mb-6">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" /> 추천 상품 제안
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {proposals.map(p => (
                <button key={p.id} onClick={() => navigate(`/wholesale/product/${p.id}`)} className="flex-shrink-0 w-40 text-left bg-white dark:bg-[#121212] rounded-xl border border-amber-200 dark:border-amber-500/20 overflow-hidden">
                  <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A]">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">{p.name}</h3>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{formatWon(p.distributor_price)}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        {me?.special_active && me.special_discount_until && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm">
            🔥 특별할인 적용 중 — {new Date(me.special_discount_until).toLocaleDateString('ko-KR')}까지 최저 공급가
          </div>
        )}

        {/* 검색 */}
        <form onSubmit={e => { e.preventDefault(); loadCatalog(search) }} className="flex gap-2 mb-6">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="상품 검색"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] text-gray-900 dark:text-white"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold">검색</button>
        </form>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 py-20">도매 상품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/wholesale/product/${p.id}`)}
                className="text-left bg-white dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A]">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">{p.name}</h3>
                  <div className="text-base font-bold text-gray-900 dark:text-white">{formatWon(p.distributor_price)}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">재고 {p.stock?.toLocaleString('ko-KR') ?? 0}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><ShoppingCart className="w-3.5 h-3.5" />주문</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
