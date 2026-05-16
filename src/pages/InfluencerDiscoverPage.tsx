/**
 * 🛡️ 2026-05-16: 인플루언서 카탈로그 페이지 — 활성 공구 둘러보고 ?ref= 링크 생성.
 *
 * 매장과 직접 협상 X — 카탈로그 모델 (마찰 0). 매장은 referral_disabled 또는
 * marketing_enabled=0 으로 referral 거부 가능.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { Link2, Copy, Share2, Search } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
  original_price: number | null
  image_url: string | null
  category: string
  restaurant_name: string | null
  seller_name: string | null
  group_buy_target: number
  group_buy_current: number
  group_buy_deadline: string | null
}

const CAT_LABELS: Record<string, string> = {
  all: '전체',
  meal_voucher: '식사',
  beauty_voucher: '뷰티',
  health_voucher: '헬스',
  pet_voucher: '반려',
  stay_voucher: '숙박',
  activity_voucher: '액티비티',
}

function getUserId(): string | null {
  // 일반 user 토큰에서 user id 추출 — useAuthKR 또는 localStorage 등에서
  try {
    const raw = localStorage.getItem('user_id') || localStorage.getItem('userId')
    return raw || null
  } catch { return null }
}

export default function InfluencerDiscoverPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('all')
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'deadline'>('latest')

  const myId = getUserId() || 'me'

  useEffect(() => {
    setLoading(true)
    api.get('/api/influencer-discover/products', { params: { category: cat } })
      .then((r) => { if (r.data?.success) setProducts(r.data.data || []) })
      .catch(() => toast.error('카탈로그 로드 실패'))
      .finally(() => setLoading(false))
  }, [cat])

  function genRefLink(productId: number): string {
    return `https://live.ur-team.com/group-buy/${productId}?ref=${encodeURIComponent(myId)}`
  }

  async function copyLink(productId: number) {
    const url = genRefLink(productId)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('내 추천 링크 복사됨')
    } catch { toast.error('복사 실패') }
  }

  async function shareLink(product: Product) {
    const url = genRefLink(product.id)
    const shareData = {
      title: `${product.restaurant_name ? product.restaurant_name + ' · ' : ''}${product.name}`,
      text: `${product.restaurant_name || ''} ${product.name} 공동구매 — 친구 추천 시 양쪽 보너스`,
      url,
    }
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav && 'share' in nav) {
      try { await (nav as Navigator).share(shareData); return } catch { /* cancelled */ }
    }
    copyLink(product.id)
  }

  const filtered = products
    .filter(p =>
      !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || (p.restaurant_name || '').toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'popular') return b.group_buy_current - a.group_buy_current
      if (sortBy === 'deadline') {
        const ad = a.group_buy_deadline ? new Date(a.group_buy_deadline).getTime() : Infinity
        const bd = b.group_buy_deadline ? new Date(b.group_buy_deadline).getTime() : Infinity
        return ad - bd
      }
      return 0  // latest = 서버 ORDER BY created_at DESC 기본
    })

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="추천 공구 카탈로그 - 유어딜" description="원하는 공구를 골라 본인 SNS 에 추천 링크 공유. commission 자동 정산." url="/influencer/discover" />
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-pink-500" />
        <h1 className="text-base font-bold text-gray-900 flex-1">추천 공구 카탈로그</h1>
        <button onClick={() => navigate('/influencer/settlement')} className="text-xs text-pink-600 font-bold">내 정산 →</button>
      </header>

      <main className="ur-content-wide mx-auto px-4 py-4 space-y-4">
        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(CAT_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${cat === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* 검색 + 정렬 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="공구명/매장명 검색"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular' | 'deadline')}
            className="px-3 py-2 border border-gray-200 rounded-full text-xs text-gray-900 font-medium bg-white"
          >
            <option value="latest">최신순</option>
            <option value="popular">인기순</option>
            <option value="deadline">마감임박순</option>
          </select>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-10">로딩 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-10">해당 카테고리에 활성 공구가 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(p => {
              const progress = p.group_buy_target > 0 ? Math.min(100, (p.group_buy_current / p.group_buy_target) * 100) : 0
              return (
                <li key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex gap-3 p-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-20 h-20 object-cover rounded-lg shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 truncate">{p.restaurant_name || p.seller_name || '-'}</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                      <p className="text-sm font-extrabold text-pink-600 mt-0.5">{p.price.toLocaleString()}원</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{p.group_buy_current}/{p.group_buy_target}명</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                    <button onClick={() => copyLink(p.id)}
                      className="py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 flex items-center justify-center gap-1">
                      <Copy className="w-3 h-3" /> 링크 복사
                    </button>
                    <button onClick={() => shareLink(p)}
                      className="py-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                      <Share2 className="w-3 h-3" /> SNS 공유
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-[11px] text-gray-500 text-center pt-2">
          내 링크를 본 누군가가 공구 참여하면 자동 commission 적립 → 어드민이 매월 송금.<br />
          매장이 인플 거부한 경우 (드물게) commission 0, 사용자 보너스는 유어딜이 보장.
        </p>
      </main>
    </div>
  )
}
