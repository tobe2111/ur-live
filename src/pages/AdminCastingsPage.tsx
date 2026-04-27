import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Megaphone, Plus, Check, Building2 } from 'lucide-react'

interface Advertiser {
  id: number
  name: string
  email: string
  status: string
}

interface Casting {
  id: number
  advertiser_id: number
  advertiser_name: string | null
  seller_id: number
  seller_name: string | null
  campaign_title: string
  campaign_brief: string | null
  product_category: string | null
  proposed_fee: number
  proposed_live_date: string | null
  status: string
  created_at: string
}

export default function AdminCastingsPage() {
  const [tab, setTab] = useState<'castings' | 'advertisers'>('castings')
  const [castings, setCastings] = useState<Casting[]>([])
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingCasting, setCreatingCasting] = useState(false)
  const [creatingAdvertiser, setCreatingAdvertiser] = useState(false)

  // Casting form
  const [advId, setAdvId] = useState<number | ''>('')
  const [sellerId, setSellerId] = useState<number | ''>('')
  const [campaignTitle, setCampaignTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [fee, setFee] = useState(0)
  const [liveDate, setLiveDate] = useState('')

  // Advertiser form
  const [advName, setAdvName] = useState('')
  const [advEmail, setAdvEmail] = useState('')
  const [advContact, setAdvContact] = useState('')

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const headers = { Authorization: `Bearer ${token}` }
      const [castingRes, advRes] = await Promise.all([
        api.get('/api/admin/castings', { headers }),
        api.get('/api/admin/advertisers', { headers }),
      ])
      if (castingRes.data.success) setCastings(castingRes.data.data)
      if (advRes.data.success) setAdvertisers(advRes.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function createAdvertiser() {
    if (!advName || !advEmail) return toast.error('이름/이메일 필수')
    try {
      const token = localStorage.getItem('admin_token')
      await api.post('/api/admin/advertisers',
        { name: advName, email: advEmail, contact_name: advContact },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success('광고주 등록 완료')
      setAdvName(''); setAdvEmail(''); setAdvContact(''); setCreatingAdvertiser(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '등록 실패')
    }
  }

  async function createCasting() {
    if (!advId || !sellerId || !campaignTitle || !fee) return toast.error('모든 필드 입력 필요')
    try {
      const token = localStorage.getItem('admin_token')
      await api.post('/api/admin/castings', {
        advertiser_id: advId,
        seller_id: sellerId,
        campaign_title: campaignTitle,
        campaign_brief: brief,
        proposed_fee: fee,
        proposed_live_date: liveDate || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('캐스팅 발송 완료')
      setAdvId(''); setSellerId(''); setCampaignTitle(''); setBrief(''); setFee(0); setLiveDate('')
      setCreatingCasting(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '발송 실패')
    }
  }

  async function completeCasting(id: number) {
    if (!confirm('이 캐스팅을 완료 처리하시겠습니까? (외부 거래 완료 후)')) return
    try {
      const token = localStorage.getItem('admin_token')
      await api.patch(`/api/admin/castings/${id}/complete`, {},
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success('완료 처리됨')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  return (
    <AdminLayout title="캐스팅 마켓플레이스">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="캐스팅 마켓플레이스"
          subtitle="광고주 ↔ 셀러 캐스팅 매칭 + 거래 관리"
          icon={<Megaphone className="h-5 w-5" />}
        />

        <div className="flex items-center gap-2 border-b border-gray-200">
          {(['castings', 'advertisers'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'castings' ? '캐스팅 신청' : '광고주'}
            </button>
          ))}
        </div>

        {tab === 'castings' && (
          <>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              {!creatingCasting ? (
                <button
                  onClick={() => setCreatingCasting(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg"
                >
                  <Plus className="w-4 h-4" /> 새 캐스팅 발송
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={advId}
                      onChange={(e) => setAdvId(e.target.value ? Number(e.target.value) : '')}
                      className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                    >
                      <option value="">광고주 선택...</option>
                      {advertisers.filter(a => a.status === 'active').map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <input
                      type="number" placeholder="셀러 ID"
                      value={sellerId}
                      onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : '')}
                      className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <input
                    type="text" placeholder="캠페인 제목"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                  />
                  <textarea
                    placeholder="캠페인 설명/브리프"
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={3}
                    className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number" placeholder="제안 비용 (원)"
                      value={fee || ''}
                      onChange={(e) => setFee(Number(e.target.value) || 0)}
                      className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                    />
                    <input
                      type="date"
                      value={liveDate}
                      onChange={(e) => setLiveDate(e.target.value)}
                      className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createCasting}
                      className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg">
                      셀러에게 발송
                    </button>
                    <button onClick={() => setCreatingCasting(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400">로딩 중...</div>
              ) : castings.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">캐스팅 내역 없음</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {castings.map(c => (
                    <div key={c.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-gray-900">{c.campaign_title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{c.status}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {c.advertiser_name} → 셀러 #{c.seller_id} ({c.seller_name})
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        💰 {c.proposed_fee.toLocaleString()}원 · {c.proposed_live_date || '날짜 미정'}
                      </div>
                      {c.status === 'accepted' && (
                        <button
                          onClick={() => completeCasting(c.id)}
                          className="mt-2 flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded">
                          <Check className="w-3 h-3" /> 완료 처리
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'advertisers' && (
          <>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              {!creatingAdvertiser ? (
                <button
                  onClick={() => setCreatingAdvertiser(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg"
                >
                  <Plus className="w-4 h-4" /> 광고주 등록
                </button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="회사명" value={advName} onChange={(e) => setAdvName(e.target.value)}
                    className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
                  <input type="email" placeholder="이메일" value={advEmail} onChange={(e) => setAdvEmail(e.target.value)}
                    className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
                  <input type="text" placeholder="담당자" value={advContact} onChange={(e) => setAdvContact(e.target.value)}
                    className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
                  <div className="md:col-span-3 flex gap-2">
                    <button onClick={createAdvertiser}
                      className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg">등록</button>
                    <button onClick={() => setCreatingAdvertiser(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg">취소</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {advertisers.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">광고주 없음</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {advertisers.map(a => (
                    <div key={a.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{a.name}</div>
                          <div className="text-xs text-gray-500">{a.email}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
