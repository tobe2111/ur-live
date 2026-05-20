/**
 * 🛡️ 2026-05-20: 에이전시 — "내가 입점시킨 가게" 대시보드 (Phase 2).
 *
 * 사용자 요청: 에이전시 = 가게 입점 영업. 입점 가게의 모든 공구권 매출 → 2% 영구 commission.
 *   추가 보상: ₩30k 가입 보너스 (가게 첫 결제) + ₩50k 월 성장 보너스 (월 100만 돌파).
 *
 * 페이지 구성:
 *   1. 상단 KPI: 입점 가게 수 / 누적 commission / 이번달 commission / 출금 가능
 *   2. 내 추천 코드 + share link (가게에 전달)
 *   3. 입점 가게 리스트 (매출/commission 컬럼)
 *   4. 최근 commission 적립 내역 (ledger)
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Store, Users, Wallet, Sparkles, Copy, CheckCircle2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Summary {
  total_stores: number
  active_stores: number
  total_commission: number
  month_commission: number
  pending_commission: number
  available_commission: number
  paid_commission: number
}

interface IntroducedStore {
  id: number
  business_name: string | null
  name: string | null
  status: string | null
  introduced_at: string | null
  created_at: string
  total_orders: number
  total_sales: number
  total_commission: number
  pending_commission: number
}

interface CommissionEntry {
  id: number
  store_seller_id: number
  store_name: string | null
  order_id: number | null
  type: 'signup_bonus' | 'sales_commission' | 'growth_bonus'
  order_amount: number
  commission_amount: number
  status: 'pending' | 'available' | 'paid' | 'cancelled'
  note: string | null
  created_at: string
}

interface IntroCode {
  intro_code: string | null
  commission_pct: number
  share_url: string | null
}

const TYPE_LABEL: Record<CommissionEntry['type'], { label: string; color: string }> = {
  signup_bonus: { label: '입점 보너스', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  sales_commission: { label: '매출 commission', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  growth_bonus: { label: '성장 보너스', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

const STATUS_LABEL: Record<CommissionEntry['status'], string> = {
  pending: '대기',
  available: '출금 가능',
  paid: '지급 완료',
  cancelled: '취소',
}

export default function AgencyIntroducedStoresPage() {
  const { t: _t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [stores, setStores] = useState<IntroducedStore[]>([])
  const [commissions, setCommissions] = useState<CommissionEntry[]>([])
  const [introCode, setIntroCode] = useState<IntroCode | null>(null)
  const [copied, setCopied] = useState(false)

  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/api/agency/introduced-stores/summary', { headers }),
      api.get('/api/agency/introduced-stores', { headers }),
      api.get('/api/agency/introduced-stores/commissions?limit=30', { headers }),
      api.get('/api/agency/intro-code', { headers }),
    ])
      .then(([s, l, c, ic]) => {
        if (cancelled) return
        if (s.data?.success) setSummary(s.data.data)
        if (l.data?.success) setStores(l.data.data || [])
        if (c.data?.success) setCommissions(c.data.data || [])
        if (ic.data?.success) setIntroCode(ic.data.data)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('데이터 로딩 실패')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopyCode = async () => {
    if (!introCode?.share_url) return
    try {
      await navigator.clipboard.writeText(introCode.share_url)
      setCopied(true)
      toast.success('가입 링크를 복사했습니다')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사 실패')
    }
  }

  return (
    <AgencyLayout title="내가 입점시킨 가게">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="내가 입점시킨 가게"
          subtitle="입점 가게의 매출 2% 영구 commission · 가입 보너스 ₩30,000 · 월 100만 돌파 ₩50,000"
          icon={<Store className="h-5 w-5" />}
        />

        {loading ? <DashboardLoading /> : (
          <>
            {/* KPI 4종 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                icon={<Users className="w-5 h-5 text-blue-600" />}
                label="입점 가게"
                value={`${summary?.total_stores ?? 0}곳`}
                sub={`활성 ${summary?.active_stores ?? 0}곳`}
                bg="bg-blue-50 border-blue-100"
              />
              <Kpi
                icon={<Sparkles className="w-5 h-5 text-pink-600" />}
                label="이번달 적립"
                value={`₩${formatNumber(summary?.month_commission ?? 0)}`}
                sub={`누적 ₩${formatNumber(summary?.total_commission ?? 0)}`}
                bg="bg-pink-50 border-pink-100"
              />
              <Kpi
                icon={<Wallet className="w-5 h-5 text-emerald-600" />}
                label="출금 가능"
                value={`₩${formatNumber(summary?.available_commission ?? 0)}`}
                sub={`대기 ₩${formatNumber(summary?.pending_commission ?? 0)}`}
                bg="bg-emerald-50 border-emerald-100"
              />
              <Kpi
                icon={<CheckCircle2 className="w-5 h-5 text-gray-600" />}
                label="지급 완료"
                value={`₩${formatNumber(summary?.paid_commission ?? 0)}`}
                sub="역대 누적"
                bg="bg-gray-50 border-gray-200"
              />
            </div>

            {/* 추천 코드 카드 */}
            <div className="bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-200 rounded-2xl p-5">
              <p className="text-[11px] font-bold text-violet-700 tracking-wide mb-1">내 추천 코드</p>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-3xl font-extrabold font-mono text-gray-900">
                  {introCode?.intro_code || '생성 중...'}
                </p>
                {introCode?.share_url && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? '복사됨' : '가입 링크 복사'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                가게 사장님에게 이 코드를 알려주거나 가입 링크를 공유하세요.
                <br />
                가입 시 자동 매칭 → 입점 가게의 모든 매출에 <strong>{introCode?.commission_pct ?? 2}%</strong> 영구 commission.
              </p>
            </div>

            {/* 입점 가게 리스트 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">입점 가게 ({stores.length}곳)</h2>
              </div>
              {stores.length === 0 ? (
                <DashboardEmptyState
                  icon={<Store className="h-7 w-7" />}
                  title="아직 입점시킨 가게가 없어요"
                  description="추천 코드를 가게에 공유해서 첫 입점을 시작해보세요."
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {stores.map(s => (
                    <div key={s.id} className="px-4 py-3 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-sm font-bold text-gray-900">
                          {s.business_name || s.name || `#${s.id}`}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {s.introduced_at ? `입점 ${new Date(s.introduced_at).toLocaleDateString('ko-KR')}` : '입점일 미상'}
                          {s.status && <span className="ml-2">· {s.status}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">누적 매출</p>
                        <p className="text-sm font-bold text-gray-900">₩{formatNumber(s.total_sales)}</p>
                        <p className="text-[10px] text-gray-400">{s.total_orders}건</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">commission</p>
                        <p className="text-sm font-extrabold text-pink-600">₩{formatNumber(s.total_commission)}</p>
                        {s.pending_commission > 0 && (
                          <p className="text-[10px] text-amber-600">대기 ₩{formatNumber(s.pending_commission)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 적립 내역 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900">최근 적립 내역</h2>
              </div>
              {commissions.length === 0 ? (
                <p className="px-4 py-8 text-xs text-center text-gray-400">적립 내역이 없습니다</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {commissions.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TYPE_LABEL[c.type].color}`}>
                        {TYPE_LABEL[c.type].label}
                      </span>
                      <div className="flex-1 min-w-[140px]">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {c.store_name || `#${c.store_seller_id}`}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {c.note || (c.order_id ? `주문 #${c.order_id}` : '')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-emerald-600">+₩{formatNumber(c.commission_amount)}</p>
                        <p className="text-[10px] text-gray-400">{STATUS_LABEL[c.status]} · {new Date(c.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AgencyLayout>
  )
}

function Kpi({ icon, label, value, sub, bg }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  bg: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[11px] font-bold text-gray-600">{label}</p>
      </div>
      <p className="text-lg font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}
