/**
 * 🛡️ 2026-05-16: 인플루언서 정산 페이지 (/influencer/settlement).
 *
 * 본인 잔액 + 사업자번호/계좌 등록 + 최근 attribution 내역.
 * 일반 user 로그인 필요 (referral 받은 사람 = 일반 user).
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { Wallet, TrendingUp, Clock, CheckCircle, Save } from 'lucide-react'

interface Balance {
  pending_amount: number
  available_amount: number
  total_paid_out: number
  business_number: string | null
  tax_type: 'business_income' | 'other_income' | 'unreported' | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  payout_method: 'cash' | 'deal' | null
}

interface Attribution {
  id: number
  order_id: number
  product_id: number
  seller_id: number
  commission_amount: number
  status: 'pending' | 'available' | 'paid' | 'clawed_back'
  created_at: string
  available_at: string | null
  paid_at: string | null
}

// 🛡️ 2026-05-16: 내가 영입한 매장 + 협업 deals
function MyStoresAndDeals() {
  const [referred, setReferred] = useState<Array<{ id: number; name: string; referral_bonus_until: string | null; total_commission: number }>>([])
  const [deals, setDeals] = useState<Array<{ id: number; seller_id: number; seller_name: string | null; commission_pct: number; status: string; proposed_by: string; created_at: string; ends_at: string | null }>>([])
  useEffect(() => {
    api.get('/api/influencer-settlement/my-stores')
      .then(r => {
        if (r.data?.success) {
          setReferred(r.data.data.referred || [])
          setDeals(r.data.data.deals || [])
        }
      })
      .catch(() => { /* silent */ })
  }, [])
  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">🏪 내가 영입한 매장 ({referred.length}개)</h3>
        {referred.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">아직 영입한 매장이 없습니다. 매장 가입 시 추천 링크 (https://live.ur-team.com/seller/register?ref=내ID) 공유 → 6개월간 +1% 추가 commission</p>
        ) : (
          <ul className="space-y-2">
            {referred.map(s => {
              const remaining = s.referral_bonus_until ? Math.max(0, Math.ceil((new Date(s.referral_bonus_until).getTime() - Date.now()) / (30 * 86400_000))) : 0
              return (
                <li key={s.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500">누적 commission {s.total_commission.toLocaleString()}원</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded font-bold ${remaining > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {remaining > 0 ? `보너스 ${remaining}개월 남음` : '보너스 종료'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">🤝 매장 협업 ({deals.length}건)</h3>
        {deals.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">매장과 우대 commission 협상 가능 (예: 1.5%). 매장 홍보 가서 직접 협의하거나 사이트에서 신청.</p>
        ) : (
          <ul className="space-y-2">
            {deals.map(d => (
              <li key={d.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.seller_name || `매장 ${d.seller_id}`}</p>
                  <p className="text-[10px] text-gray-500">우대 {d.commission_pct}% · {d.proposed_by === 'seller' ? '매장 제안' : '내가 신청'}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                  d.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  d.status === 'proposed' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {d.status === 'active' ? '활성' : d.status === 'proposed' ? '대기' : d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: '환불기간 (대기)', color: 'bg-yellow-100 text-yellow-700' },
  available: { label: '송금 대기', color: 'bg-blue-100 text-blue-700' },
  paid: { label: '송금 완료', color: 'bg-emerald-100 text-emerald-700' },
  clawed_back: { label: '회수됨 (환불)', color: 'bg-red-100 text-red-700' },
}

export default function InfluencerSettlementPage() {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [recent, setRecent] = useState<Attribution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    business_number: '',
    tax_type: 'other_income' as 'business_income' | 'other_income' | 'unreported',
    bank_name: '',
    bank_account: '',
    account_holder: '',
    payout_method: 'cash' as 'cash' | 'deal',
  })

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    api.get('/api/influencer-settlement/me')
      .then((r) => {
        if (r.data?.success) {
          const b = r.data.data.balance as Balance
          setBalance(b)
          setRecent(r.data.data.recent || [])
          setForm({
            business_number: b.business_number || '',
            tax_type: (b.tax_type as 'business_income' | 'other_income' | 'unreported') || 'other_income',
            bank_name: b.bank_name || '',
            bank_account: b.bank_account || '',
            account_holder: b.account_holder || '',
            payout_method: (b.payout_method as 'cash' | 'deal') || 'cash',
          })
        }
      })
      .catch(() => toast.error('데이터 로드 실패'))
      .finally(() => setLoading(false))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await api.put('/api/influencer-settlement/me', form)
      if (res.data?.success) {
        toast.success('정산 정보 저장됨')
        load()
      } else {
        toast.error(res.data?.error || '저장 실패')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '저장 실패')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-sm text-gray-500">로딩 중...</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <SEO title="인플루언서 정산 - 유어딜" description="referral commission 잔액 / 송금 내역 / 세금 정보 관리" url="/influencer/settlement" />
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-pink-500" />
        <h1 className="text-base font-bold text-gray-900">인플루언서 정산</h1>
      </header>

      <main className="ur-content-narrow mx-auto px-4 py-4 space-y-5">
        {/* 잔액 요약 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-yellow-50 rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 text-yellow-700 mx-auto mb-1" />
            <p className="text-[10px] text-yellow-700 font-medium">대기 (환불기간)</p>
            <p className="text-sm font-extrabold text-yellow-800 mt-0.5">{(balance?.pending_amount ?? 0).toLocaleString()}원</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <TrendingUp className="w-4 h-4 text-blue-700 mx-auto mb-1" />
            <p className="text-[10px] text-blue-700 font-medium">송금 대기</p>
            <p className="text-sm font-extrabold text-blue-800 mt-0.5">{(balance?.available_amount ?? 0).toLocaleString()}원</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <CheckCircle className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
            <p className="text-[10px] text-emerald-700 font-medium">누적 송금</p>
            <p className="text-sm font-extrabold text-emerald-800 mt-0.5">{(balance?.total_paid_out ?? 0).toLocaleString()}원</p>
          </div>
        </div>

        {/* 정산 정보 입력 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">정산 정보</h3>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">송금 방식</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, payout_method: 'cash' }))}
                className={`p-3 rounded-xl border-2 text-left ${form.payout_method === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <p className="text-sm font-bold text-gray-900">현금 송금</p>
                <p className="text-[10px] text-gray-500 mt-0.5">원천징수 후 계좌 입금</p>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, payout_method: 'deal' }))}
                className={`p-3 rounded-xl border-2 text-left ${form.payout_method === 'deal' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}
              >
                <p className="text-sm font-bold text-gray-900">딜 포인트 <span className="text-pink-600">+20%</span></p>
                <p className="text-[10px] text-gray-500 mt-0.5">유어딜 결제 / 환불 X</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">사업자번호 (있을 때만)</label>
            <input
              value={form.business_number}
              onChange={(e) => setForm(f => ({ ...f, business_number: e.target.value.replace(/[^\d-]/g, '') }))}
              placeholder="000-00-00000 (10자리)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">있으면 사업소득세 3.3% 원천징수, 없으면 기타소득 8.8%</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">세금 구분</label>
            <select
              value={form.tax_type}
              onChange={(e) => setForm(f => ({ ...f, tax_type: e.target.value as 'business_income' | 'other_income' | 'unreported' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="business_income">사업소득 (3.3% 원천징수, 사업자번호 필요)</option>
              <option value="other_income">기타소득 (8.8% 원천징수, 사업자번호 불필요)</option>
              <option value="unreported">무신고 (원천징수 X, 본인 책임)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">은행</label>
            <select
              value={form.bank_name}
              onChange={(e) => setForm(f => ({ ...f, bank_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="">은행 선택</option>
              {['KB국민은행','신한은행','우리은행','하나은행','NH농협은행','IBK기업은행','케이뱅크','카카오뱅크','토스뱅크','새마을금고','신협','우체국'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">계좌번호</label>
            <input
              value={form.bank_account}
              onChange={(e) => setForm(f => ({ ...f, bank_account: e.target.value.replace(/[^\d-]/g, '') }))}
              placeholder="000-000-000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">예금주</label>
            <input
              value={form.account_holder}
              onChange={(e) => setForm(f => ({ ...f, account_holder: e.target.value }))}
              placeholder="홍길동"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 bg-pink-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? '저장 중...' : '정산 정보 저장'}
          </button>
        </div>

        {/* 내가 영입한 매장 (Phase 1) + 협업 deals (Phase 2) */}
        <MyStoresAndDeals />

        {/* 최근 내역 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">최근 commission 내역 ({recent.length}건)</h3>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">아직 referral commission 이 없습니다</p>
          ) : (
            <ul className="space-y-2">
              {recent.map(r => {
                const status = STATUS_LABEL[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{r.commission_amount.toLocaleString()}원</p>
                      <p className="text-[10px] text-gray-500">상품 #{r.product_id} · {new Date(r.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${status.color}`}>{status.label}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
