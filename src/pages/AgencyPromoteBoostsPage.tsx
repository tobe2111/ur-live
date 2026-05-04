import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'
import { Rocket, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react'

interface Boost {
  id: number
  agency_id: number
  seller_id: number
  seller_name: string | null
  tier: 'bronze' | 'silver' | 'gold'
  duration_hours: number
  status: 'unused' | 'active' | 'consumed' | 'expired'
  issued_at: string
  expires_at: string
  used_at: string | null
  used_live_id: number | null
  boost_ends_at: string | null
  note: string | null
}

interface Seller {
  id: number
  business_name: string
}

const TIER_META: Record<string, { label: string; color: string; bg: string; hours: number }> = {
  bronze: { label: '🥉 브론즈', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', hours: 12 },
  silver: { label: '🥈 실버',   color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', hours: 24 },
  gold:   { label: '🥇 골드',   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300', hours: 48 },
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  unused:   { label: '미사용',     cls: 'bg-blue-100 text-blue-700' },
  active:   { label: '🔴 활성',    cls: 'bg-red-100 text-red-700' },
  consumed: { label: '사용 완료',  cls: 'bg-gray-100 text-gray-600' },
  expired:  { label: '만료',       cls: 'bg-gray-100 text-gray-500' },
}

export default function AgencyPromoteBoostsPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<Boost[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [tier, setTier] = useState<'bronze' | 'silver' | 'gold'>('silver')
  const [note, setNote] = useState('')

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('agency_token')
      const headers = { Authorization: `Bearer ${token}` }
      const [boostRes, sellerRes] = await Promise.all([
        api.get('/api/agency/promote-boosts', { headers }),
        api.get('/api/agency/sellers', { headers }).catch(swallow('agency:fetch-sellers')),
      ])
      if (boostRes.data?.success) setItems(boostRes.data.data)
      if ((sellerRes as any)?.data?.data) setSellers((sellerRes as any).data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('common.fetchFailed', { defaultValue: '불러오기 실패' }))
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function issueBoost() {
    if (!sellerId) return toast.error(t('agency.promoteBoosts.selectSeller', { defaultValue: '셀러를 선택해주세요' }))
    try {
      const token = localStorage.getItem('agency_token')
      await api.post('/api/agency/promote-boosts',
        { seller_id: Number(sellerId), tier, note },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success(t('agency.promoteBoosts.issueSuccess', { defaultValue: '부스팅 쿠폰 발급 완료' }))
      setSellerId(''); setTier('silver'); setNote(''); setCreating(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('common.issueFailed', { defaultValue: '발급 실패' }))
    }
  }

  return (
    <AgencyLayout title="노출 부스팅">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="노출 부스팅 쿠폰 (Promote to Live)"
          subtitle="셀러에게 발급. 라이브 시작 시 활성화 → 메인 피드 상단 노출. TikTok Backstage 인사이트 적용."
          icon={<Rocket className="h-5 w-5" />}
        />

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-800">
          💡 등급별 효과:
          <strong>🥉 브론즈 12시간</strong> ·
          <strong className="ml-1">🥈 실버 24시간</strong> ·
          <strong className="ml-1">🥇 골드 48시간</strong>
        </div>

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" /> 부스팅 쿠폰 발급
          </button>
        ) : (
          <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">새 부스팅 쿠폰</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">대상 셀러</label>
                <select value={sellerId} onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900">
                  <option value="">선택...</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.business_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">등급</label>
                <select value={tier} onChange={(e) => setTier(e.target.value as any)}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900">
                  <option value="bronze">🥉 브론즈 (12h)</option>
                  <option value="silver">🥈 실버 (24h)</option>
                  <option value="gold">🥇 골드 (48h)</option>
                </select>
              </div>
            </div>
            <input type="text" placeholder="메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
            <div className="flex gap-2">
              <button onClick={issueBoost}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-lg">
                발급
              </button>
              <button onClick={() => setCreating(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg">
                취소
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">발급 내역</h3>
            <span className="text-xs text-gray-500">{items.length}건</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">아직 발급한 쿠폰이 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map(b => {
                const tierMeta = TIER_META[b.tier]
                const status = STATUS_LABEL[b.status]
                return (
                  <div key={b.id} className={`p-4 ${tierMeta.bg} border-l-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${tierMeta.color}`}>{tierMeta.label}</span>
                        <span className="text-xs text-gray-500">·</span>
                        <span className="text-xs text-gray-700">{b.seller_name || `셀러 #${b.seller_id}`}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      <span><Clock className="inline w-3 h-3" /> {b.duration_hours}h</span>
                      <span>발급: {b.issued_at?.slice(0, 10)}</span>
                      {b.status === 'active' && b.boost_ends_at && (
                        <span className="text-red-600 font-bold">
                          종료: {new Date(b.boost_ends_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {b.note && <div className="text-xs text-gray-600 mt-1 italic">"{b.note}"</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AgencyLayout>
  )
}
