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
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [loading, setLoading] = useState(true)

  function token() {
    return localStorage.getItem('access_token') || localStorage.getItem('firebase_token') || ''
  }

  // 🛡️ 2026-05-22 무한 redirect 사고 fix:
  //   원인: KR 카카오 세션 쿠키 사용자는 access_token 없음 (쿠키 인증) → token()=''.
  //         LoginPage 는 isLoggedIn=true 판정 (user_id 있음) → /influencer 보냄.
  //         InfluencerDashboardPage 는 token() 빈값 → /login 다시 보냄 → 사이클.
  //   해결: LoginPage 와 동일 기준 — user_id+user_type 도 인증으로 인정.
  //         쿠키 사용자는 access_token 없어도 OK. api.get 자체가 쿠키 자동 전송.
  const hasToken = !!token() ||
    (localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id'))

  useEffect(() => {
    if (!hasToken) {
      navigate('/login?returnUrl=/influencer', { replace: true })
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken])

  async function load() {
    setLoading(true)
    try {
      // 🛡️ 2026-05-22: api.ts 가 withCredentials:true + interceptor 가 Authorization 자동 부착.
      //   여기서 명시적 Bearer 헤더는 쿠키 사용자에게 빈 토큰 ('Bearer ') 보내 401 유발.
      const [statsRes, funnelRes, topRes] = await Promise.all([
        api.get('/api/affiliate/stats').catch(() => ({ data: { data: null } })),
        api.get('/api/affiliate/funnel').catch(() => ({ data: { data: null } })),
        api.get('/api/affiliate/top-groups').catch(() => ({ data: { data: [] } })),
      ])
      if (statsRes.data?.data) setStats(statsRes.data.data as Stats)
      if (funnelRes.data?.data) setFunnel(funnelRes.data.data as Funnel)
      if (Array.isArray(topRes.data?.data)) setTopItems(topRes.data.data as TopItem[])
    } finally { setLoading(false) }
  }

  async function shareViaKakao(item: TopItem) {
    try {
      const r = await api.get(`/api/affiliate/link/${item.type}/${item.id}`)
      const url = r.data?.data?.url
      if (!url) { toast.error('링크 생성 실패'); return }

      // 카카오톡 공유 시도 — fail-soft (클립보드 fallback).
      try {
        const { ensureKakaoSdk } = await import('@/lib/kakao-sdk')
        await ensureKakaoSdk()
        const Kakao = (window as unknown as { Kakao?: { Share?: { sendDefault?: (params: unknown) => void } } }).Kakao
        if (Kakao?.Share?.sendDefault) {
          const typeLabel = item.type === 'stay' ? '🏨 숙소'
            : item.type === 'live' ? '📺 라이브'
            : item.type === 'group-buy' ? '🏪 공구'
            : '🛍️ 상품'
          const description = [
            typeLabel,
            item.discount_pct ? `${item.discount_pct}% 할인` : null,
          ].filter(Boolean).join(' · ')
          Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: item.name,
              description,
              imageUrl: item.image_url || 'https://live.ur-team.com/og-default.png',
              link: { mobileWebUrl: url, webUrl: url },
            },
            buttons: [{ title: '바로 보기', link: { mobileWebUrl: url, webUrl: url } }],
          })
          return
        }
      } catch { /* fallback */ }

      // navigator.share 또는 클립보드 fallback.
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: item.name, url })
          return
        } catch { /* user cancel — fallback */ }
      }
      await navigator.clipboard.writeText(url)
      toast.success('🔗 링크 복사 — SNS 공유')
    } catch { toast.error('공유 실패') }
  }

  async function copyLink(type: string, id: number) {
    try {
      const r = await api.get(`/api/affiliate/link/${type}/${id}`)
      const url = r.data?.data?.url
      if (!url) { toast.error('링크 생성 실패'); return }
      await navigator.clipboard.writeText(url)
      toast.success('🔗 링크 복사')
    } catch { toast.error('실패') }
  }

  // 🛡️ 2026-05-22: 비로그인 시 빈 화면 (navigate redirect 가 useEffect 에서 실행됨).
  //   기존엔 '로딩 중...' 표시 상태에서 SideBanner 가 마운트되어 /api/side-banners 호출 → 429 사이클.
  if (!hasToken) return null

  return (
    <div className="min-h-screen bg-[#020202] text-white pb-safe-nav">
      <SEO title="인플 대시보드 - 유어딜" description="referral 실적" url="/influencer" />

      <div className="sticky top-0 z-30 bg-[#020202]/95 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="ur-content-wide px-4 lg:px-8 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="p-1"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-base font-bold flex-1">{t('influencer.dashTitle', { defaultValue: '💸 인플 대시보드' })}</h1>
        </div>
      </div>

      <div className="ur-content-wide px-4 lg:px-8 py-4 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">로딩 중...</div>
        ) : (
          <>
            {/* 적립 누계 */}
            <div className="bg-gradient-to-br from-pink-500/[0.15] to-violet-500/[0.15] border border-pink-500/30 rounded-2xl p-5">
              <p className="text-[10px] font-bold text-pink-200/70 tracking-[0.14em]">{t('influencer.earned', { defaultValue: '누적 적립' })}</p>
              <p className="text-3xl font-black text-pink-300 mt-1">
                ₩{formatNumber(stats?.total_earned || 0)}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-pink-500/20">
                <div>
                  <p className="text-[10px] text-pink-200/70">{t('influencer.refCount', { defaultValue: '추천 결제' })}</p>
                  <p className="text-base font-extrabold text-white">{formatNumber(stats?.total_referrals || 0)}건</p>
                </div>
                <div>
                  <p className="text-[10px] text-pink-200/70">{t('influencer.refSales', { defaultValue: '유발 매출' })}</p>
                  <p className="text-base font-extrabold text-white">₩{formatNumber(stats?.total_sales || 0)}</p>
                </div>
              </div>
            </div>

            {/* 펀넬 */}
            {funnel && (
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-4">
                <h2 className="text-sm font-bold mb-3">{t('influencer.funnelTitle', { defaultValue: '📊 추천 funnel' })}</h2>
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
              <h2 className="text-sm font-bold mb-3">{t('influencer.topShare', { defaultValue: '🔥 지금 share 권장' })}</h2>
              {topItems.length === 0 ? (
                <p className="text-xs text-gray-500">{t('influencer.noTop', { defaultValue: '권장 상품 없음' })}</p>
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
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => shareViaKakao(item)}
                          className="p-2 bg-[#FEE500] text-[#3C1E1E] rounded-lg"
                          title="카카오톡 공유">
                          💬
                        </button>
                        <button onClick={() => copyLink(item.type, item.id)}
                          className="p-2 bg-pink-500 text-white rounded-lg"
                          title="링크 복사">
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 안내 카드 */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-300 mb-1">{t('influencer.shareGuide', { defaultValue: '📌 referral 공유 가이드' })}</p>
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
