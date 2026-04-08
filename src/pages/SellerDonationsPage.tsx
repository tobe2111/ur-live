import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Heart, TrendingUp, Clock, CheckCircle2, XCircle, Loader2, CreditCard } from 'lucide-react'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { formatKSTDate } from '@/utils/date'
import SellerLayout from '@/components/SellerLayout'

interface DonationRow {
  id: number
  stream_id: number
  stream_title: string | null
  donor_name: string
  amount: number
  seller_amount: number
  commission_amount: number
  commission_rate: number
  message: string | null
  is_anonymous: number
  status: string
  can_settle: number
  created_at: string
}

interface SettlementRow {
  id: number
  total_amount: number
  commission_amount: number
  settlement_amount: number
  donation_count: number
  status: string
  requested_at: string
  settled_at: string | null
  admin_memo: string | null
  bank_info: string | null
}

interface Summary {
  total_received: number
  total_settled: number
  available_amount: number
  pending_settlement: number
}

export default function SellerDonationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'donations' | 'settlements'>('donations')
  const [donations, setDonations] = useState<DonationRow[]>([])
  const [settlements, setSettlements] = useState<SettlementRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [settleModal, setSettleModal] = useState(false)
  const [bankInfo, setBankInfo] = useState('')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadData()
  }, [navigate])

  useEffect(() => {
    if (activeTab === 'settlements') loadSettlements()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      const h = { Authorization: `Bearer ${getSellerToken()}` }
      const [sumRes, donRes] = await Promise.all([
        api.get('/api/seller/donations/summary', { headers: h }),
        api.get('/api/seller/donations', { headers: h }),
      ])
      setSummary(sumRes.data.data)
      setDonations(donRes.data.data ?? [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  async function loadSettlements() {
    try {
      const res = await api.get('/api/seller/donations/settlements', {
        headers: { Authorization: `Bearer ${getSellerToken()}` },
      })
      setSettlements(res.data.data ?? [])
    } catch { /* ignore */ }
  }

  async function requestSettlement() {
    if (!bankInfo.trim()) { toast.error('정산 계좌 정보를 입력해주세요'); return }
    setRequesting(true)
    try {
      const res = await api.post('/api/seller/donations/settlements', { bank_info: bankInfo }, {
        headers: { Authorization: `Bearer ${getSellerToken()}` },
      })
      if (res.data.success) {
        toast.success(res.data.message || '정산 신청이 완료되었습니다')
        setSettleModal(false)
        setBankInfo('')
        loadData()
        loadSettlements()
      } else {
        toast.error(res.data.error || '정산 신청에 실패했습니다')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || '정산 신청에 실패했습니다')
    } finally { setRequesting(false) }
  }

  function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n || 0) }
  function fmtDate(s: string) { return formatKSTDate(s) }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    REQUESTED: { label: t('common.pending'), color: 'bg-amber-50 text-amber-700' },
    DONE:      { label: t('common.completed'), color: 'bg-emerald-50 text-emerald-700' },
    REJECTED:  { label: t('common.cancelled'), color: 'bg-red-50 text-red-600' },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    )
  }

  return (
    <SellerLayout title={t('seller.donations')}>
      <div className="max-w-2xl mx-auto">
        {/* 요약 카드 */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: '총 후원 수령액', value: `${fmt(summary.total_received)}원`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-pink-500', bg: 'bg-pink-50' },
              { label: '정산 가능액', value: `${fmt(summary.available_amount)}원`, icon: <CreditCard className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: '정산 완료액', value: `${fmt(summary.total_settled)}원`, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '정산 대기액', value: `${fmt(summary.pending_settlement)}원`, icon: <Clock className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{c.label}</span>
                  <div className={`w-7 h-7 rounded-lg ${c.bg} ${c.color} flex items-center justify-center`}>{c.icon}</div>
                </div>
                <p className="text-base font-bold text-gray-900">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 수수료 안내 */}
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-bold">수수료 안내</span> — 후원 정산 시 플랫폼 수수료 <span className="font-bold">15%</span>가 차감됩니다.
            예) 1,000딜 후원 수령 시 실제 정산 금액은 <span className="font-bold">850원</span>입니다.
          </p>
        </div>

        {/* 정산 신청 버튼 */}
        {summary && summary.available_amount > 0 && (
          <button
            onClick={() => setSettleModal(true)}
            className="w-full mb-5 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-md shadow-pink-200 active:scale-[0.98]"
          >
            정산 신청하기 ({fmt(summary.available_amount)}원)
          </button>
        )}

        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {([
            { id: 'donations', label: '후원 내역' },
            { id: 'settlements', label: '정산 내역' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 후원 내역 */}
        {activeTab === 'donations' && (
          <div className="bg-white rounded-xl shadow-sm">
            {donations.length === 0 ? (
              <div className="py-16 text-center">
                <Heart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">아직 후원이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {donations.map(d => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{d.donor_name}</span>
                          {d.can_settle === 1 && (
                            <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">정산 가능</span>
                          )}
                        </div>
                        {d.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{d.message}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{d.stream_title ?? '-'} · {fmtDate(d.created_at)}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-bold text-pink-600">+{fmt(d.seller_amount)}원</p>
                        <p className="text-xs text-gray-400">(수수료 {fmt(d.commission_amount)}원)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 정산 내역 */}
        {activeTab === 'settlements' && (
          <div className="bg-white rounded-xl shadow-sm">
            {settlements.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">정산 신청 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {settlements.map(s => {
                  const st = STATUS_MAP[s.status] ?? { label: s.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={s.id} className="px-4 py-4">
                      <div className="flex items-start justify-between mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        <span className="text-base font-bold text-gray-900">{fmt(s.settlement_amount)}원</span>
                      </div>
                      <p className="text-xs text-gray-400">후원 {s.donation_count}건 · 총 {fmt(s.total_amount)}원 (수수료 {fmt(s.commission_amount)}원)</p>
                      <p className="text-xs text-gray-400 mt-0.5">신청일: {fmtDate(s.requested_at)}{s.settled_at ? ` · 정산일: ${fmtDate(s.settled_at)}` : ''}</p>
                      {s.admin_memo && <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">{s.admin_memo}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 정산 신청 모달 */}
      {settleModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSettleModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">정산 신청</h3>
            <p className="text-xs text-gray-400 mb-4">
              정산 가능 금액: <span className="font-bold text-emerald-600">{fmt(summary?.available_amount ?? 0)}원</span>
              <br />수수료 15% 제외 후 입금됩니다.
            </p>
            <label className="block text-xs text-gray-600 mb-1">정산 계좌 정보</label>
            <textarea
              value={bankInfo}
              onChange={e => setBankInfo(e.target.value)}
              placeholder="은행명, 계좌번호, 예금주를 입력해주세요&#10;예) 카카오뱅크 3333-01-1234567 홍길동"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-4 focus:border-pink-400 focus:outline-none resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setSettleModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl">{t('common.cancel')}</button>
              <button
                onClick={requestSettlement}
                disabled={requesting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('common.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
