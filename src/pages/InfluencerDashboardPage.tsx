/**
 * 🛡️ 2026-05-18: 인플루언서 referral 대시보드 — 본인 추천 실적.
 *
 *   기존 /api/affiliate/stats (commission 누적) + /funnel (클릭→가입→결제) +
 *   /top-groups (추천 권장 상품) 활용.
 *
 *   사용자 메인 (다크 테마) 컨텍스트.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { ChevronLeft, Share2, TrendingUp, Users, DollarSign, Copy, Building2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Stats {
  total_referrals: number
  total_earned: number
  total_sales: number
}

interface Funnel {
  clicks: number
  signups: number
  paid: number
  earned: number
}

interface TopItem {
  type: 'stay' | 'group-buy' | 'product' | 'live'
  id: number
  name: string
  image_url?: string
  discount_pct?: number
  commission_pct?: number
}

export default function InfluencerDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [loading, setLoading] = useState(true)

  function token() {
    return localStorage.getItem('access_token') || localStorage.getItem('firebase_token') || ''
  }

  useEffect(() => {
    if (!token()) { navigate('/login?returnUrl=/influencer'); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [statsRes, funnelRes, topRes] = await Promise.all([
        api.get('/api/affiliate/stats', { headers: { Authorization: `Bearer ${token()}` } }).catch(() => ({ data: { data: null } })),
        api.get('/api/affiliate/funnel', { headers: { Authorization: `Bearer ${token()}` } }).catch(() => ({ data: { data: null } })),
        api.get('/api/affiliate/top-groups', { headers: { Authorization: `Bearer ${token()}` } }).catch(() => ({ data: { data: [] } })),
      ])
      if (statsRes.data?.data) setStats(statsRes.data.data as Stats)
      if (funnelRes.data?.data) setFunnel(funnelRes.data.data as Funnel)
      if (Array.isArray(topRes.data?.data)) setTopItems(topRes.data.data as TopItem[])
    } finally { setLoading(false) }
  }

  async function copyLink(type: string, id: number) {
    try {
      const r = await api.get(`/api/affiliate/link/${type}/${id}`,
        { headers: { Authorization: `Bearer ${token()}` } })
      const url = r.data?.data?.url
      if (!url) { toast.error('링크 생성 실패'); return }
      await navigator.clipboard.writeText(url)
      toast.success('🔗 링크 복사 — SNS 공유')
    } catch { toast.error('실패') }
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white pb-safe-nav">
      <SEO title="인플 대시보드 - 유어딜" description="referral 실적" url="/influencer" />

      <div className="sticky top-0 z-30 bg-[#020202]/95 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="ur-content-wide px-4 lg:px-8 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-base font-bold flex-1">💸 인플 대시보드</h1>
        </div>
      </div>

      <div className="ur-content-wide px-4 lg:px-8 py-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">로딩 중...</div>
        ) : (
          <>
            {/* 적립 누계 */}
            <div className="bg-gradient-to-br from-pink-500/[0.15] to-violet-500/[0.15] border border-pink-500/30 rounded-2xl p-5">
              <p className="text-[10px] font-bold text-pink-200/70 tracking-[0.14em]">누적 적립</p>
              <p className="text-3xl font-black text-pink-300 mt-1">
                ₩{formatNumber(stats?.total_earned || 0)}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-pink-500/20">
                <div>
                  <p className="text-[10px] text-pink-200/70">추천 결제</p>
                  <p className="text-base font-extrabold text-white">{formatNumber(stats?.total_referrals || 0)}건</p>
                </div>
                <div>
                  <p className="text-[10px] text-pink-200/70">유발 매출</p>
                  <p className="text-base font-extrabold text-white">₩{formatNumber(stats?.total_sales || 0)}</p>
                </div>
              </div>
            </div>

            {/* 펀넬 */}
            {funnel && (
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-4">
                <h2 className="text-sm font-bold mb-3">📊 추천 funnel</h2>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: '클릭', value: funnel.clicks, color: 'text-blue-300' },
                    { label: '가입', value: funnel.signups, color: 'text-emerald-300' },
                    { label: '결제', value: funnel.paid, color: 'text-pink-300' },
                    { label: '적립', value: `₩${formatNumber(funnel.earned)}`, color: 'text-amber-300' },
                  ].map((f) => (
                    <div key={f.label} className="p-2 bg-white/[0.04] rounded">
                      <p className="text-[9px] text-gray-400">{f.label}</p>
                      <p className={`text-sm font-extrabold ${f.color}`}>{f.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  전환율 {funnel.clicks > 0 ? Math.round((funnel.paid / funnel.clicks) * 100) : 0}%
                </p>
              </div>
            )}

            {/* 추천 권장 (상위 공구/숙소) */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-4">
              <h2 className="text-sm font-bold mb-3">🔥 지금 share 권장</h2>
              {topItems.length === 0 ? (
                <p className="text-xs text-gray-500">권장 상품 없음</p>
              ) : (
                <div className="space-y-2">
                  {topItems.slice(0, 10).map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 p-2 bg-white/[0.04] rounded-lg">
                      <Link to={
                        item.type === 'stay' ? `/stays/${item.id}` :
                        item.type === 'live' ? `/live/${item.id}` :
                        item.type === 'group-buy' ? `/group-buy/${item.id}` :
                        `/products/${item.id}`
                      } className="w-12 h-12 shrink-0 rounded bg-[#1A1A1A] overflow-hidden">
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold line-clamp-1">{item.name}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className="text-[9px] text-gray-400">
                            {item.type === 'stay' ? '🏨 숙소' :
                             item.type === 'live' ? '📺 라이브' :
                             item.type === 'group-buy' ? '🏪 공구' : '🛍️ 상품'}
                          </span>
                          {item.discount_pct ? (
                            <span className="text-[9px] text-pink-300 font-bold">소비자 -{item.discount_pct}%</span>
                          ) : null}
                          {item.commission_pct ? (
                            <span className="text-[9px] text-emerald-300 font-bold">커미션 {item.commission_pct}%</span>
                          ) : null}
                        </div>
                      </div>
                      <button onClick={() => copyLink(item.type, item.id)}
                        className="p-2 bg-pink-500 text-white rounded-lg shrink-0"
                        title="referral 링크 복사">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 안내 카드 */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-300 mb-1">📌 referral 공유 가이드</p>
              <ul className="text-[11px] text-blue-200/80 space-y-1">
                <li>• 본인 SNS / 카톡 / 블로그에 링크 공유</li>
                <li>• 소비자가 링크로 진입 + 결제 시 자동 적립</li>
                <li>• 본인 구매는 적립 불가 (self-referral 차단)</li>
                <li>• 누적 적립금은 정산 페이지에서 환급 신청 가능</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// dead-import 가드 (TS strict)
void Building2; void TrendingUp; void Users; void DollarSign; void Copy
