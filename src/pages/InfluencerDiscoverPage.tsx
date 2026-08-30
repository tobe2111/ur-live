/**
 * 🛡️ 2026-05-16: 인플루언서 카탈로그 페이지 — 활성 공구 둘러보고 ?ref= 링크 생성.
 *
 * 🚨 2026-08-27 정정 — **"카탈로그 모델(마찰 0)"은 폐기됐다.**
 *   이 페이지는 어필리에이트(누구나 공유 2%) 시절에 만들어져 *아무 상품이나* 링크를 뽑아 줬고,
 *   화면은 "자동 commission 적립 · 거부당한 경우 (드물게) 0" 이라고 안내했다. 그런데
 *   어필리에이트는 **2026-08-22 종료**(대표 "심플하게")됐고, 지금 보상이 붙는 건
 *   **매장이 그 사람에게 제안한 딜**뿐이다. 즉 안내가 정반대였다 — "드물게 0"이 아니라
 *   **딜이 없으면 항상 0**이다.
 *
 *   그대로 두면 인플루언서가 링크를 뿌리고 첫 정산에서 0원을 본다. 버그가 아니라 **약속 위반**이라
 *   되돌리는 비용(환급 + 신뢰)이 훨씬 크다. 그래서:
 *     - 서버가 상품마다 `my_deal_pct` 를 실어 준다(결제 적립과 같은 조건 — marketing.routes)
 *     - 딜이 있는 상품만 링크 버튼을 준다. 없으면 "먼저 딜을 맺어야 합니다"로 안내
 *     - 링크를 만들 때 **몇 %인지 함께 보여 준다** — 무엇을 받는지 모르고 뿌리게 두지 않는다
 *
 * 매장은 referral_disabled 또는 marketing_enabled=0 으로 노출 거부 가능(기존).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { Link2, Copy, Share2, Search } from 'lucide-react'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

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
  /** 🤝 2026-08-27: 내가 이 매장과 맺은 활성 딜의 %. null = 보상 없음(딜 미체결 또는 비로그인). */
  my_deal_pct: number | null
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
  const [cat, setCat] = useState('all')
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'deadline'>('latest')

  const myId = getUserId() || 'me'

  // 🛡️ 2026-05-31: 수동 fetch → useApiQuery (RQ). category(cat) 변경 시 재조회.
  // 🤝 2026-08-27: 응답에서 `authed` 도 함께 받는다 — 딜이 없을 때 "딜을 맺으세요"(로그인됨)와
  //   "로그인하세요"(비로그인)를 구분해야 한다. 둘을 같은 문구로 두면 로그인 안 한 사람이
  //   자기에게 딜이 없다고 오해한다.
  const { data: resp, isLoading: loading } = useApiQuery<{ items: Product[]; authed: boolean }>(
    ['influencer-discover', 'products', cat],
    '/api/influencer-discover/products',
    {
      params: { category: cat },
      select: (raw) => {
        const r = raw as { success?: boolean; data?: Product[]; authed?: boolean }
        return { items: r?.success ? (r.data || []) : [], authed: !!r?.authed }
      },
    },
  )
  const products = resp?.items ?? []
  const authed = resp?.authed ?? false

  function genRefLink(productId: number): string {
    return `https://urdeal.kr/group-buy/${productId}?ref=${encodeURIComponent(myId)}`
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1C21] pb-20">
      <SEO title="추천 공구 카탈로그 - 유어딜" description="매장과 딜을 맺은 이용권을 골라 내 링크로 소개하세요. 소개비는 매장이 정한 비율로 정산됩니다." url="/influencer/discover" />
      <header className="sticky top-0 z-30 bg-white dark:bg-[#0D0F12] border-b border-gray-100 dark:border-[#2C2F35] px-4 py-3 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-pink-500" />
        <h1 className="text-base font-bold text-gray-900 dark:text-white flex-1">추천 공구 카탈로그</h1>
        <button onClick={() => navigate('/influencer/settlement')} className="text-xs text-pink-600 font-bold">내 정산 →</button>
      </header>

      <main className="ur-content-wide mx-auto px-4 py-4 space-y-4">
        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(CAT_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${cat === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-[#0D0F12] text-gray-700 dark:text-gray-200 border-gray-200'}`}
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
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-[#2C2F35] rounded-full text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular' | 'deadline')}
            className="px-3 py-2 border border-gray-200 dark:border-[#2C2F35] rounded-full text-xs text-gray-900 dark:text-white font-medium bg-white dark:bg-[#0D0F12]"
          >
            <option value="latest">최신순</option>
            <option value="popular">인기순</option>
            <option value="deadline">마감임박순</option>
          </select>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">로딩 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">해당 카테고리에 활성 공구가 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(p => {
              const progress = p.group_buy_target > 0 ? Math.min(100, (p.group_buy_current / p.group_buy_target) * 100) : 0
              return (
                <li key={p.id} className="bg-white dark:bg-[#0D0F12] border border-gray-200 dark:border-[#2C2F35] rounded-xl overflow-hidden">
                  <div className="flex gap-3 p-3">
                    {p.image_url ? (
                      <img src={cfImage(p.image_url, { width: 200, quality: 82, format: 'auto' }) || p.image_url} alt={p.name} className="w-20 h-20 object-cover rounded-lg shrink-0" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, p.image_url)} />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 dark:bg-[#1A1C21] rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{p.restaurant_name || p.seller_name || '-'}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-sm font-extrabold text-pink-600">{p.price.toLocaleString()}원</p>
                        {p.my_deal_pct != null && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            내 소개비 {p.my_deal_pct}%
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-[#1A1C21] rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{p.group_buy_current}/{p.group_buy_target}명</p>
                    </div>
                  </div>
                  {p.my_deal_pct != null ? (
                    <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                      <button onClick={() => copyLink(p.id)}
                        className="py-2 rounded-lg border border-gray-200 dark:border-[#2C2F35] text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1">
                        <Copy className="w-3 h-3" /> 링크 복사
                      </button>
                      <button onClick={() => shareLink(p)}
                        className="py-2 rounded-lg bg-gradient-to-r from-gray-800 to-gray-800 text-white text-xs font-bold flex items-center justify-center gap-1">
                        <Share2 className="w-3 h-3" /> SNS 공유
                      </button>
                    </div>
                  ) : (
                    /* 🚨 딜이 없으면 링크를 주지 않는다 — 주면 0원을 약속하는 것이다. */
                    <div className="px-3 pb-3">
                      <p className="py-2 rounded-lg bg-gray-50 dark:bg-[#1A1C21] text-[11px] text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                        {authed
                          ? '이 매장과 딜을 맺어야 소개비가 붙습니다'
                          : '로그인하면 내 딜을 확인할 수 있어요'}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center pt-2 leading-relaxed">
          소개비는 <b className="text-gray-700 dark:text-gray-200">매장과 딜을 맺은 상품</b>에만 붙습니다. 비율은 매장이 정합니다.<br />
          구매 7일 뒤 확정되고(환불 시 회수), 세금을 뗀 뒤 정산됩니다.
        </p>
      </main>
    </div>
  )
}
