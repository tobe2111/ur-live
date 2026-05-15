import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Copy, TrendingUp, Users, Gift, Loader2, Share2, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

export default function AffiliatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/affiliate/stats')
      .then(r => { if (r.data.success) setData(r.data.data) })
      .catch(() => toast.error(t('affiliate.loginRequired')))
      .finally(() => setLoading(false))
  }, [t])

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success(t('affiliate.linkCopied'))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      <SEO title={t('affiliate.seoTitle')} description={t('affiliate.seoDescription')} url="/user/affiliate" />
      {/* 헤더 */}
      <div className="sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center gap-3 px-4 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('affiliate.title')}</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-gray-500" /></div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">{t('affiliate.loginPrompt')}</div>
      ) : (
        <div className="ur-content-narrow px-4 lg:px-8 py-5 space-y-4">

          {/* 히어로 카드 */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5" />
              <span className="text-sm font-bold opacity-90">{t('affiliate.earnHero')}</span>
            </div>
            <p className="text-3xl font-extrabold mb-1">{formatNumber(data.total_earned)}<span className="text-lg ml-1">딜</span></p>
            <p className="text-xs opacity-70">{t('affiliate.totalEarned')}</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold">{data.total_referrals}</p>
                <p className="text-[10px] opacity-70">{t('affiliate.totalReferrals')}</p>
              </div>
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold">{formatNumber(data.monthly_earned || 0)}</p>
                <p className="text-[10px] opacity-70">{t('affiliate.monthlyEarned')}</p>
              </div>
            </div>
          </div>

          {/* 추천 링크 */}
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-violet-600" />
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('affiliate.myLinkTitle')}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              <Trans
                i18nKey="affiliate.myLinkDesc"
                values={{ rate: data.commission_rate }}
                components={[<strong key="0" className="text-violet-600" />]}
              />
            </p>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-xs text-gray-600 dark:text-gray-300 truncate">
                {data.share_url}
              </div>
              <button onClick={() => copyLink(data.share_url)}
                className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95">
                <Copy className="w-3.5 h-3.5" /> {t('affiliate.copy')}
              </button>
            </div>
          </div>

          {/* 이용 방법 */}
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-4 shadow-sm">
            <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{t('affiliate.howToTitle')}</p>
            <div className="space-y-3">
              {[
                { step: '1', text: t('affiliate.howToStep1'), color: 'bg-violet-100 text-violet-700' },
                { step: '2', text: t('affiliate.howToStep2'), color: 'bg-blue-100 text-blue-700' },
                { step: '3', text: t('affiliate.howToStep3'), color: 'bg-green-100 text-green-700' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full ${s.color} text-xs font-bold flex items-center justify-center shrink-0`}>{s.step}</span>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 수수료 안내 */}
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('affiliate.feeTitle')}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { label: t('affiliate.feeRate'), value: `${data.commission_rate}%` },
                { label: t('affiliate.feeMethodLabel'), value: t('affiliate.feeMethodValue') },
                { label: t('affiliate.feeUsageLabel'), value: t('affiliate.feeUsageValue') },
                { label: t('affiliate.feeValidLabel'), value: t('affiliate.feeValidValue') },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 🛡️ 2026-05-15: 인플루언서 funnel — 카테고리별 분포 + 일별 추이 */}
          <FunnelStats />

          {/* 🛡️ 2026-05-15: 인플루언서 추천 — share 하면 좋을 핫 공구 */}
          <TopGroupsToShare />

          {/* 최근 내역 */}
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between">
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('affiliate.historyTitle')}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500">{t('affiliate.historyCount', { count: (data.recent || []).length })}</span>
            </div>
            {(data.recent || []).length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('affiliate.historyEmpty')}</p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">{t('affiliate.historyEmptyHint')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(data.recent || []).map((r: { product_name?: string; created_at: string; commission: number; order_amount: number }, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.product_name || t('affiliate.productFallback')}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-green-600">{t('affiliate.earnedDeal', { amount: formatNumber(r.commission) })}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('affiliate.purchaseAmount', { amount: formatNumber(r.order_amount) })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 쇼핑하러 가기 */}
          <button onClick={() => navigate('/browse')}
            className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]">
            {t('affiliate.browseProducts')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// 🛡️ 2026-05-15: 인플루언서 추천 — 지금 share 하기 좋은 공구 (마감임박 + 진행률 60%+)
function TopGroupsToShare() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [groups, setGroups] = useState<Array<{
    id: number; name: string; image_url?: string; price: number;
    restaurant_name?: string; group_buy_target: number; group_buy_current: number;
    group_buy_deadline?: string; progress_pct: number; my_potential_bonus: number;
    share_url: string;
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/affiliate/top-groups')
      .then(r => { if (r.data?.success) setGroups(r.data.data || []) })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (groups.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">🔥 지금 share 하기 좋은 공구</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">마감임박 + 진행률 높음 = 친구 가입 가능성 높음</p>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-[#1A1A1A]">
        {groups.slice(0, 6).map(g => (
          <div key={g.id} className="px-4 py-3 flex items-center gap-3">
            {g.image_url ? (
              <img src={g.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" loading="lazy" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-200 to-rose-300 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{g.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{g.restaurant_name || ''} · {g.progress_pct}% · {g.group_buy_current}/{g.group_buy_target}명</p>
              <p className="text-[10px] text-pink-600 font-bold mt-0.5">친구 가입 시 +{(g.my_potential_bonus ?? 0).toLocaleString()}딜 보너스</p>
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(g.share_url)
                  toast.success('링크 복사됨')
                } catch { toast.error('복사 실패') }
              }}
              className="px-3 py-1.5 bg-pink-50 dark:bg-pink-900/30 text-pink-600 rounded-lg text-[11px] font-bold shrink-0 active:scale-95"
            >
              <Copy className="w-3 h-3 inline mr-0.5" /> 복사
            </button>
            <button
              onClick={() => navigate(`/group-buy/${g.id}`)}
              className="px-2.5 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300 rounded-lg text-[11px] font-bold shrink-0"
              aria-label="상세 보기"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// 🛡️ 2026-05-15: 인플루언서 funnel — 카테고리별 / 일별 추이
function FunnelStats() {
  const [data, setData] = useState<{
    total_referrals: number; total_earned: number;
    by_category: Array<{ category: string; count: number; earned: number }>;
    daily: Array<{ day: string; count: number; earned: number }>;
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/affiliate/funnel')
      .then(r => { if (r.data?.success) setData(r.data.data) })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data || data.total_referrals === 0) return null

  const CATEGORY_LABEL: Record<string, string> = {
    meal: '🍽️ 식사', beauty: '💇 뷰티', health: '💪 헬스',
    pet: '🐶 펫', stay: '🏨 숙박', activity: '🎯 액티비티', other: '기타',
  }
  const maxDailyCount = Math.max(...data.daily.map(d => d.count), 1)

  return (
    <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
        <p className="text-[15px] font-bold text-gray-900 dark:text-white">📊 내 share 성과</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">친구 가입 → 보상 받은 횟수 + 카테고리별 / 일별 추이</p>
      </div>

      {/* 카테고리별 */}
      {data.by_category.length > 0 && (
        <div className="p-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">카테고리별</p>
          <div className="space-y-1.5">
            {data.by_category.map(c => (
              <div key={c.category} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 dark:text-gray-300">{CATEGORY_LABEL[c.category] || c.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{c.count}회</span>
                  <span className="font-bold text-violet-600 w-16 text-right">{c.earned.toLocaleString()}딜</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일별 mini chart (간단한 bar) */}
      {data.daily.length > 0 && (
        <div className="p-4">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">최근 14일</p>
          <div className="flex items-end gap-0.5 h-20">
            {data.daily.slice(0, 14).reverse().map((d, i) => {
              const h = Math.max(2, (d.count / maxDailyCount) * 80)
              return (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-violet-500 to-violet-400 rounded-t transition-all"
                  style={{ height: h }}
                  title={`${d.day}: ${d.count}회 / ${d.earned}딜`}
                />
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
            <span>{data.daily[Math.min(13, data.daily.length - 1)]?.day || ''}</span>
            <span>{data.daily[0]?.day || ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
